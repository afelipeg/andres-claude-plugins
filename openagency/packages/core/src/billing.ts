// ─── Outcome-Based Billing Calculator ───────────────────────────────
// OpenAgency charges based on VALUE DELIVERED, not seats or usage.
//
// Three fee streams, each tiered by total ad spend:
//   1. Recovery Fee  (3-5%)  — waste eliminated, savings identified
//   2. Lift Fee      (10-20%) — ROAS/ROI/Media-Driven Sales improvement
//   3. Efficiency Fee (5-10%) — $ saved from digital metric improvements
//
// Tier structure (monthly ad spend):
//   Starter    (<$500K)    → 5% / 20% / 10%
//   Growth     ($500K-$2M) → 4.5% / 17% / 8.5%
//   Scale      ($2M-$5M)   → 4% / 14% / 7%
//   Enterprise (>$5M)      → 3% / 10% / 5%

// ─── Types ──────────────────────────────────────────────────────────

export type BillingTier = 'starter' | 'growth' | 'scale' | 'enterprise';

export interface TierRates {
  tier: BillingTier;
  label: string;
  min_spend: number;
  max_spend: number | null;
  recovery_rate: number;
  lift_rate: number;
  efficiency_rate: number;
}

export interface RecoveryInput {
  /** Leak Detector: waste_summary.total_waste */
  waste_total: number;
  /** Leak Detector: sum of quality_waste_dollars across channels */
  quality_waste: number;
  /** Leak Detector: supply_chain_audit SPO estimated_savings */
  supply_chain_savings: number;
  /** Campaign Ops: (actual_cpa - target_cpa) × conversions for overshoot alerts */
  cpa_overshoot_savings: number;
  /** Campaign Ops: optimization-reallocate recommendation amounts */
  reallocation_savings: number;
  /** Executive Bridge: reconcile measurement_waste_dollars */
  measurement_waste: number;
}

export interface LiftInput {
  /** Media Architect: mmm-optimize comparison_vs_current.kpi_lift ($ value) */
  kpi_lift_dollars: number;
  /** ROAS improvement: (new_roas - current_roas) × ad_spend */
  roas_lift_dollars: number;
  /** ROI improvement: (new_roi_pct - current_roi_pct) / 100 × ad_spend */
  roi_lift_dollars: number;
  /** Media-Driven Sales: triangulated from revenue-translate + mmm-model */
  media_driven_sales: MediaDrivenSalesInput;
}

export interface MediaDrivenSalesInput {
  /** Executive Bridge revenue-translate: total revenue attributed to media */
  attribution_revenue: number;
  /** Media Architect mmm-model: sum of estimated_contribution across channels */
  modeled_contribution: number;
}

export interface EfficiencyInput {
  /** (old_cpc - new_cpc) × total_clicks */
  cpc_savings: number;
  /** (old_cpm - new_cpm) × total_impressions / 1000 */
  cpm_savings: number;
  /** Revenue impact from CTR improvement */
  ctr_revenue_impact: number;
  /** From media-quality-score: viewability remediation savings */
  viewability_savings: number;
  /** From media-quality-score: brand safety remediation savings */
  brand_safety_savings: number;
}

/** Default client rate for lift and efficiency fees */
export const DEFAULT_CLIENT_RATE = 0.01; // 1.0%
export const MIN_CLIENT_RATE = 0.005;    // 0.5%
export const MAX_CLIENT_RATE = 0.015;    // 1.5%

export interface BillingInput {
  /** Total monthly advertising investment across all platforms */
  ad_spend: number;
  recovery: RecoveryInput;
  lift: LiftInput;
  efficiency: EfficiencyInput;
  /** Client-selected lift fee rate (0.005-0.015). Default: 0.01 (1%) */
  client_lift_rate?: number;
  /** Client-selected efficiency fee rate (0.005-0.015). Default: 0.01 (1%) */
  client_efficiency_rate?: number;
}

export interface FeeBreakdown {
  category: 'recovery' | 'lift' | 'efficiency';
  base_amount: number;
  rate: number;
  fee: number;
  line_items: Array<{ label: string; amount: number }>;
}

