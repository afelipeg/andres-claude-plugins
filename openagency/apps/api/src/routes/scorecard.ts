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
import { ScorecardDbRepo } from '@openagency/memory';

// ─── In-memory scorecard store (until DB persistence) ─────────────
export interface ScorecardRecord {
  id: string;
  created_at: string;
  ad_spend: number;
  engine_outputs: EngineOutputs;
  engine_results: Record<string, unknown>;
  billing: BillingResult;
  status: 'pending' | 'accepted' | 'rejected';
  feedback?: string;
  run_id?: string;
  client_id?: string;
}

const scorecardStore = new Map<string, ScorecardRecord>();
let latestScorecardId: string | null = null;

let scorecardDbRepo: ScorecardDbRepo | null = null;

export function setScorecardDbRepo(repo: ScorecardDbRepo): void {
  scorecardDbRepo = repo;
}

/**
 * Create a scorecard from a completed mesh run's stage results.
 * Called automatically after pipeline completion.
 */
export function createScorecardFromMeshRun(
  stageResults: Record<string, Record<string, unknown>>,
  opts: { run_id: string; ad_spend?: number; client_id?: string; client_lift_rate?: number; client_efficiency_rate?: number; run_type?: string },
): ScorecardRecord {
  const engineOutputs: EngineOutputs = { ad_spend: opts.ad_spend ?? 0 };

  // Extract engine outputs from stage results
  for (const [agentId, stage] of Object.entries(stageResults)) {
    const outputSummary = (stage.output_summary ?? {}) as Record<string, unknown>;
    const cycleResult = stage.cycle_result as Record<string, unknown> | undefined;
    const actResults = (cycleResult?.results ?? []) as Array<Record<string, unknown>>;

    // Use output_summary as the primary source (it has the skill-level data)
    // Map each skill that was invoked
    const skillsInvoked = (stage.skills_invoked ?? []) as string[];
    for (const skillId of skillsInvoked) {
      // Find the matching act result for this skill
      const skillResult = actResults.find((r) => r.skill === skillId || r.skill_id === skillId);
      const data = (skillResult?.data ?? skillResult?.result ?? outputSummary) as Record<string, unknown>;
      mapToEngineOutputs(engineOutputs, agentId, skillId, data);
    }

    // Primary: use skill_data populated by mesh-coordinator's agency.run() calls
    // Keys are qualified like 'leak-detector:waste-waterfall'; split to route correctly.
    const skillData = outputSummary['skill_data'] as Record<string, unknown> | undefined;
    if (skillData) {
      for (const [qualifiedSkill, data] of Object.entries(skillData)) {
        const colonIdx = qualifiedSkill.indexOf(':');
        if (colonIdx !== -1) {
          const skillEngineId = qualifiedSkill.slice(0, colonIdx);
          const skillName = qualifiedSkill.slice(colonIdx + 1);
          mapToEngineOutputs(engineOutputs, skillEngineId, skillName, data as Record<string, unknown>);
        }
      }
    }

    // Fallback: if no skills mapped and no skill_data, use output_summary for known fields
    if (skillsInvoked.length === 0 && !skillData && Object.keys(outputSummary).length > 0) {
      // Try to infer from output_summary structure
      if (agentId === 'leak-detector' && !engineOutputs.leak_detector) {
        engineOutputs.leak_detector = { waste_waterfall: outputSummary };
      }
      if (agentId === 'media-architect' && !engineOutputs.media_architect) {
        engineOutputs.media_architect = { mmm_model: outputSummary };
      }
      if (agentId === 'campaign-ops' && !engineOutputs.campaign_ops) {
        engineOutputs.campaign_ops = { optimization_analyze: outputSummary };
      }
      if (agentId === 'executive-bridge' && !engineOutputs.executive_bridge) {
        engineOutputs.executive_bridge = { revenue_translate: outputSummary };
      }
    }
  }

  // If ad_spend wasn't provided, try to extract from leak-detector output
  if (!engineOutputs.ad_spend || engineOutputs.ad_spend <= 0) {
    const wasteOutput = engineOutputs.leak_detector?.waste_waterfall as Record<string, unknown> | undefined;
    engineOutputs.ad_spend = (wasteOutput?.gross_spend as number) ?? (wasteOutput?.ad_spend as number) ?? 0;
  }

  // Pass client rates if provided
  if (opts.client_lift_rate !== undefined) engineOutputs.client_lift_rate = opts.client_lift_rate;
  if (opts.client_efficiency_rate !== undefined) engineOutputs.client_efficiency_rate = opts.client_efficiency_rate;

  const billing = calculateBillingFromEngines(engineOutputs);

  const id = randomUUID();
  const record: ScorecardRecord = {
    id,
    created_at: new Date().toISOString(),
    ad_spend: engineOutputs.ad_spend,
    engine_outputs: engineOutputs,
    engine_results: stageResults,
    billing,
    status: 'pending',
    run_id: opts.run_id,
    client_id: opts.client_id,
  };

  scorecardStore.set(id, record);
  if (scorecardDbRepo) {
    scorecardDbRepo.save({
      id: record.id,
      run_id: record.run_id,
      client_id: record.client_id,
      run_type: opts.run_type ?? 'standard',
      ad_spend: record.ad_spend,
      billing: record.billing as unknown as Record<string, unknown>,
      engine_outputs: record.engine_outputs as unknown as Record<string, unknown>,
      engine_results: record.engine_results as Record<string, unknown>,
      status: record.status,
      feedback: record.feedback,
      created_at: record.created_at,
      updated_at: record.created_at,
    }).catch(() => {});
  }
  latestScorecardId = id;

  return record;
}

