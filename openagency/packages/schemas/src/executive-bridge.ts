// ─── Executive Bridge Schemas ───────────────────────────────────────

import { z } from 'zod';
import { CSuiteSummarySchema } from './common.js';

// ─── Shapley Attribution ────────────────────────────────────────────

export const ShapleyInputSchema = z.object({
  channels: z.array(z.string()),
  coalition_conversions: z.record(z.string(), z.number()),
  total_conversions: z.number(),
});

export const ShapleyOutputSchema = z.object({
  total_conversions: z.number(),
  shapley_total: z.number(),
  channels: z.array(
    z.object({
      channel: z.string(),
      shapley_value: z.number(),
      shapley_share_pct: z.number(),
      last_click_conversions: z.number(),
      last_click_share_pct: z.number(),
      difference_pct: z.number(),
      credit_status: z.enum([
        'under-credited by last-click',
        'over-credited by last-click',
        'fairly credited',
      ]),
    }),
  ),
});

// FIX 5: Shapley Compare — matches actual compare() in shapley-attribution.ts
// Input: { channels: [{ name, shapley_share, last_click_share, spend }] }
// Output: { comparison: [{ channel, spend, shapley_share, last_click_share, shapley_efficiency, last_click_efficiency, recommendation }] }
export const ShapleyCompareInputSchema = z.object({
  channels: z.array(z.object({
    name: z.string(),
    shapley_share: z.number(),
    last_click_share: z.number(),
    spend: z.number(),
  })),
});

export const ShapleyCompareOutputSchema = z.object({
  comparison: z.array(
    z.object({
      channel: z.string(),
      spend: z.number(),
      shapley_share: z.number(),
      last_click_share: z.number(),
      shapley_efficiency: z.number(),
      last_click_efficiency: z.number(),
      recommendation: z.string(),
    }),
  ),
});

// ─── Revenue Bridge ─────────────────────────────────────────────────

const RevenueBridgeChannelInputSchema = z.object({
  name: z.string(),
  spend: z.number(),
  impressions: z.number(),
  clicks: z.number(),
  conversions: z.number(),
  revenue: z.number().optional(),
});

export const RevenueBridgeInputSchema = z.object({
  channels: z.array(RevenueBridgeChannelInputSchema),
  aov: z.number().optional(),
  retention_rate: z.number().optional(),
  avg_customer_months: z.number().optional(),
  baseline_pct: z.number().min(0).max(1).optional().describe('Organic baseline as fraction (0-1). E.g. 0.535 = 53.5% of revenue is organic. From MMM baseline decomposition.'),
});

const L3MetricsSchema = z.object({
  cpm: z.number().optional(),
  cpc: z.number().optional(),
  ctr: z.number().optional(),
  cvr: z.number().optional(),
});

const L2MetricsSchema = z.object({
  cpa: z.number(),
  roas: z.number(),
  aov: z.number(),
  conversions: z.number(),
});

const L1MetricsSchema = z.object({
  cac: z.number(),
  clv: z.number(),
  clv_cac_ratio: z.number(),
  roi_pct: z.number(),
  marketing_margin_pct: z.number(),
  total_revenue: z.number(),
  total_spend: z.number(),
  incremental: z.object({
    baseline_pct: z.number(),
    incremental_revenue: z.number(),
    iroas: z.number(),
    iroi_pct: z.number(),
    imarketing_margin_pct: z.number(),
    iclv_cac_ratio: z.number(),
    icac: z.number(),
  }).optional(),
});

export const RevenueBridgeOutputSchema = z.object({
  l1_metrics: L1MetricsSchema,
  efficiency_score: z.number(),
  channels: z.array(
    z.object({
      channel: z.string(),
      spend: z.number(),
      revenue: z.number(),
      l3_metrics: L3MetricsSchema,
      l2_metrics: L2MetricsSchema,
    }),
  ),
  csuite_summary: CSuiteSummarySchema,
  baseline_warning: z.string().optional(),
});

// FIX 5: Revenue Compare — matches actual compareChannels() in revenue-bridge.ts
// Input: { channels: [{ name, spend, revenue, conversions }] }
// Output: { comparison: [{ channel, spend, revenue, roas, cpa, efficiency_rank }] }
export const RevenueCompareInputSchema = z.object({
  channels: z.array(z.object({
    name: z.string(),
    spend: z.number(),
    revenue: z.number(),
    conversions: z.number(),
  })),
});

