import { describe, it, expect } from 'vitest';
import {
  calculateBilling,
  calculateBillingFromEngines,
  resolveTier,
  triangulateMediaDrivenSales,
  extractLeakDetectorRecovery,
  extractCampaignOpsRecovery,
  extractExecutiveBridgeRecovery,
  extractMediaArchitectLift,
  extractExecutiveBridgeLift,
  BILLING_TIERS,
} from '../src/billing.js';
import type { BillingInput } from '../src/billing.js';

// ─── Tier Resolution ────────────────────────────────────────────────

describe('resolveTier', () => {
  it('returns starter for spend under $500K', () => {
    expect(resolveTier(100_000).tier).toBe('starter');
    expect(resolveTier(499_999).tier).toBe('starter');
  });

  it('returns growth for $500K-$2M', () => {
    expect(resolveTier(500_000).tier).toBe('growth');
    expect(resolveTier(1_999_999).tier).toBe('growth');
  });

  it('returns scale for $2M-$5M', () => {
    expect(resolveTier(2_000_000).tier).toBe('scale');
    expect(resolveTier(4_999_999).tier).toBe('scale');
  });

  it('returns enterprise for $5M+', () => {
    expect(resolveTier(5_000_000).tier).toBe('enterprise');
    expect(resolveTier(50_000_000).tier).toBe('enterprise');
  });

  it('returns starter for zero spend', () => {
    expect(resolveTier(0).tier).toBe('starter');
  });

  it('tier rates match spec', () => {
    const starter = BILLING_TIERS[0]!;
    expect(starter.recovery_rate).toBe(0.05);
    expect(starter.lift_rate).toBe(0.20);
    expect(starter.efficiency_rate).toBe(0.10);

    const enterprise = BILLING_TIERS[3]!;
    expect(enterprise.recovery_rate).toBe(0.03);
    expect(enterprise.lift_rate).toBe(0.10);
    expect(enterprise.efficiency_rate).toBe(0.05);
  });
});

// ─── Media-Driven Sales Triangulation ───────────────────────────────

