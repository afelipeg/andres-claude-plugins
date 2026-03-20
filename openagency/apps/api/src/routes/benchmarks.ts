// ─── Benchmarks Routes ──────────────────────────────────────────────
// Cross-client anonymized benchmarks from the scorecards table.
// No client_id is exposed in responses — all data is aggregated.
//
// GET /v1/benchmarks/channels  — channel performance percentiles
// GET /v1/benchmarks/waste     — waste rates by channel
// GET /v1/benchmarks/roas      — ROAS distributions by channel

import { Hono } from 'hono';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

interface ChannelBenchmark {
  channel: string;
  sample_count: number;
  avg_spend: number;
  avg_roas: number;
  avg_cpa: number;
  avg_ctr: number;
  p25_roas: number;
  p50_roas: number;
  p75_roas: number;
}

interface WasteBenchmark {
  channel: string;
  sample_count: number;
  avg_waste_pct: number;
  p25_waste_pct: number;
  p50_waste_pct: number;
  p75_waste_pct: number;
  total_waste_detected: number;
}

interface RoasBenchmark {
  channel: string;
  sample_count: number;
  min_roas: number;
  p10_roas: number;
  p25_roas: number;
  p50_roas: number;
  p75_roas: number;
  p90_roas: number;
  max_roas: number;
}

// ─── Percentile helper (sorts in place) ──────────────────────────────

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower] ?? 0;
  return (sorted[lower] ?? 0) + (idx - lower) * ((sorted[upper] ?? 0) - (sorted[lower] ?? 0));
}

// ─── Extract channel-level metrics from engine_outputs JSON ──────────

interface ChannelRow {
  channel: string;
  spend: number;
  roas: number;
  cpa: number;
  ctr: number;
  waste_pct: number;
}

function extractChannelRows(scorecards: Array<{
  engine_outputs: Record<string, unknown>;
  billing: Record<string, unknown>;
  ad_spend: number;
}>): ChannelRow[] {
  const rows: ChannelRow[] = [];

  for (const sc of scorecards) {
    // Try to extract per-channel data from engine outputs
    const mediaArchitect = sc.engine_outputs?.['media-architect'] as Record<string, unknown> | undefined;
    const leakDetector = sc.engine_outputs?.['leak-detector'] as Record<string, unknown> | undefined;
    const billing = sc.billing ?? {};

    // Channel allocations from media architect
    const allocations = (mediaArchitect?.['optimal_allocation'] ?? mediaArchitect?.['channel_allocations'] ?? []) as Array<{
      channel?: string;
      budget?: number;
      spend?: number;
      expected_roas?: number;
      roas?: number;
      cpa?: number;
      ctr?: number;
    }>;

    if (allocations.length > 0) {
      for (const alloc of allocations) {
        const channel = alloc.channel ?? 'unknown';
        rows.push({
          channel,
          spend: alloc.budget ?? alloc.spend ?? 0,
          roas: alloc.expected_roas ?? alloc.roas ?? 0,
          cpa: alloc.cpa ?? 0,
          ctr: alloc.ctr ?? 0,
          waste_pct: 0, // computed separately
        });
      }
    } else {
      // Fallback: aggregate scorecard as a single "blended" channel
      const wastePct = Number((billing as Record<string, unknown>)?.['waste_pct'] ?? 0);
      rows.push({
        channel: 'blended',
        spend: sc.ad_spend,
        roas: Number((billing as Record<string, unknown>)?.['roas'] ?? 0),
        cpa: 0,
        ctr: 0,
        waste_pct: wastePct,
      });
    }

    // Waste breakdown from leak detector
    const wasteByChannel = (leakDetector?.['waste_by_channel'] ?? leakDetector?.['channel_waste'] ?? {}) as Record<string, number>;
    for (const [channel, wastePct] of Object.entries(wasteByChannel)) {
      const existing = rows.find((r) => r.channel === channel);
      if (existing) {
        existing.waste_pct = typeof wastePct === 'number' ? wastePct : 0;
      }
    }
  }

  return rows;
}

// ─── Route factory ──────────────────────────────────────────────────