export const RevenueCompareOutputSchema = z.object({
  comparison: z.array(
    z.object({
      channel: z.string(),
      spend: z.number(),
      revenue: z.number(),
      roas: z.number(),
      cpa: z.number(),
      efficiency_rank: z.number(),
    }),
  ),
});

// ─── Revenue Reconciliation ─────────────────────────────────────────

const ReconcilePlatformInputSchema = z.object({
  name: z.string(),
  reported_conversions: z.number(),
  reported_revenue: z.number(),
  actual_conversions: z.number(),
  actual_revenue: z.number(),
  spend: z.number(),
});

export const ReconcileInputSchema = z.object({
  platforms: z.array(ReconcilePlatformInputSchema),
});

export const ReconcileOutputSchema = z.object({
  platforms: z.array(
    z.object({
      platform: z.string(),
      reported_conversions: z.number(),
      actual_conversions: z.number(),
      conversion_correction_factor: z.number(),
      over_reporting_conversions_pct: z.number(),
      reported_revenue: z.number(),
      actual_revenue: z.number(),
      revenue_correction_factor: z.number(),
      over_reporting_revenue_pct: z.number(),
      reported_roas: z.number(),
      adjusted_roas: z.number(),
      data_integrity_score: z.number(),
    }),
  ),
  summary: z.object({
    total_reported_revenue: z.number(),
    total_actual_revenue: z.number(),
    overall_correction_factor: z.number(),
    overall_over_reporting_pct: z.number(),
    total_reported_conversions: z.number(),
    total_actual_conversions: z.number(),
    measurement_waste_dollars: z.number(),
  }),
});

export const IntegrityInputSchema = z.object({
  tracking_coverage_pct: z.number(),
  cookie_consent_rate_pct: z.number(),
  attribution_window_days: z.number(),
  cross_device_enabled: z.boolean(),
  offline_conversion_import: z.boolean(),
});

export const IntegrityOutputSchema = z.object({
  integrity_score: z.number(),
  dimension_scores: z.object({
    tracking_coverage: z.number(),
    consent_rate: z.number(),
    attribution_window: z.number(),
    cross_device: z.number(),
    offline_integration: z.number(),
  }),
  recommendations: z.array(z.string()),
});

// ─── Power Analysis ─────────────────────────────────────────────────

export const GeoLiftInputSchema = z.object({
  daily_conversions: z.number().positive(),
  expected_lift_pct: z.number(),
  test_duration_days: z.number(),
  geo_pairs: z.number(),
  significance_level: z.number().optional(),
  revenue_per_conversion: z.number().optional(),
});

export const GeoLiftOutputSchema = z.object({
  test_type: z.literal('geo_lift'),
  daily_conversions: z.number(),
  expected_lift_pct: z.number(),
  test_duration_days: z.number(),
  geo_pairs: z.number(),
  conversions_per_geo: z.number(),
  statistical_power: z.number(),
  minimum_detectable_lift_pct: z.number(),
  revenue_at_risk: z.number(),
  recommended_geo_count: z.number(),
  confidence_level: z.number(),
});

export const ConversionLiftInputSchema = z.object({
  daily_impressions: z.number().positive(),
  baseline_cvr: z.number(),
  expected_lift_pct: z.number(),
  test_duration_days: z.number(),
  holdout_pct: z.number().optional(),
  significance_level: z.number().optional(),
  revenue_per_conversion: z.number().optional(),
});

export const ConversionLiftOutputSchema = z.object({
  test_type: z.literal('conversion_lift'),
  daily_impressions: z.number(),
  baseline_cvr: z.number(),
  expected_lift_pct: z.number(),
  test_group_size: z.number(),
  control_group_size: z.number(),
  statistical_power: z.number(),
  minimum_detectable_lift_pct: z.number(),
  revenue_at_risk: z.number(),
  recommended_holdout_pct: z.number(),
  confidence_level: z.number(),
});

export const HoldoutInputSchema = z.object({
  monthly_revenue: z.number().positive(),
  channel_contribution_pct: z.number(),
  holdout_pct: z.number(),
  test_duration_days: z.number(),
});

export const HoldoutOutputSchema = z.object({
  test_type: z.literal('holdout'),
  monthly_revenue: z.number(),
  channel_contribution_pct: z.number(),
  holdout_pct: z.number(),
  revenue_at_risk: z.number(),
  expected_loss: z.number(),
  statistical_power: z.number(),
  break_even_months: z.number(),
  recommendation: z.string(),
});