describe('triangulateMediaDrivenSales', () => {
  it('returns none when both signals are zero', () => {
    const result = triangulateMediaDrivenSales({ attribution_revenue: 0, modeled_contribution: 0 });
    expect(result.method).toBe('none');
    expect(result.final_value).toBe(0);
    expect(result.confidence).toBe(0);
  });

  it('uses attribution_only when only attribution available', () => {
    const result = triangulateMediaDrivenSales({ attribution_revenue: 500_000, modeled_contribution: 0 });
    expect(result.method).toBe('attribution_only');
    expect(result.final_value).toBe(500_000);
    expect(result.confidence).toBe(0.7);
  });

  it('uses modeled_only when only model available', () => {
    const result = triangulateMediaDrivenSales({ attribution_revenue: 0, modeled_contribution: 600_000 });
    expect(result.method).toBe('modeled_only');
    expect(result.final_value).toBe(600_000);
    expect(result.confidence).toBe(0.6);
  });

  it('triangulates (average) when signals converge within 30%', () => {
    const result = triangulateMediaDrivenSales({ attribution_revenue: 500_000, modeled_contribution: 550_000 });
    expect(result.method).toBe('triangulated');
    expect(result.final_value).toBe(525_000); // average
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it('uses conservative (attribution) when signals diverge >30%', () => {
    const result = triangulateMediaDrivenSales({ attribution_revenue: 300_000, modeled_contribution: 600_000 });
    expect(result.method).toBe('triangulated');
    expect(result.final_value).toBe(300_000); // conservative
    expect(result.confidence).toBe(0.5);
  });
});

// ─── Full Billing Calculation ───────────────────────────────────────

describe('calculateBilling', () => {
  const baseInput: BillingInput = {
    ad_spend: 2_500_000, // Scale tier
    recovery: {
      waste_total: 125_000,
      quality_waste: 50_000,
      supply_chain_savings: 30_000,
      cpa_overshoot_savings: 20_000,
      reallocation_savings: 15_000,
      measurement_waste: 40_000,
    },
    lift: {
      kpi_lift_dollars: 200_000,
      roas_lift_dollars: 150_000,
      roi_lift_dollars: 100_000,
      media_driven_sales: {
        attribution_revenue: 500_000,
        modeled_contribution: 550_000,
      },
    },
    efficiency: {
      cpc_savings: 10_000,
      cpm_savings: 8_000,
      ctr_revenue_impact: 5_000,
      viewability_savings: 12_000,
      brand_safety_savings: 7_000,
    },
  };

  it('resolves Scale tier for $2.5M spend', () => {
    const result = calculateBilling(baseInput);
    expect(result.tier.tier).toBe('scale');
    expect(result.ad_spend).toBe(2_500_000);
  });

  it('calculates recovery fee at 4% (Scale tier)', () => {
    const result = calculateBilling(baseInput);
    const expectedRecovery = 125_000 + 50_000 + 30_000 + 20_000 + 15_000 + 40_000; // $280,000
    expect(result.total_recovery).toBe(expectedRecovery);
    expect(result.recovery_fee.rate).toBe(0.04);
    expect(result.recovery_fee.fee).toBe(280_000 * 0.04); // $11,200
  });

  it('calculates lift fee at 14% (Scale tier) with MDS triangulation', () => {
    const result = calculateBilling(baseInput);
    // MDS triangulates to average of 500K and 550K = 525K (within 30%)
    const expectedLift = 200_000 + 150_000 + 100_000 + 525_000; // $975,000
    expect(result.total_lift).toBe(expectedLift);
    expect(result.lift_fee.rate).toBe(0.14);
    expect(result.lift_fee.fee).toBe(975_000 * 0.14); // $136,500
  });

  it('calculates efficiency fee at 7% (Scale tier)', () => {
    const result = calculateBilling(baseInput);
    const expectedEfficiency = 10_000 + 8_000 + 5_000 + 12_000 + 7_000; // $42,000
    expect(result.total_efficiency_savings).toBe(expectedEfficiency);
    expect(result.efficiency_fee.rate).toBe(0.07);
    expect(result.efficiency_fee.fee).toBe(2940); // 42,000 × 7%
  });

  it('total fee is sum of three streams', () => {
    const result = calculateBilling(baseInput);
    const expected = result.recovery_fee.fee + result.lift_fee.fee + result.efficiency_fee.fee;
    expect(result.total_fee).toBe(expected);
  });

  it('computes fee as % of spend', () => {
    const result = calculateBilling(baseInput);
    expect(result.fee_as_pct_of_spend).toBeGreaterThan(0);
    expect(result.fee_as_pct_of_spend).toBeLessThan(20);
  });

  it('computes ROI on fee (value delivered / fee)', () => {
    const result = calculateBilling(baseInput);
    expect(result.roi_on_fee).toBeGreaterThan(1);
    expect(result.value_delivered).toBe(result.total_recovery + result.total_lift + result.total_efficiency_savings);
  });

  it('line items are transparent — every positive source listed', () => {
    const result = calculateBilling(baseInput);
    expect(result.recovery_fee.line_items.length).toBe(6);
    expect(result.lift_fee.line_items.length).toBe(4);
    expect(result.efficiency_fee.line_items.length).toBe(5);
  });

  it('uses Starter rates for small spend', () => {
    const result = calculateBilling({ ...baseInput, ad_spend: 100_000 });
    expect(result.tier.tier).toBe('starter');
    expect(result.recovery_fee.rate).toBe(0.05);
    expect(result.lift_fee.rate).toBe(0.20);
    expect(result.efficiency_fee.rate).toBe(0.10);
  });

  it('uses Enterprise rates for large spend', () => {
    const result = calculateBilling({ ...baseInput, ad_spend: 10_000_000 });
    expect(result.tier.tier).toBe('enterprise');
    expect(result.recovery_fee.rate).toBe(0.03);
    expect(result.lift_fee.rate).toBe(0.10);
    expect(result.efficiency_fee.rate).toBe(0.05);
  });

  it('handles zero values gracefully', () => {
    const result = calculateBilling({
      ad_spend: 1_000_000,
      recovery: { waste_total: 0, quality_waste: 0, supply_chain_savings: 0, cpa_overshoot_savings: 0, reallocation_savings: 0, measurement_waste: 0 },
      lift: { kpi_lift_dollars: 0, roas_lift_dollars: 0, roi_lift_dollars: 0, media_driven_sales: { attribution_revenue: 0, modeled_contribution: 0 } },
      efficiency: { cpc_savings: 0, cpm_savings: 0, ctr_revenue_impact: 0, viewability_savings: 0, brand_safety_savings: 0 },
    });
    expect(result.total_fee).toBe(0);
    expect(result.value_delivered).toBe(0);
    expect(result.roi_on_fee).toBe(0);
  });

  it('floors negative values at zero', () => {
    const result = calculateBilling({
      ad_spend: 1_000_000,
      recovery: { waste_total: -5000, quality_waste: 10_000, supply_chain_savings: 0, cpa_overshoot_savings: 0, reallocation_savings: 0, measurement_waste: 0 },
      lift: { kpi_lift_dollars: 0, roas_lift_dollars: 0, roi_lift_dollars: 0, media_driven_sales: { attribution_revenue: 0, modeled_contribution: 0 } },
      efficiency: { cpc_savings: 0, cpm_savings: 0, ctr_revenue_impact: 0, viewability_savings: 0, brand_safety_savings: 0 },
    });
    expect(result.total_recovery).toBe(10_000); // negative waste_total excluded
    expect(result.recovery_fee.line_items.length).toBe(1); // only quality_waste
  });
});

// ─── Engine Output Extractors ───────────────────────────────────────

describe('extractLeakDetectorRecovery', () => {
  it('extracts waste_total from waste_waterfall output', () => {
    const result = extractLeakDetectorRecovery(
      { waste_summary: { total_waste: 125_000 } },
    );
    expect(result.waste_total).toBe(125_000);
  });

  it('sums quality_waste_dollars across channels', () => {
    const result = extractLeakDetectorRecovery(
      undefined,
      { channels: [{ quality_waste_dollars: 20_000 }, { quality_waste_dollars: 15_000 }] },
    );
    expect(result.quality_waste).toBe(35_000);
  });

  it('sums supply chain SPO savings', () => {
    const result = extractLeakDetectorRecovery(
      undefined, undefined,
      { spo_recommendations: [{ estimated_savings: 10_000 }, { estimated_savings: 5_000 }] },
    );
    expect(result.supply_chain_savings).toBe(15_000);
  });

  it('returns zeros for missing data', () => {
    const result = extractLeakDetectorRecovery();
    expect(result.waste_total).toBe(0);
    expect(result.quality_waste).toBe(0);
    expect(result.supply_chain_savings).toBe(0);
  });
});

describe('extractCampaignOpsRecovery', () => {
  it('extracts reallocation amounts', () => {
    const result = extractCampaignOpsRecovery(
      undefined,
      { recommendations: [{ amount: 5000 }, { amount: 3000 }] },
    );
    expect(result.reallocation_savings).toBe(8000);
  });
});

describe('extractExecutiveBridgeRecovery', () => {
  it('extracts measurement_waste_dollars', () => {
    const result = extractExecutiveBridgeRecovery(
      { summary: { measurement_waste_dollars: 40_000 } },
    );
    expect(result.measurement_waste).toBe(40_000);
  });
});

describe('extractMediaArchitectLift', () => {
  it('extracts kpi_lift from mmm_optimize', () => {
    const result = extractMediaArchitectLift(
      { comparison_vs_current: { kpi_lift: 200_000 } },
    );
    expect(result.kpi_lift_dollars).toBe(200_000);
  });

  it('sums modeled_contribution from mmm_model channels', () => {
    const result = extractMediaArchitectLift(
      undefined,
      { channels: [{ estimated_contribution: 300_000 }, { estimated_contribution: 200_000 }] },
    );
    expect(result.modeled_contribution).toBe(500_000);
  });
});

describe('extractExecutiveBridgeLift', () => {
  it('extracts ROAS lift above baseline', () => {
    const result = extractExecutiveBridgeLift(
      { l1_financial: { roas: 4.0, roi_pct: 50 }, channels: [{ revenue: 800_000 }] },
      1_000_000,
    );
    // ROAS lift = (4.0 - 2.0) × 1M = $2M
    expect(result.roas_lift_dollars).toBe(2_000_000);
    expect(result.roi_lift_dollars).toBe(500_000); // 50% × 1M
    expect(result.attribution_revenue).toBe(800_000);
  });
});

// ─── Full End-to-End: calculateBillingFromEngines ───────────────────

describe('calculateBillingFromEngines', () => {
  it('produces complete billing from raw engine outputs', () => {
    const result = calculateBillingFromEngines({
      ad_spend: 5_000_000, // Enterprise tier
      leak_detector: {
        waste_waterfall: { waste_summary: { total_waste: 250_000 } },
        media_quality_score: { channels: [{ quality_waste_dollars: 75_000 }] },
        supply_chain_audit: { spo_recommendations: [{ estimated_savings: 40_000 }] },
      },
      media_architect: {
        mmm_optimize: { comparison_vs_current: { kpi_lift: 300_000 } },
        mmm_model: { channels: [{ estimated_contribution: 900_000 }] },
      },
      campaign_ops: {
        optimization_reallocate: { recommendations: [{ amount: 25_000 }] },
      },
      executive_bridge: {
        reconcile: { summary: { measurement_waste_dollars: 60_000 } },
        revenue_translate: {
          l1_financial: { roas: 3.5, roi_pct: 40 },
          channels: [{ revenue: 1_200_000 }],
        },
      },
    });

    expect(result.tier.tier).toBe('enterprise');
    expect(result.total_recovery).toBeGreaterThan(0);
    expect(result.total_lift).toBeGreaterThan(0);
    expect(result.total_fee).toBeGreaterThan(0);
    expect(result.media_driven_sales.method).not.toBe('none');
    expect(result.fee_as_pct_of_spend).toBeGreaterThan(0);
    expect(result.roi_on_fee).toBeGreaterThan(1);

    // Enterprise rates
    expect(result.recovery_fee.rate).toBe(0.03);
    expect(result.lift_fee.rate).toBe(0.10);
    expect(result.efficiency_fee.rate).toBe(0.05);
  });

  it('handles missing engine outputs gracefully', () => {
    const result = calculateBillingFromEngines({
      ad_spend: 100_000,
    });
    expect(result.total_fee).toBe(0);
    expect(result.tier.tier).toBe('starter');
  });
});