export interface MediaDrivenSalesResult {
  final_value: number;
  method: 'triangulated' | 'attribution_only' | 'modeled_only' | 'none';
  attribution_revenue: number;
  modeled_contribution: number;
  confidence: number;
}

export interface BillingResult {
  tier: TierRates;
  ad_spend: number;

  // Totals per stream
  total_recovery: number;
  total_lift: number;
  total_efficiency_savings: number;
  media_driven_sales: MediaDrivenSalesResult;

  // Fee breakdown
  recovery_fee: FeeBreakdown;
  lift_fee: FeeBreakdown;
  efficiency_fee: FeeBreakdown;

  // Grand total
  total_fee: number;
  fee_as_pct_of_spend: number;

  // Transparency
  value_delivered: number;
  roi_on_fee: number;
}

// ─── Tier Configuration ──────────────────────────────────────────────

export const BILLING_TIERS: TierRates[] = [
  {
    tier: 'starter',
    label: 'Starter',
    min_spend: 0,
    max_spend: 500_000,
    recovery_rate: 0.05,
    lift_rate: DEFAULT_CLIENT_RATE,
    efficiency_rate: DEFAULT_CLIENT_RATE,
  },
  {
    tier: 'growth',
    label: 'Growth',
    min_spend: 500_000,
    max_spend: 2_000_000,
    recovery_rate: 0.045,
    lift_rate: DEFAULT_CLIENT_RATE,
    efficiency_rate: DEFAULT_CLIENT_RATE,
  },
  {
    tier: 'scale',
    label: 'Scale',
    min_spend: 2_000_000,
    max_spend: 5_000_000,
    recovery_rate: 0.04,
    lift_rate: DEFAULT_CLIENT_RATE,
    efficiency_rate: DEFAULT_CLIENT_RATE,
  },
  {
    tier: 'enterprise',
    label: 'Enterprise',
    min_spend: 5_000_000,
    max_spend: null,
    recovery_rate: 0.03,
    lift_rate: DEFAULT_CLIENT_RATE,
    efficiency_rate: DEFAULT_CLIENT_RATE,
  },
];

// ─── Core Functions ─────────────────────────────────────────────────

/** Determine billing tier from total ad spend */
export function resolveTier(adSpend: number): TierRates {
  for (let i = BILLING_TIERS.length - 1; i >= 0; i--) {
    if (adSpend >= BILLING_TIERS[i]!.min_spend) {
      return BILLING_TIERS[i]!;
    }
  }
  return BILLING_TIERS[0]!;
}

/**
 * Triangulate Media-Driven Sales from two signals:
 * - attribution_revenue: direct attribution from executive-bridge revenue-translate
 * - modeled_contribution: modeled contribution from media-architect mmm-model
 *
 * Logic:
 * - Both available & within 30% → average (high confidence triangulation)
 * - Both available but divergent → use conservative (attribution), note modeled upside
 * - Only one available → use that signal at lower confidence
 * - Neither → zero
 */
export function triangulateMediaDrivenSales(
  input: MediaDrivenSalesInput,
): MediaDrivenSalesResult {
  const { attribution_revenue, modeled_contribution } = input;
  const hasAttribution = attribution_revenue > 0;
  const hasModeled = modeled_contribution > 0;

  if (!hasAttribution && !hasModeled) {
    return {
      final_value: 0,
      method: 'none',
      attribution_revenue: 0,
      modeled_contribution: 0,
      confidence: 0,
    };
  }

  if (hasAttribution && !hasModeled) {
    return {
      final_value: attribution_revenue,
      method: 'attribution_only',
      attribution_revenue,
      modeled_contribution: 0,
      confidence: 0.7,
    };
  }

  if (!hasAttribution && hasModeled) {
    return {
      final_value: modeled_contribution,
      method: 'modeled_only',
      attribution_revenue: 0,
      modeled_contribution,
      confidence: 0.6,
    };
  }

  // Both available — check convergence
  const max = Math.max(attribution_revenue, modeled_contribution);
  const min = Math.min(attribution_revenue, modeled_contribution);
  const divergence = (max - min) / max;

  if (divergence <= 0.30) {
    // Signals converge — high confidence triangulation
    const avg = (attribution_revenue + modeled_contribution) / 2;
    return {
      final_value: avg,
      method: 'triangulated',
      attribution_revenue,
      modeled_contribution,
      confidence: 0.9 - divergence, // 0.6-0.9 based on convergence
    };
  }

  // Signals diverge — use conservative (attribution) but acknowledge modeled upside
  return {
    final_value: attribution_revenue,
    method: 'triangulated',
    attribution_revenue,
    modeled_contribution,
    confidence: 0.5,
  };
}

