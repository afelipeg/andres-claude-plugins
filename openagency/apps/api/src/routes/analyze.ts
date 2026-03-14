// ─── Analyze Pipeline Routes ────────────────────────────────────────
// POST /v1/analyze      — JSON data + run engines → billing
// POST /v1/analyze/file — file upload + parse + run engines → billing
//
// End-to-end pipeline:
//   1. Accept file upload (CSV/Excel/PDF) or JSON body
//   2. Parse and detect platform
//   3. Run relevant engine skills
//   4. Calculate billing from engine results
//   5. Return unified scorecard response

import { Hono } from 'hono';
import type { OpenAgency } from '@openagency/core';
import { calculateBillingFromEngines } from '@openagency/core';
import { parseFile } from '@openagency/core/data/file-parser';
import { detectPlatform } from '@openagency/core/data/platform-detect';
import type { EngineOutputs } from '@openagency/core';

export function analyzeRoutes(agency: OpenAgency) {
  const app = new Hono();

  // ─── Analyze JSON data directly ───────────────────────────────────
  app.post('/v1/analyze', async (c) => {
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

      const result = await runEngines(agency, body.ad_spend, body.data, body.engines);
      return c.json(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: 'bad_request', message, status: 400 }, 400);
    }
  });

  // ─── Analyze uploaded file ────────────────────────────────────────
  app.post('/v1/analyze/file', async (c) => {
    const formData = await c.req.parseBody();
    const file = formData['file'];
    const adSpendRaw = formData['ad_spend'];

    if (!file || !(file instanceof File)) {
      return c.json(
        { error: 'bad_request', message: 'Missing "file" field in multipart form data', status: 400 },
        400,
      );
    }

    const adSpend = Number(adSpendRaw);
    if (!adSpend || adSpend <= 0) {
      return c.json(
        { error: 'validation_error', message: 'ad_spend form field is required and must be > 0', status: 400 },
        400,
      );
    }

    try {
      // 1. Parse the file
      const buffer = await file.arrayBuffer();
      const parsed = await parseFile(buffer, file.name);
      const mapping = detectPlatform(parsed.columns);

      // 2. Build engine input from parsed data
      const engineInput: Record<string, unknown> = {
        platform: mapping.platform,
        column_map: mapping.columnMap,
        rows: parsed.data,
        columns: parsed.columns,
      };

      // 3. Run engines
      const result = await runEngines(agency, adSpend, engineInput);

      return c.json({
        file: {
          name: file.name,
          format: parsed.format,
          platform: mapping.platform,
          confidence: mapping.confidence,
          rows: parsed.data.length,
          columns: parsed.columns,
        },
        ...result,
      }, 201);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Parse or analysis error';
      return c.json({ error: 'analysis_failed', message, status: 422 }, 422);
    }
  });

  return app;
}

// ─── Shared Engine Runner ─────────────────────────────────────────────

async function runEngines(
  agency: OpenAgency,
  adSpend: number,
  data: Record<string, unknown>,
  engineFilter?: string[],
) {
  const engineIds = engineFilter ?? [
    'leak-detector',
    'media-architect',
    'campaign-ops',
    'executive-bridge',
  ];

  const engineOutputs: EngineOutputs = { ad_spend: adSpend };
  const engineResults: Record<string, unknown> = {};

  for (const engineId of engineIds) {
    try {
      const skillId = getPrimarySkill(engineId);
      if (skillId) {
        const result = await agency.run(engineId, skillId, data);
        engineResults[engineId] = { [skillId]: result };
        // Extract inner .data for billing — agency.run() wraps output in { engine, skill, data, timestamp }
        const innerData = ((result as unknown as Record<string, unknown>).data ?? {}) as Record<string, unknown>;
        mapToEngineOutputs(engineOutputs, engineId, skillId, innerData);
      }
    } catch (err) {
      engineResults[engineId] = {
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  const billing = calculateBillingFromEngines(engineOutputs);

  return {
    ad_spend: adSpend,
    engine_results: engineResults,
    billing,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────

function getPrimarySkill(engineId: string): string | null {
  const map: Record<string, string> = {
    'leak-detector': 'waste-waterfall',
    'media-architect': 'mmm-optimize',
    'campaign-ops': 'optimization-analyze',
    'executive-bridge': 'revenue-translate',
  };
  return map[engineId] ?? null;
}

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
