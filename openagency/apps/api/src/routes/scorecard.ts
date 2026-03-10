// ─── Recovery Scorecard + Billing Routes ────────────────────────────
// POST /v1/scorecard/compute  — compute billing from provided engine outputs
// GET  /v1/scorecard/latest   — get last computed scorecard
// POST /v1/scorecard/run      — run all 4 engines on input data → scorecard + billing
//
// This is the core A2H surface: the human sees value delivered + fee,
// then accepts or rejects recommendations.

import { Hono } from 'hono';
import { randomUUID } from 'node:crypto';
import type { OpenAgency } from '@openagency/core';
import {
  calculateBillingFromEngines,
  resolveTier,
} from '@openagency/core';
import type { EngineOutputs, BillingResult } from '@openagency/core';
import type { MeshCoordinator } from '@openagency/agent';
import type { ConnectorInfra } from '../connectors/setup.js';

// ─── In-memory scorecard store (until DB persistence) ─────────────
interface ScorecardRecord {
  id: string;
  created_at: string;
  ad_spend: number;
  engine_outputs: EngineOutputs;
  engine_results: Record<string, unknown>;
  billing: BillingResult;
  status: 'pending' | 'accepted' | 'rejected';
  feedback?: string;
}

const scorecardStore = new Map<string, ScorecardRecord>();
let latestScorecardId: string | null = null;

export function scorecardRoutes(
  agency: OpenAgency,
  mesh: MeshCoordinator,
  _connectorInfra: ConnectorInfra,
) {
  const app = new Hono();

  // ─── Compute billing from raw engine outputs ─────────────────────
  app.post('/v1/scorecard/compute', async (c) => {
    try {
      const body = await c.req.json<EngineOutputs>();
      if (!body.ad_spend || body.ad_spend <= 0) {
        return c.json(
          { error: 'validation_error', message: 'ad_spend must be a positive number', status: 400 },
          400,
        );
      }
      const billing = calculateBillingFromEngines(body);

      // Store as scorecard
      const id = randomUUID();
      const record: ScorecardRecord = {
        id,
        created_at: new Date().toISOString(),
        ad_spend: body.ad_spend,
        engine_outputs: body,
        engine_results: {},
        billing,
        status: 'pending',
      };
      scorecardStore.set(id, record);
      latestScorecardId = id;

      return c.json({ scorecard_id: id, billing });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: 'bad_request', message, status: 400 }, 400);
    }
  });

  // ─── Run all engines on input → scorecard + billing ───────────────
  app.post('/v1/scorecard/run', async (c) => {
    try {
      const body = await c.req.json<{
        ad_spend: number;
        data: Record<string, unknown>;
        engines?: string[];
      }>();

      if (!body.ad_spend || body.ad_spend <= 0) {
        return c.json(
          { error: 'validation_error', message: 'ad_spend is required and must be > 0', status: 400 },
          400,
        );
      }

      if (!body.data) {
        return c.json(
          { error: 'validation_error', message: 'data field is required', status: 400 },
          400,
        );
      }

      const engineIds = body.engines ?? [
        'leak-detector',
        'media-architect',
        'campaign-ops',
        'executive-bridge',
      ];

      const engineOutputs: EngineOutputs = { ad_spend: body.ad_spend };
      const engineResults: Record<string, unknown> = {};

      for (const engineId of engineIds) {
        try {
          const skills = getEngineSkills(engineId);
          for (const skillId of skills) {
            try {
              const result = await agency.run(engineId, skillId, body.data);
              if (!engineResults[engineId]) engineResults[engineId] = {};
              (engineResults[engineId] as Record<string, unknown>)[skillId] = result;
              mapToEngineOutputs(engineOutputs, engineId, skillId, result as unknown as Record<string, unknown>);
            } catch {
              // Individual skill failure doesn't block other skills
            }
          }
        } catch (err) {
          engineResults[engineId] = {
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }

      const billing = calculateBillingFromEngines(engineOutputs);

      // Store scorecard
      const id = randomUUID();
      const record: ScorecardRecord = {
        id,
        created_at: new Date().toISOString(),
        ad_spend: body.ad_spend,
        engine_outputs: engineOutputs,
        engine_results: engineResults,
        billing,
        status: 'pending',
      };
      scorecardStore.set(id, record);
      latestScorecardId = id;

      return c.json({
        scorecard_id: id,
        engine_results: engineResults,
        billing,
        tier: billing.tier,
      }, 201);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: 'execution_failed', message, status: 500 }, 500);
    }
  });

  // ─── Preview tier rates for a given spend ─────────────────────────
  // Must be before /:id wildcard to avoid being captured as id="tier-preview"
  app.get('/v1/scorecard/tier-preview', (c) => {
    const spendParam = c.req.query('ad_spend');
    const spend = spendParam ? parseFloat(spendParam) : 0;
    if (!spend || spend <= 0) {
      return c.json(
        { error: 'validation_error', message: 'Query param ad_spend is required and must be > 0', status: 400 },
        400,
      );
    }
    const tier = resolveTier(spend);
    return c.json(tier);
  });

  // ─── Get scorecard by ID ──────────────────────────────────────────
  app.get('/v1/scorecard/:id', (c) => {
    const id = c.req.param('id');
    const record = scorecardStore.get(id);
    if (!record) {
      return c.json({ error: 'not_found', message: `Scorecard not found: ${id}`, status: 404 }, 404);
    }
    return c.json(record);
  });

  // ─── Get latest scorecard ─────────────────────────────────────────
  app.get('/v1/scorecard', (c) => {
    if (!latestScorecardId) {
      return c.json({
        error: 'not_found',
        message: 'No scorecards computed yet. POST to /v1/scorecard/run or /v1/scorecard/compute first.',
        status: 404,
      }, 404);
    }
    const record = scorecardStore.get(latestScorecardId);
    return c.json(record);
  });

  // ─── Accept / Reject scorecard ────────────────────────────────────
  app.patch('/v1/scorecard/:id', async (c) => {
    const id = c.req.param('id');
    const record = scorecardStore.get(id);
    if (!record) {
      return c.json({ error: 'not_found', message: `Scorecard not found: ${id}`, status: 404 }, 404);
    }

    try {
      const body = await c.req.json<{ status: 'accepted' | 'rejected'; feedback?: string }>();
      if (body.status !== 'accepted' && body.status !== 'rejected') {
        return c.json(
          { error: 'validation_error', message: 'status must be "accepted" or "rejected"', status: 400 },
          400,
        );
      }
      record.status = body.status;
      if (body.feedback) record.feedback = body.feedback;
      return c.json(record);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: 'bad_request', message, status: 400 }, 400);
    }
  });

  // ─── List all scorecards ──────────────────────────────────────────
  app.get('/v1/scorecards', (c) => {
    const records = Array.from(scorecardStore.values())
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((r) => ({
        id: r.id,
        created_at: r.created_at,
        ad_spend: r.ad_spend,
        total_fee: r.billing.total_fee,
        value_delivered: r.billing.value_delivered,
        roi_on_fee: r.billing.roi_on_fee,
        tier: r.billing.tier.tier,
        status: r.status,
      }));
    return c.json({ scorecards: records });
  });

  return app;
}