/** Sum recovery sources, floor at zero per line item */
function computeRecovery(input: RecoveryInput): {
  total: number;
  items: Array<{ label: string; amount: number }>;
} {
  const items = [
    { label: 'Waste detected (Leak Detector)', amount: Math.max(0, input.waste_total) },
    { label: 'Quality waste (Leak Detector)', amount: Math.max(0, input.quality_waste) },
    { label: 'Supply chain savings (Leak Detector)', amount: Math.max(0, input.supply_chain_savings) },
    { label: 'CPA overshoot savings (Campaign Ops)', amount: Math.max(0, input.cpa_overshoot_savings) },
    { label: 'Reallocation savings (Campaign Ops)', amount: Math.max(0, input.reallocation_savings) },
    { label: 'Measurement waste (Executive Bridge)', amount: Math.max(0, input.measurement_waste) },
  ].filter((i) => i.amount > 0);

  return { total: items.reduce((sum, i) => sum + i.amount, 0), items };
}

/**
 * Compute lift fee base.
 *
 * Lift has two independent components:
 *   1. KPI lift from optimization (Media Architect) — additive, always counted
 *   2. Media contribution signal — the MAX of { ROAS lift, ROI lift, MDS }
 *      These three are different views of the same underlying value
 *      (how much revenue media/advertising contributes), so we take
 *      the highest signal to avoid double-counting.
 *
 * C-Levels and directors care about ONE number: how much did media contribute
 * to sales. That's MDS, ROAS lift, or ROI lift — whichever is largest.
 */
function computeLift(
  input: LiftInput,
  mds: MediaDrivenSalesResult,
): { total: number; items: Array<{ label: string; amount: number }> } {
  const kpiLift = Math.max(0, input.kpi_lift_dollars);

  // Pick the max media contribution signal (these overlap — not additive)
  const roasLift = Math.max(0, input.roas_lift_dollars);
  const roiLift = Math.max(0, input.roi_lift_dollars);
  const mdsValue = Math.max(0, mds.final_value);
  const mediaContribution = Math.max(roasLift, roiLift, mdsValue);

  // Identify which signal won for transparency
  let mediaLabel: string;
  if (mediaContribution === mdsValue && mdsValue > 0) {
    mediaLabel = `Media-Driven Sales (${mds.method})`;
  } else if (mediaContribution === roiLift && roiLift > 0) {
    mediaLabel = 'ROI improvement value';
  } else if (mediaContribution === roasLift && roasLift > 0) {
    mediaLabel = 'ROAS improvement value';
  } else {
    mediaLabel = 'Media contribution';
  }

  const items = [
    ...(kpiLift > 0 ? [{ label: 'KPI lift from optimization (Media Architect)', amount: kpiLift }] : []),
    ...(mediaContribution > 0 ? [{ label: mediaLabel, amount: mediaContribution }] : []),
  ];

  return { total: items.reduce((sum, i) => sum + i.amount, 0), items };
}