export function benchmarkRoutes(db?: Db) {
  const app = new Hono();

  // ─── Shared data loader ─────────────────────────────────────────────
  async function loadScorecards(): Promise<Array<{
    engine_outputs: Record<string, unknown>;
    billing: Record<string, unknown>;
    ad_spend: number;
  }>> {
    if (!db) return [];
    try {
      const rows = await db`
        SELECT engine_outputs, billing, ad_spend
        FROM scorecards
        ORDER BY created_at DESC
        LIMIT 500
      ` as Array<{
        engine_outputs: unknown;
        billing: unknown;
        ad_spend: number | string;
      }>;

      return rows.map((r) => ({
        engine_outputs: (r.engine_outputs as Record<string, unknown>) ?? {},
        billing: (r.billing as Record<string, unknown>) ?? {},
        ad_spend: Number(r.ad_spend),
      }));
    } catch {
      return [];
    }
  }

  // ─── GET /v1/benchmarks/channels ─────────────────────────────────────
  app.get('/v1/benchmarks/channels', async (c) => {
    const scorecards = await loadScorecards();
    if (scorecards.length === 0) {
      return c.json({
        benchmarks: [],
        sample_size: 0,
        message: 'No scorecard data available yet. Run pipelines to populate benchmarks.',
      });
    }

    const channelRows = extractChannelRows(scorecards);

    // Group by channel
    const grouped = new Map<string, ChannelRow[]>();
    for (const row of channelRows) {
      const arr = grouped.get(row.channel) ?? [];
      arr.push(row);
      grouped.set(row.channel, arr);
    }

    const benchmarks: ChannelBenchmark[] = [];
    for (const [channel, rows] of grouped) {
      if (rows.length < 1) continue;
      const roasValues = rows.map((r) => r.roas).sort((a, b) => a - b);
      benchmarks.push({
        channel,
        sample_count: rows.length,
        avg_spend: rows.reduce((s, r) => s + r.spend, 0) / rows.length,
        avg_roas: rows.reduce((s, r) => s + r.roas, 0) / rows.length,
        avg_cpa: rows.reduce((s, r) => s + r.cpa, 0) / rows.length,
        avg_ctr: rows.reduce((s, r) => s + r.ctr, 0) / rows.length,
        p25_roas: percentile(roasValues, 25),
        p50_roas: percentile(roasValues, 50),
        p75_roas: percentile(roasValues, 75),
      });
    }

    return c.json({
      benchmarks: benchmarks.sort((a, b) => b.sample_count - a.sample_count),
      sample_size: scorecards.length,
      generated_at: new Date().toISOString(),
    });
  });

  // ─── GET /v1/benchmarks/waste ─────────────────────────────────────────
  app.get('/v1/benchmarks/waste', async (c) => {
    const scorecards = await loadScorecards();
    if (scorecards.length === 0) {
      return c.json({
        benchmarks: [],
        sample_size: 0,
        message: 'No scorecard data available yet.',
      });
    }

    const channelRows = extractChannelRows(scorecards);

    // Group by channel
    const grouped = new Map<string, ChannelRow[]>();
    for (const row of channelRows) {
      if (row.waste_pct <= 0) continue; // skip rows with no waste data
      const arr = grouped.get(row.channel) ?? [];
      arr.push(row);
      grouped.set(row.channel, arr);
    }

    const benchmarks: WasteBenchmark[] = [];
    for (const [channel, rows] of grouped) {
      if (rows.length < 1) continue;
      const wasteValues = rows.map((r) => r.waste_pct).sort((a, b) => a - b);
      benchmarks.push({
        channel,
        sample_count: rows.length,
        avg_waste_pct: rows.reduce((s, r) => s + r.waste_pct, 0) / rows.length,
        p25_waste_pct: percentile(wasteValues, 25),
        p50_waste_pct: percentile(wasteValues, 50),
        p75_waste_pct: percentile(wasteValues, 75),
        total_waste_detected: rows.reduce((s, r) => s + r.spend * r.waste_pct / 100, 0),
      });
    }

    return c.json({
      benchmarks: benchmarks.sort((a, b) => b.sample_count - a.sample_count),
      sample_size: scorecards.length,
      generated_at: new Date().toISOString(),
    });
  });

  // ─── GET /v1/benchmarks/roas ──────────────────────────────────────────
  app.get('/v1/benchmarks/roas', async (c) => {
    const scorecards = await loadScorecards();
    if (scorecards.length === 0) {
      return c.json({
        benchmarks: [],
        sample_size: 0,
        message: 'No scorecard data available yet.',
      });
    }

    const channelRows = extractChannelRows(scorecards);

    // Group by channel
    const grouped = new Map<string, ChannelRow[]>();
    for (const row of channelRows) {
      if (row.roas <= 0) continue; // skip rows with no ROAS data
      const arr = grouped.get(row.channel) ?? [];
      arr.push(row);
      grouped.set(row.channel, arr);
    }

    const benchmarks: RoasBenchmark[] = [];
    for (const [channel, rows] of grouped) {
      if (rows.length < 1) continue;
      const roasValues = rows.map((r) => r.roas).sort((a, b) => a - b);
      benchmarks.push({
        channel,
        sample_count: rows.length,
        min_roas: roasValues[0] ?? 0,
        p10_roas: percentile(roasValues, 10),
        p25_roas: percentile(roasValues, 25),
        p50_roas: percentile(roasValues, 50),
        p75_roas: percentile(roasValues, 75),
        p90_roas: percentile(roasValues, 90),
        max_roas: roasValues[roasValues.length - 1] ?? 0,
      });
    }

    return c.json({
      benchmarks: benchmarks.sort((a, b) => b.sample_count - a.sample_count),
      sample_size: scorecards.length,
      generated_at: new Date().toISOString(),
    });
  });

  return app;
}