// ─── Helpers ──────────────────────────────────────────────────────────

/** Get the billing-relevant skills for each engine */
function getEngineSkills(engineId: string): string[] {
  const map: Record<string, string[]> = {
    'leak-detector': ['waste-waterfall', 'media-quality-score', 'supply-chain-audit'],
    'media-architect': ['mmm-optimize', 'mmm-model'],
    'campaign-ops': ['optimization-analyze', 'optimization-reallocate'],
    'executive-bridge': ['reconcile', 'revenue-translate'],
  };
  return map[engineId] ?? [];
}

/** Map a skill result into the EngineOutputs structure for billing */
function mapToEngineOutputs(
  outputs: EngineOutputs,
  engineId: string,
  skillId: string,
  result: Record<string, unknown>,
): void {
  switch (engineId) {
    case 'leak-detector':
      if (!outputs.leak_detector) outputs.leak_detector = {};
      if (skillId === 'waste-waterfall') outputs.leak_detector.waste_waterfall = result;
      else if (skillId === 'media-quality-score') outputs.leak_detector.media_quality_score = result;
      else if (skillId === 'supply-chain-audit') outputs.leak_detector.supply_chain_audit = result;
      break;
    case 'media-architect':
      if (!outputs.media_architect) outputs.media_architect = {};
      if (skillId === 'mmm-optimize') outputs.media_architect.mmm_optimize = result;
      else if (skillId === 'mmm-model') outputs.media_architect.mmm_model = result;
      break;
    case 'campaign-ops':
      if (!outputs.campaign_ops) outputs.campaign_ops = {};
      if (skillId === 'optimization-analyze') outputs.campaign_ops.optimization_analyze = result;
      else if (skillId === 'optimization-reallocate') outputs.campaign_ops.optimization_reallocate = result;
      break;
    case 'executive-bridge':
      if (!outputs.executive_bridge) outputs.executive_bridge = {};
      if (skillId === 'reconcile') outputs.executive_bridge.reconcile = result;
      else if (skillId === 'revenue-translate') outputs.executive_bridge.revenue_translate = result;
      break;
  }
}