/** Sum efficiency savings */
function computeEfficiency(input: EfficiencyInput): {
  total: number;
  items: Array<{ label: string; amount: number }>;
} {
  const items = [
    { label: 'CPC reduction savings', amount: Math.max(0, input.cpc_savings) },
    { label: 'CPM optimization savings', amount: Math.max(0, input.cpm_savings) },
    { label: 'CTR improvement revenue impact', amount: Math.max(0, input.ctr_revenue_impact) },
    { label: 'Viewability improvement savings', amount: Math.max(0, input.viewability_savings) },
    { label: 'Brand safety improvement savings', amount: Math.max(0, input.brand_safety_savings) },
  ].filter((i) => i.amount > 0);

  return { total: items.reduce((sum, i) => sum + i.amount, 0), items };
}

// ─── Main Calculator ────────────────────────────────────────────────

/**
 * Calculate outcome-based billing from engine results.
 *
 * This is the core monetization function of OpenAgency.
 * It takes the value delivered by all 4 engines and computes
 * transparent, outcome-aligned fees.
 *
 * The fee structure ensures OpenAgency only earns when the client wins:
 * - Recovery fee: we found waste → client saves money → we take a cut
 * - Lift fee: we improved ROAS/ROI/MDS → client earns more → we take a cut
 * - Efficiency fee: we improved digital metrics → client saves on execution → we take a cut
 */
export function calculateBilling(input: BillingInput): BillingResult {
  const tier = resolveTier(input.ad_spend);

  // ─── Client-selected rates for Lift & Efficiency (clamped to 0.5%-1.5%)
  const liftRate = clampRate(input.client_lift_rate ?? DEFAULT_CLIENT_RATE);
  const efficiencyRate = clampRate(input.client_efficiency_rate ?? DEFAULT_CLIENT_RATE);

  // ─── Media-Driven Sales triangulation
  const mds = triangulateMediaDrivenSales(input.lift.media_driven_sales);

  // ─── Recovery stream (tiered by spend, 3-5%)
  const recovery = computeRecovery(input.recovery);
  const recoveryFee: FeeBreakdown = {
    category: 'recovery',
    base_amount: recovery.total,
    rate: tier.recovery_rate,
    fee: round(recovery.total * tier.recovery_rate),
    line_items: recovery.items,
  };

  // ─── Lift stream (client-selected rate, 0.5-1.5%)
  const lift = computeLift(input.lift, mds);
  const liftFee: FeeBreakdown = {
    category: 'lift',
    base_amount: lift.total,
    rate: liftRate,
    fee: round(lift.total * liftRate),
    line_items: lift.items,
  };

  // ─── Efficiency stream (client-selected rate, 0.5-1.5%)
  const efficiency = computeEfficiency(input.efficiency);
  const efficiencyFee: FeeBreakdown = {
    category: 'efficiency',
    base_amount: efficiency.total,
    rate: efficiencyRate,
    fee: round(efficiency.total * efficiencyRate),
    line_items: efficiency.items,
  };

  // ─── Totals
  const totalFee = recoveryFee.fee + liftFee.fee + efficiencyFee.fee;
  const valueDelivered = recovery.total + lift.total + efficiency.total;

  return {
    tier,
    ad_spend: input.ad_spend,

    total_recovery: recovery.total,
    total_lift: lift.total,
    total_efficiency_savings: efficiency.total,
    media_driven_sales: mds,

    recovery_fee: recoveryFee,
    lift_fee: liftFee,
    efficiency_fee: efficiencyFee,

    total_fee: totalFee,
    fee_as_pct_of_spend: input.ad_spend > 0 ? round((totalFee / input.ad_spend) * 100) : 0,

    value_delivered: valueDelivered,
    roi_on_fee: totalFee > 0 ? round(valueDelivered / totalFee) : 0,
  };
}

// ─── Engine Output Extractors ───────────────────────────────────────
// These helpers pull billing-relevant $ values from raw engine outputs.
// They're defensive — handle missing fields gracefully.

