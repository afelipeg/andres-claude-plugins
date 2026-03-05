// ─── E2E Pipeline Tests ────────────────────────────────────────────
// Full pipeline: upload data → engines → scorecard → accept/reject.
// Tests the OpenAgency core flow without external services.

import { describe, it, expect, beforeAll } from 'vitest';
import { OpenAgency } from '@openagency/core';
import { LeakDetectorEngine } from '@openagency/engines';
import { MediaArchitectEngine } from '@openagency/engines';
import { CampaignOpsEngine } from '@openagency/engines';
import { ExecutiveBridgeEngine } from '@openagency/engines';
import { calculateBillingFromEngines, type EngineOutputs } from '@openagency/core';

// ─── Test Data ─────────────────────────────────────────────────────

const TEST_AD_SPEND = 1_000_000;

// Waste waterfall expects: gross_spend + 6 waste categories as dollar amounts
const WASTE_WATERFALL_INPUT = {
  gross_spend: TEST_AD_SPEND,
  industry: 'retail' as const,
  actual_revenue: 2_000_000,
  non_working: { agency_fees: 80_000, tech_fees: 40_000, data_costs: 20_000 },
  supply_chain: { dsp_fees: 50_000, ssp_fees: 30_000, hidden_margins: 10_000 },
  quality: { fraud: 40_000, non_viewable: 30_000, brand_unsafe: 10_000, mfa: 30_000 },
  audience: { off_target: 50_000, frequency_waste: 20_000, duplication: 10_000 },
  optimization: { poor_pacing: 20_000, stale_creative: 15_000, wrong_bids: 15_000 },
  measurement: { misattributed: 15_000, overcounted: 15_000 },
};

// MMM optimize expects: total_budget + channels with name/spend
const CHANNEL_DATA = {
  total_budget: TEST_AD_SPEND,
  channels: [
    { name: 'Meta Ads', spend: 400_000 },
    { name: 'Google Ads', spend: 350_000 },
    { name: 'TikTok Ads', spend: 150_000 },
    { name: 'DV360', spend: 100_000 },
  ],
};

// Optimization analyze expects: campaigns with name/channel/spend/budget/cpa_target/roas_target
const OPTIMIZATION_INPUT = {
  campaigns: [
    { name: 'Brand Campaign', channel: 'meta_ads', budget: 200_000, spend: 180_000, impressions: 10_000_000, clicks: 100_000, conversions: 1000, revenue: 400_000, cpa_target: 150, roas_target: 3.0, historical_ctr: 0.012, days_elapsed: 20, days_total: 30 },
    { name: 'Performance Campaign', channel: 'google_ads', budget: 175_000, spend: 160_000, impressions: 8_000_000, clicks: 120_000, conversions: 1200, revenue: 500_000, cpa_target: 150, roas_target: 3.0, historical_ctr: 0.018, days_elapsed: 20, days_total: 30 },
  ],
};

// Reconcile expects: platforms with name/reported_*/actual_*/spend
const RECONCILE_INPUT = {
  platforms: [
    { name: 'Meta Ads', reported_conversions: 2000, actual_conversions: 1700, reported_revenue: 800_000, actual_revenue: 720_000, spend: 400_000 },
    { name: 'Google Ads', reported_conversions: 2500, actual_conversions: 2300, reported_revenue: 900_000, actual_revenue: 850_000, spend: 350_000 },
  ],
};

// Revenue translate expects: channels with name/spend/revenue/conversions/impressions/clicks
const REVENUE_INPUT = {
  channels: [
    { name: 'Meta Ads', spend: 400_000, revenue: 800_000, conversions: 2000, impressions: 20_000_000, clicks: 200_000 },
    { name: 'Google Ads', spend: 350_000, revenue: 900_000, conversions: 2500, impressions: 15_000_000, clicks: 250_000 },
  ],
};

// ─── Setup ─────────────────────────────────────────────────────────

let agency: OpenAgency;

beforeAll(() => {
  agency = new OpenAgency();
  agency.engines.register(new LeakDetectorEngine());
  agency.engines.register(new MediaArchitectEngine());
  agency.engines.register(new CampaignOpsEngine());
  agency.engines.register(new ExecutiveBridgeEngine());
});

// ─── Tests ─────────────────────────────────────────────────────────

