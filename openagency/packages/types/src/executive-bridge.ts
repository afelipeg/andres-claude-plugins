// ─── Executive Bridge Engine Types ──────────────────────────────────

import type { CSuiteSummary } from './common.js';

// ─── Shapley Attribution ────────────────────────────────────────────

export interface ShapleyInput {
  channels: string[];
  coalition_conversions: Record<string, number>;
  total_conversions: number;
}

export interface ShapleyChannelResult {
  channel: string;
  shapley_value: number;
  shapley_share_pct: number;
  last_click_conversions: number;
  last_click_share_pct: number;
  difference_pct: number;
  credit_status: 'under-credited by last-click' | 'over-credited by last-click' | 'fairly credited';
}

export interface ShapleyOutput {
  total_conversions: number;
  shapley_total: number;
  channels: ShapleyChannelResult[];
}

export interface ShapleyCompareInput {
  channels: string[];
  coalition_conversions: Record<string, number>;
  total_conversions: number;
  spend: Record<string, number>;
  last_click: Record<string, number>;
}

export interface ShapleyCompareOutput {
  channels: Array<{
    channel: string;
    shapley_share_pct: number;
    last_click_share_pct: number;
    spend_share_pct: number;
    shapley_efficiency: number;
    last_click_efficiency: number;
    recommendation: 'Increase budget' | 'Investigate' | 'Maintain';
  }>;
}

// ─── Revenue Bridge ─────────────────────────────────────────────────

export interface RevenueBridgeChannelInput {
  name: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue?: number;
}

export interface RevenueBridgeInput {
  channels: RevenueBridgeChannelInput[];
  aov?: number;
  retention_rate?: number;
  avg_customer_months?: number;
}

export interface L3Metrics {
  cpm?: number;
  cpc?: number;
  ctr?: number;
  cvr?: number;
}

export interface L2Metrics {
  cpa: number;
  roas: number;
  aov: number;
  conversions: number;
}

export interface L1Metrics {
  cac: number;
  clv: number;
  clv_cac_ratio: number;
  roi_pct: number;
  marketing_margin_pct: number;
  total_revenue: number;
  total_spend: number;
}

export interface RevenueBridgeOutput {
  l1_metrics: L1Metrics;
  efficiency_score: number;
  channels: Array<{
    channel: string;
    spend: number;
    revenue: number;
    l3_metrics: L3Metrics;
    l2_metrics: L2Metrics;
  }>;
  csuite_summary: CSuiteSummary;
}

// ─── Revenue Reconciliation ─────────────────────────────────────────

export interface ReconcilePlatformInput {
  name: string;
  reported_conversions: number;
  reported_revenue: number;
  actual_conversions: number;
  actual_revenue: number;
  spend: number;
}

export interface ReconcileInput {
  platforms: ReconcilePlatformInput[];
}

export interface ReconcilePlatformResult {
  platform: string;
  reported_conversions: number;
  actual_conversions: number;
  conversion_correction_factor: number;
  over_reporting_conversions_pct: number;
  reported_revenue: number;
  actual_revenue: number;
  revenue_correction_factor: number;
  over_reporting_revenue_pct: number;
  reported_roas: number;
  adjusted_roas: number;
  data_integrity_score: number;
}

export interface ReconcileOutput {
  platforms: ReconcilePlatformResult[];
  summary: {
    total_reported_revenue: number;
    total_actual_revenue: number;
    overall_correction_factor: number;
    overall_over_reporting_pct: number;
    total_reported_conversions: number;
    total_actual_conversions: number;
    measurement_waste_dollars: number;
  };
}

export interface IntegrityInput {
  tracking_coverage_pct: number;
  cookie_consent_rate_pct: number;
  attribution_window_days: number;
  cross_device_enabled: boolean;
  offline_conversion_import: boolean;
}

export interface IntegrityOutput {
  integrity_score: number;
  dimension_scores: {
    tracking_coverage: number;
    consent_rate: number;
    attribution_window: number;
    cross_device: number;
    offline_integration: number;
  };
  recommendations: string[];
}

// ─── Power Analysis ─────────────────────────────────────────────────

export interface GeoLiftInput {
  daily_conversions: number;
  expected_lift_pct: number;
  test_duration_days: number;
  geo_pairs: number;
  significance_level?: number;
  revenue_per_conversion?: number;
}

export interface GeoLiftOutput {
  test_type: 'geo_lift';
  daily_conversions: number;
  expected_lift_pct: number;
  test_duration_days: number;
  geo_pairs: number;
  conversions_per_geo: number;
  statistical_power: number;
  minimum_detectable_lift_pct: number;
  revenue_at_risk: number;
  recommended_geo_count: number;
  confidence_level: number;
}

export interface ConversionLiftInput {
  daily_impressions: number;
  baseline_cvr: number;
  expected_lift_pct: number;
  test_duration_days: number;
  holdout_pct?: number;
  significance_level?: number;
  revenue_per_conversion?: number;
}

export interface ConversionLiftOutput {
  test_type: 'conversion_lift';
  daily_impressions: number;
  baseline_cvr: number;
  expected_lift_pct: number;
  test_group_size: number;
  control_group_size: number;
  statistical_power: number;
  minimum_detectable_lift_pct: number;
  revenue_at_risk: number;
  recommended_holdout_pct: number;
  confidence_level: number;
}

export interface HoldoutInput {
  monthly_revenue: number;
  channel_contribution_pct: number;
  holdout_pct: number;
  test_duration_days: number;
}

export interface HoldoutOutput {
  test_type: 'holdout';
  monthly_revenue: number;
  channel_contribution_pct: number;
  holdout_pct: number;
  revenue_at_risk: number;
  expected_loss: number;
  statistical_power: number;
  break_even_months: number;
  recommendation: string;
}