/** Extract recovery inputs from Leak Detector engine outputs */
export function extractLeakDetectorRecovery(
  wasteResult?: Record<string, unknown>,
  qualityResult?: Record<string, unknown>,
  supplyChainResult?: Record<string, unknown>,
): Pick<RecoveryInput, 'waste_total' | 'quality_waste' | 'supply_chain_savings'> {
  let wasteTotal = 0;
  if (wasteResult) {
    const summary = wasteResult['waste_summary'] as Record<string, unknown> | undefined;
    wasteTotal = Number(summary?.['total_waste'] ?? 0);
  }

  let qualityWaste = 0;
  if (qualityResult) {
    const channels = qualityResult['channels'] as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(channels)) {
      qualityWaste = channels.reduce(
        (sum, ch) => sum + Number(ch['quality_waste_dollars'] ?? 0),
        0,
      );
    }
  }

  let supplyChainSavings = 0;
  if (supplyChainResult) {
    const recs = supplyChainResult['spo_recommendations'] as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(recs)) {
      supplyChainSavings = recs.reduce(
        (sum, r) => sum + Number(r['estimated_savings'] ?? 0),
        0,
      );
    }
  }

  return { waste_total: wasteTotal, quality_waste: qualityWaste, supply_chain_savings: supplyChainSavings };
}

/** Extract recovery inputs from Campaign Ops engine outputs */
export function extractCampaignOpsRecovery(
  analyzeResult?: Record<string, unknown>,
  reallocateResult?: Record<string, unknown>,
): Pick<RecoveryInput, 'cpa_overshoot_savings' | 'reallocation_savings'> {
  let cpaOvershootSavings = 0;
  if (analyzeResult) {
    const campaigns = analyzeResult['campaigns'] as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(campaigns)) {
      for (const camp of campaigns) {
        const alerts = camp['alerts'] as Array<Record<string, unknown>> | undefined;
        if (!Array.isArray(alerts)) continue;
        for (const alert of alerts) {
          if (alert['type'] === 'cpa_overshoot') {
            // savings = (actual_cpa - target_cpa) × conversions
            const actualCpa = Number(camp['actual_cpa'] ?? 0) || (Number(camp['spend'] ?? 0) / Math.max(1, Number(camp['conversions'] ?? 1)));
            const targetCpa = Number(camp['cpa_target'] ?? actualCpa);
            const conversions = Number(camp['conversions'] ?? 0);
            if (actualCpa > targetCpa) {
              cpaOvershootSavings += (actualCpa - targetCpa) * conversions;
            }
          }
        }
      }
    }
  }

  let reallocationSavings = 0;
  if (reallocateResult) {
    const recs = reallocateResult['recommendations'] as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(recs)) {
      reallocationSavings = recs.reduce(
        (sum, r) => sum + Math.abs(Number(r['amount'] ?? 0)),
        0,
      );
    }
  }

  return { cpa_overshoot_savings: cpaOvershootSavings, reallocation_savings: reallocationSavings };
}

/** Extract recovery inputs from Executive Bridge outputs */
export function extractExecutiveBridgeRecovery(
  reconcileResult?: Record<string, unknown>,
): Pick<RecoveryInput, 'measurement_waste'> {
  let measurementWaste = 0;
  if (reconcileResult) {
    const summary = reconcileResult['summary'] as Record<string, unknown> | undefined;
    measurementWaste = Number(summary?.['measurement_waste_dollars'] ?? 0);
  }
  return { measurement_waste: measurementWaste };
}

/** Extract lift inputs from Media Architect outputs */
export function extractMediaArchitectLift(
  optimizeResult?: Record<string, unknown>,
  mmmModelResult?: Record<string, unknown>,
): Pick<LiftInput, 'kpi_lift_dollars'> & { modeled_contribution: number } {
  let kpiLift = 0;
  if (optimizeResult) {
    const comparison = optimizeResult['comparison_vs_current'] as Record<string, unknown> | undefined;
    kpiLift = Number(comparison?.['kpi_lift'] ?? 0);
  }

  let modeledContribution = 0;
  if (mmmModelResult) {
    const channels = mmmModelResult['channels'] as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(channels)) {
      modeledContribution = channels.reduce(
        (sum, ch) => sum + Number(ch['estimated_contribution'] ?? 0),
        0,
      );
    }
  }

  return { kpi_lift_dollars: kpiLift, modeled_contribution: modeledContribution };
}