describe('E2E: Full Pipeline', () => {
  it('lists all 4 engines with 29 skills', () => {
    const engines = agency.listEngines();
    expect(engines).toHaveLength(4);

    const totalSkills = engines.reduce((sum, e) => sum + e.skills.length, 0);
    expect(totalSkills).toBe(29);
  });

  it('runs leak-detector waste-waterfall', async () => {
    const result = await agency.run('leak-detector', 'waste-waterfall', WASTE_WATERFALL_INPUT);

    expect(result.engine).toBe('leak-detector');
    expect(result.skill).toBe('waste-waterfall');
    expect(result.data).toBeDefined();
    expect(result.duration_ms).toBeGreaterThanOrEqual(0);

    const data = result.data as Record<string, unknown>;
    const summary = data['waste_summary'] as Record<string, unknown>;
    expect(summary).toBeDefined();
    expect(typeof summary['total_waste']).toBe('number');
    expect(typeof summary['waste_pct']).toBe('number');

    // Waste + productive should equal gross spend
    const totalWaste = summary['total_waste'] as number;
    const productiveSpend = data['productive_spend'] as Record<string, unknown>;
    const productive = productiveSpend['amount'] as number;
    expect(Math.abs(totalWaste + productive - WASTE_WATERFALL_INPUT.gross_spend)).toBeLessThan(1);
  });

  it('runs media-architect mmm-optimize', async () => {
    const result = await agency.run('media-architect', 'mmm-optimize', CHANNEL_DATA);

    expect(result.engine).toBe('media-architect');
    expect(result.data).toBeDefined();

    const data = result.data as Record<string, unknown>;
    // mmm-optimize returns { scenarios, comparison_vs_current, optimized_allocation }
    expect(data['scenarios']).toBeDefined();
  });

  it('runs campaign-ops optimization-analyze', async () => {
    const result = await agency.run('campaign-ops', 'optimization-analyze', OPTIMIZATION_INPUT);

    expect(result.engine).toBe('campaign-ops');
    expect(result.data).toBeDefined();

    const data = result.data as Record<string, unknown>;
    expect(data['campaigns']).toBeDefined();
    expect(data['total_alerts']).toBeDefined();
  });

  it('runs executive-bridge reconcile', async () => {
    const result = await agency.run('executive-bridge', 'reconcile', RECONCILE_INPUT);

    expect(result.engine).toBe('executive-bridge');
    expect(result.data).toBeDefined();

    const data = result.data as Record<string, unknown>;
    expect(data['platforms']).toBeDefined();
    const summary = data['summary'] as Record<string, unknown>;
    expect(summary['overall_over_reporting_pct']).toBeDefined();
  });

  it('runs full 4-engine pipeline and calculates billing', async () => {
    // Run all 4 engines
    const [leakResult, mmmResult, campaignResult, reconcileResult, revenueResult] = await Promise.all([
      agency.run('leak-detector', 'waste-waterfall', WASTE_WATERFALL_INPUT),
      agency.run('media-architect', 'mmm-optimize', CHANNEL_DATA),
      agency.run('campaign-ops', 'optimization-analyze', OPTIMIZATION_INPUT),
      agency.run('executive-bridge', 'reconcile', RECONCILE_INPUT),
      agency.run('executive-bridge', 'revenue-translate', REVENUE_INPUT),
    ]);

    // All engines succeeded
    expect(leakResult.data).toBeDefined();
    expect(mmmResult.data).toBeDefined();
    expect(campaignResult.data).toBeDefined();
    expect(reconcileResult.data).toBeDefined();
    expect(revenueResult.data).toBeDefined();

    // Calculate billing from engine outputs
    const engineOutputs: EngineOutputs = {
      ad_spend: TEST_AD_SPEND,
      leak_detector: {
        waste_waterfall: leakResult.data as Record<string, unknown>,
      },
      media_architect: {
        mmm_optimize: mmmResult.data as Record<string, unknown>,
      },
      campaign_ops: {
        optimization_analyze: campaignResult.data as Record<string, unknown>,
      },
      executive_bridge: {
        reconcile: reconcileResult.data as Record<string, unknown>,
        revenue_translate: revenueResult.data as Record<string, unknown>,
      },
    };

    const billing = calculateBillingFromEngines(engineOutputs);

    // Billing structure checks
    expect(billing.ad_spend).toBe(TEST_AD_SPEND);
    expect(billing.tier).toBeDefined();
    expect(billing.tier.label).toBe('Growth'); // $1M → Growth tier
    expect(billing.total_fee).toBeGreaterThan(0);
    expect(billing.fee_as_pct_of_spend).toBeGreaterThan(0);
    expect(billing.roi_on_fee).toBeGreaterThan(0);
    expect(billing.value_delivered).toBeGreaterThan(0);

    // Fee breakdown
    expect(billing.recovery_fee).toBeDefined();
    expect(billing.lift_fee).toBeDefined();
    expect(billing.efficiency_fee).toBeDefined();
    expect(billing.total_fee).toBeCloseTo(
      billing.recovery_fee.fee + billing.lift_fee.fee + billing.efficiency_fee.fee,
      0,
    );
  });

  it('handles tier resolution correctly', () => {
    const tiers = [
      { spend: 100_000, expected: 'Starter' },
      { spend: 500_000, expected: 'Growth' },
      { spend: 2_000_000, expected: 'Scale' },
      { spend: 5_000_000, expected: 'Enterprise' },
    ];

    for (const { spend, expected } of tiers) {
      const billing = calculateBillingFromEngines({ ad_spend: spend });
      expect(billing.tier.label).toBe(expected);
    }
  });

  it('returns zero fees when no engine data provided', () => {
    const billing = calculateBillingFromEngines({ ad_spend: 500_000 });

    expect(billing.total_recovery).toBe(0);
    expect(billing.total_lift).toBe(0);
    expect(billing.total_efficiency_savings).toBe(0);
    expect(billing.total_fee).toBe(0);
  });
});
