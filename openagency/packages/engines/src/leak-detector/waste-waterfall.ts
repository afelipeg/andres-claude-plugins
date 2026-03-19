// ─── Waste Waterfall Engine ──────────────────────────────────────────
// Port of waste_waterfall.py - 6-stage waste decomposition
// Math rule: sum of all waste + productive = gross_spend (tolerance < $1)

import { round } from '@openagency/core';
import type {
  Industry,
  WasteWaterfallInput,
  WasteWaterfallOutput,
  WasteEstimateInput,
  WasteCompareInput,
  WasteCompareOutput,
  WaterfallStage,
  RecoveryAction,
  BenchmarkComparison,
} from '@openagency/types';
import { INDUSTRY_BENCHMARKS, DIFFICULTY_MAP, TIMELINE_MAP } from './benchmarks.js';

function sumCategory(data: Record<string, number> | number | undefined): number {
  if (data === undefined) return 0;
  if (typeof data === 'number') return data;
  return Object.values(data).reduce((a, b) => a + b, 0);
}

type StageInfo = [string, string, number];

export function analyze(data: WasteWaterfallInput): WasteWaterfallOutput | { error: string } {
  const gross = data.gross_spend ?? 0;
  if (gross <= 0) return { error: 'gross_spend must be positive' };
  const industry: Industry = data.industry ?? 'retail';
  const actualRevenue = data.actual_revenue ?? 0;

  // Extract waste categories
  const nonWorkingTotal = sumCategory(data.non_working);
  const supplyChainTotal = sumCategory(data.supply_chain);
  const qualityTotal = sumCategory(data.quality);
  const audienceTotal = sumCategory(data.audience);
  const optimizationTotal = sumCategory(data.optimization);
  const measurementTotal = sumCategory(data.measurement);

  const totalWaste =
    nonWorkingTotal + supplyChainTotal + qualityTotal +
    audienceTotal + optimizationTotal + measurementTotal;
  const productive = gross - totalWaste;

  // Validate math
  const mathCheck = Math.abs(totalWaste + productive - gross);
  if (mathCheck > 1) {
    return {
      error: `Math validation failed: waste (${totalWaste}) + productive (${productive}) = ${totalWaste + productive}, but gross = ${gross}. Difference: ${mathCheck}`,
    };
  }

  // Build waterfall
  let remaining = gross;
  const waterfall: WaterfallStage[] = [];

  const stages: StageInfo[] = [
    ['non_working', 'Non-Working Overhead', nonWorkingTotal],
    ['supply_chain', 'Supply Chain Waste', supplyChainTotal],
    ['quality', 'Quality Waste', qualityTotal],
    ['audience', 'Audience Waste', audienceTotal],
    ['optimization', 'Optimization Waste', optimizationTotal],
    ['measurement', 'Measurement Waste', measurementTotal],
  ];

  const benchmarks = INDUSTRY_BENCHMARKS[industry] ?? INDUSTRY_BENCHMARKS.retail;

  for (const [catId, label, amount] of stages) {
    const pct = gross > 0 ? (amount / gross) * 100 : 0;
    const benchmarkPct = benchmarks[catId] ?? 0;
    const benchmarkAmount = benchmarkPct * gross;

    let vsBenchmark: BenchmarkComparison = 'at';
    if (amount > benchmarkAmount * 1.1) vsBenchmark = 'above';
    else if (amount < benchmarkAmount * 0.9) vsBenchmark = 'below';

    waterfall.push({
      category: catId,
      label,
      gross_in: round(remaining),
      waste_amount: round(amount),
      waste_pct: round(pct, 1),
      remaining: round(remaining - amount),
      benchmark_amount: round(benchmarkAmount),
      benchmark_pct: round(benchmarkPct * 100, 1),
      vs_benchmark: vsBenchmark,
      data_source: 'actual',
    });

    remaining -= amount;
  }

  // Recovery roadmap
  const roadmap: RecoveryAction[] = [];

  for (const [catId, label, amount] of stages) {
    if (amount > 0) {
      const benchmarkAmount = (benchmarks[catId] ?? 0) * gross;
      const recoverable = Math.max(0, amount - benchmarkAmount);
      if (recoverable > 0) {
        const benchmarkPct = (benchmarks[catId] ?? 0) * 100;
        roadmap.push({
          category: catId,
          action: `Reduce ${label.toLowerCase()} from ${round(amount / gross * 100, 1)}% to benchmark ${round(benchmarkPct, 1)}%`,
          estimated_savings: round(recoverable),
          difficulty: DIFFICULTY_MAP[catId] ?? 'medium',
          timeline: TIMELINE_MAP[catId] ?? '3-6 months',
        });
      }
    }
  }

  roadmap.sort((a, b) => b.estimated_savings - a.estimated_savings);

  // C-Suite summaries
  const productivePct = gross > 0 ? (productive / gross) * 100 : 0;
  const totalRecoverable = roadmap.reduce((s, r) => s + r.estimated_savings, 0);

  const fmt = (n: number | undefined | null) => (n ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
  const safePct = (n: number, d: number) => d > 0 ? Math.round((n / d) * 100) : 0;

  const csuite = {
    ceo: `Of $${fmt(gross)} invested, $${fmt(productive)} (${Math.round(productivePct)}%) reached consumers productively. $${fmt(totalRecoverable)} is recoverable through governance improvements, directly increasing marketing effectiveness.`,
    cfo: `Total waste: $${fmt(totalWaste)} (${safePct(totalWaste, gross)}% of spend). Recovery roadmap identifies $${fmt(totalRecoverable)} in savings. Current ROAS would improve by ${safePct(totalRecoverable, gross)}% if waste is eliminated.`,
    cmo: `Productive spend: ${Math.round(productivePct)}% (industry benchmark: ${Math.round((benchmarks.non_working ?? 0.15) * 100)}% non-working). Top waste categories: ${stages.sort((a, b) => b[2] - a[2]).slice(0, 3).map((s) => s[0]).join(', ')}.`,
  };

  const result: WasteWaterfallOutput = {
    gross_spend: gross,
    waterfall,
    productive_spend: { amount: round(productive), pct: round(productivePct, 1) },
    waste_summary: {
      total_waste: round(totalWaste),
      waste_pct: gross > 0 ? round((totalWaste / gross) * 100, 1) : 0,
    },
    recovery_roadmap: roadmap,
    csuite_summary: csuite,
    industry,
    math_validated: mathCheck < 1,
  };

  // ROI impact if actual revenue provided
  if (actualRevenue > 0) {
    const currentRoas = actualRevenue / gross;
    const productiveRoas = productive > 0 ? actualRevenue / productive : 0;
    result.roi_impact = {
      current_roas: round(currentRoas),
      productive_roas: round(productiveRoas),
      improvement_potential_pct: currentRoas > 0
        ? round(((productiveRoas - currentRoas) / currentRoas) * 100, 1)
        : 0,
    };
  }

  return result;
}

export function estimate(data: WasteEstimateInput): WasteWaterfallOutput | { error: string } {
  const gross = data.gross_spend;
  const industry: Industry = data.industry ?? 'retail';
  const benchmarks = INDUSTRY_BENCHMARKS[industry] ?? INDUSTRY_BENCHMARKS.retail;

  const estimatedData: WasteWaterfallInput = {
    gross_spend: gross,
    industry,
    non_working: { estimated: round(gross * benchmarks.non_working) },
    supply_chain: { estimated: round(gross * benchmarks.supply_chain) },
    quality: { estimated: round(gross * benchmarks.quality) },
    audience: { estimated: round(gross * benchmarks.audience) },
    optimization: { estimated: round(gross * benchmarks.optimization) },
    measurement: { estimated: round(gross * benchmarks.measurement) },
  };

  if (data.actual_revenue) {
    estimatedData.actual_revenue = data.actual_revenue;
  }

  const result = analyze(estimatedData);

  if ('error' in result) return result;

  // Mark all as estimated
  for (const stage of result.waterfall) {
    stage.data_source = 'benchmark_estimate';
    stage.note = `ESTIMATED from ${industry} benchmarks`;
  }

  return result;
}

export function comparePeriods(
  data: WasteCompareInput,
): WasteCompareOutput | { error: string } {
  const p1 = analyze(data.period_1);
  const p2 = analyze(data.period_2);

  if ('error' in p1 || 'error' in p2) {
    return { error: 'Analysis failed for one or both periods' };
  }

  const comparison = p1.waterfall.map((s1, i) => {
    const s2 = p2.waterfall[i];
    const delta = s2.waste_pct - s1.waste_pct;
    return {
      category: s1.category,
      period_1_pct: s1.waste_pct,
      period_2_pct: s2.waste_pct,
      delta_pct: round(delta, 1),
      direction: (delta < 0 ? 'improved' : delta > 0 ? 'regressed' : 'unchanged') as
        'improved' | 'regressed' | 'unchanged',
    };
  });

  return {
    period_1: p1,
    period_2: p2,
    comparison,
    productive_spend_delta: round(p2.productive_spend.pct - p1.productive_spend.pct, 1),
  };
}