/** Extract lift inputs from Executive Bridge revenue-translate */
export function extractExecutiveBridgeLift(
  revenueResult?: Record<string, unknown>,
  adSpend?: number,
): Pick<LiftInput, 'roas_lift_dollars' | 'roi_lift_dollars'> & { attribution_revenue: number } {
  let roasLift = 0;
  let roiLift = 0;
  let attributionRevenue = 0;

  if (revenueResult) {
    // Handle both field names: l1_financial (schema) and l1_metrics (engine output)
    const l1 = (revenueResult['l1_financial'] ?? revenueResult['l1_metrics']) as Record<string, unknown> | undefined;
    const spend = adSpend ?? Number(revenueResult['total_spend'] ?? 0);

    if (l1) {
      // ROAS: try direct field, else compute from total_revenue / total_spend
      let roas = Number(l1['roas'] ?? 0);
      if (!roas && l1['total_revenue'] && l1['total_spend']) {
        const totalSpend = Number(l1['total_spend']);
        if (totalSpend > 0) roas = Number(l1['total_revenue']) / totalSpend;
      }
      const baselineRoas = 2.0;
      if (roas > baselineRoas && spend > 0) {
        roasLift = (roas - baselineRoas) * spend;
      }

      const roiPct = Number(l1['roi_pct'] ?? 0);
      if (roiPct > 0 && spend > 0) {
        roiLift = (roiPct / 100) * spend;
      }
    }

    // Total media-attributed revenue
    const channels = revenueResult['channels'] as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(channels)) {
      attributionRevenue = channels.reduce(
        (sum, ch) => sum + Number(ch['revenue'] ?? 0),
        0,
      );
    }
  }

  return { roas_lift_dollars: roasLift, roi_lift_dollars: roiLift, attribution_revenue: attributionRevenue };
}

/** Extract efficiency savings from engine outputs */
export function extractEfficiencySavings(
  analyzeResult?: Record<string, unknown>,
  qualityResult?: Record<string, unknown>,
): EfficiencyInput {
  // From media-quality-score remediation actions
  let viewabilitySavings = 0;
  let brandSafetySavings = 0;
  if (qualityResult) {
    const actions = qualityResult['remediation_actions'] as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(actions)) {
      for (const action of actions) {
        const savings = Number(action['estimated_savings'] ?? 0);
        const category = String(action['category'] ?? '');
        if (category === 'viewability') viewabilitySavings += savings;
        else if (category === 'brand_safety') brandSafetySavings += savings;
      }
    }
  }

  // CPC/CPM savings from optimization-analyze deltas
  let cpcSavings = 0;
  let cpmSavings = 0;
  let ctrRevenueImpact = 0;
  if (analyzeResult) {
    const campaigns = analyzeResult['campaigns'] as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(campaigns)) {
      for (const camp of campaigns) {
        const alerts = camp['alerts'] as Array<Record<string, unknown>> | undefined;
        if (!Array.isArray(alerts)) continue;
        for (const alert of alerts) {
          const savings = Number(alert['potential_savings'] ?? 0);
          const type = String(alert['type'] ?? '');
          if (type === 'cpc_reduction') cpcSavings += savings;
          else if (type === 'cpm_optimization') cpmSavings += savings;
          else if (type === 'ctr_improvement') ctrRevenueImpact += savings;
        }
      }
    }
  }

  return {
    cpc_savings: cpcSavings,
    cpm_savings: cpmSavings,
    ctr_revenue_impact: ctrRevenueImpact,
    viewability_savings: viewabilitySavings,
    brand_safety_savings: brandSafetySavings,
  };
}

// ─── Convenience: All-in-One from Engine Outputs ─────────────────────