export function scorecardRoutes(
  agency: OpenAgency,
  mesh: MeshCoordinator,
  _connectorInfra: ConnectorInfra,
  scorecardDb?: ScorecardDbRepo,
) {
  if (scorecardDb) setScorecardDbRepo(scorecardDb);
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

  // ─── Compare plan vs actual scorecards ──────────────────────────
  app.post('/v1/scorecard/compare', async (c) => {
    if (!scorecardDb) return c.json({ error: 'no_db', message: 'Database not configured' }, 503);

    const body = await c.req.json<{ plan_id: string; actual_id: string }>();
    if (!body.plan_id || !body.actual_id) {
      return c.json({ error: 'missing_fields', message: 'plan_id and actual_id required' }, 400);
    }

    const [plan, actual] = await Promise.all([
      scorecardDb.findById(body.plan_id),
      scorecardDb.findById(body.actual_id),
    ]);

    if (!plan) return c.json({ error: 'not_found', message: `Plan scorecard not found: ${body.plan_id}` }, 404);
    if (!actual) return c.json({ error: 'not_found', message: `Actual scorecard not found: ${body.actual_id}` }, 404);

    const planBilling = plan.billing as Record<string, unknown>;
    const actualBilling = actual.billing as Record<string, unknown>;

    const num = (obj: Record<string, unknown>, key: string) => Number(obj[key] ?? 0);

    const comparison = {
      plan_id: plan.id,
      actual_id: actual.id,
      plan_run_type: plan.run_type,
      actual_run_type: actual.run_type,
      ad_spend_delta: actual.ad_spend - plan.ad_spend,
      recovery_delta: num(actualBilling, 'total_recovery') - num(planBilling, 'total_recovery'),
      lift_delta: num(actualBilling, 'total_lift') - num(planBilling, 'total_lift'),
      efficiency_delta: num(actualBilling, 'total_efficiency_savings') - num(planBilling, 'total_efficiency_savings'),
      total_fee_delta: num(actualBilling, 'total_fee') - num(planBilling, 'total_fee'),
      roi_delta: num(actualBilling, 'roi_on_fee') - num(planBilling, 'roi_on_fee'),
      plan_summary: {
        ad_spend: plan.ad_spend,
        total_fee: num(planBilling, 'total_fee'),
        roi_on_fee: num(planBilling, 'roi_on_fee'),
        created_at: plan.created_at,
      },
      actual_summary: {
        ad_spend: actual.ad_spend,
        total_fee: num(actualBilling, 'total_fee'),
        roi_on_fee: num(actualBilling, 'roi_on_fee'),
        created_at: actual.created_at,
      },
    };

    return c.json(comparison);
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

/** Map a skill result into the EngineOutputs structure for billing.
 *  Uses dynamic key mapping: skill-id → skill_id (kebab → snake_case). */
function mapToEngineOutputs(
  outputs: EngineOutputs,
  engineId: string,
  skillId: string,
  result: Record<string, unknown>,
): void {
  const key = skillId.replace(/-/g, '_');
  switch (engineId) {
    case 'leak-detector':
      if (!outputs.leak_detector) outputs.leak_detector = {};
      (outputs.leak_detector as Record<string, unknown>)[key] = result;
      break;
    case 'media-architect':
      if (!outputs.media_architect) outputs.media_architect = {};
      (outputs.media_architect as Record<string, unknown>)[key] = result;
      break;
    case 'campaign-ops':
      if (!outputs.campaign_ops) outputs.campaign_ops = {};
      (outputs.campaign_ops as Record<string, unknown>)[key] = result;
      break;
    case 'executive-bridge':
      if (!outputs.executive_bridge) outputs.executive_bridge = {};
      (outputs.executive_bridge as Record<string, unknown>)[key] = result;
      break;
  }
}