export interface EngineOutputs {
  ad_spend: number;
  /** Client-selected lift fee rate (0.005-0.015). Default: 0.01 (1%) */
  client_lift_rate?: number;
  /** Client-selected efficiency fee rate (0.005-0.015). Default: 0.01 (1%) */
  client_efficiency_rate?: number;
  leak_detector?: {
    waste_waterfall?: Record<string, unknown>;
    waste_estimate?: Record<string, unknown>;
    waste_compare?: Record<string, unknown>;
    media_quality_score?: Record<string, unknown>;
    supply_chain_audit?: Record<string, unknown>;
  };
  media_architect?: {
    benchmark_health?: Record<string, unknown>;
    anomaly_detect?: Record<string, unknown>;
    channel_optimize?: Record<string, unknown>;
    channel_scenario?: Record<string, unknown>;
    mmm_pre_model?: Record<string, unknown>;
    mmm_model?: Record<string, unknown>;
    mmm_post_model?: Record<string, unknown>;
    mmm_optimize?: Record<string, unknown>;
    media_plan?: Record<string, unknown>;
  };
  campaign_ops?: {
    campaign_create?: Record<string, unknown>;
    campaign_update_task?: Record<string, unknown>;
    campaign_summary?: Record<string, unknown>;
    campaign_next_actions?: Record<string, unknown>;
    optimization_analyze?: Record<string, unknown>;
    optimization_reallocate?: Record<string, unknown>;
  };
  executive_bridge?: {
    revenue_translate?: Record<string, unknown>;
    revenue_compare?: Record<string, unknown>;
    shapley_attribute?: Record<string, unknown>;
    shapley_compare?: Record<string, unknown>;
    reconcile?: Record<string, unknown>;
    integrity?: Record<string, unknown>;
    geo_lift?: Record<string, unknown>;
    conversion_lift?: Record<string, unknown>;
    holdout?: Record<string, unknown>;
  };
}

/**
 * Calculate billing directly from raw engine outputs.
 * This is the primary entry point for the scorecard integration.
 *
 * Usage:
 *   const result = calculateBillingFromEngines({
 *     ad_spend: 2_500_000,
 *     leak_detector: { waste_waterfall: wasteResult, ... },
 *     media_architect: { mmm_optimize: optimizeResult, ... },
 *     campaign_ops: { optimization_analyze: analyzeResult, ... },
 *     executive_bridge: { reconcile: reconcileResult, revenue_translate: revenueResult },
 *   });
 */
export function calculateBillingFromEngines(outputs: EngineOutputs): BillingResult {
  const ld = outputs.leak_detector ?? {};
  const ma = outputs.media_architect ?? {};
  const co = outputs.campaign_ops ?? {};
  const eb = outputs.executive_bridge ?? {};

  const ldRecovery = extractLeakDetectorRecovery(
    ld.waste_waterfall,
    ld.media_quality_score,
    ld.supply_chain_audit,
  );

  const coRecovery = extractCampaignOpsRecovery(
    co.optimization_analyze,
    co.optimization_reallocate,
  );

  const ebRecovery = extractExecutiveBridgeRecovery(eb.reconcile);

  const maLift = extractMediaArchitectLift(ma.mmm_optimize, ma.mmm_model);
  const ebLift = extractExecutiveBridgeLift(eb.revenue_translate, outputs.ad_spend);

  const efficiency = extractEfficiencySavings(
    co.optimization_analyze,
    ld.media_quality_score,
  );

  return calculateBilling({
    ad_spend: outputs.ad_spend,
    recovery: {
      ...ldRecovery,
      ...coRecovery,
      ...ebRecovery,
    },
    lift: {
      kpi_lift_dollars: maLift.kpi_lift_dollars,
      roas_lift_dollars: ebLift.roas_lift_dollars,
      roi_lift_dollars: ebLift.roi_lift_dollars,
      media_driven_sales: {
        attribution_revenue: ebLift.attribution_revenue,
        modeled_contribution: maLift.modeled_contribution,
      },
    },
    efficiency,
    client_lift_rate: outputs.client_lift_rate,
    client_efficiency_rate: outputs.client_efficiency_rate,
  });
}

// ─── Helpers ────────────────────────────────────────────────────────

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Clamp client rate to valid range (0.5%-1.5%) */
function clampRate(rate: number): number {
  return Math.min(MAX_CLIENT_RATE, Math.max(MIN_CLIENT_RATE, rate));
}
