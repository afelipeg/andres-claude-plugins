// ─── Media Architect Engine Types ───────────────────────────────────

import type { Industry, Severity } from './common.js';

// ─── Channel Optimizer ──────────────────────────────────────────────

export interface ChannelOptInput {
  name: string;
  spend?: number;
  max_response?: number;
  alpha?: number;
  ec50?: number;
  min_spend?: number;
  max_spend?: number;
}

export interface ChannelOptimizerInput {
  total_budget: number;
  channels: ChannelOptInput[];
  step_size?: number;
}

export interface ChannelOptResult {
  channel: string;
  spend: number;
  spend_pct: number;
  expected_response: number;
  marginal_roi: number;
  saturation_pct: number;
}

export interface ChannelOptimizerOutput {
  total_budget: number;
  total_allocated: number;
  total_expected_response: number;
  channels: ChannelOptResult[];
}

// ─── MMM Scenario Planner ───────────────────────────────────────────

export interface MMMChannelInput {
  name: string;
  weeks_active?: number;
  spend_cv?: number;
  has_roi_prior?: boolean;
  spend?: number;
  alpha?: number;
  decay_rate?: number;
  ec50?: number;
  max_response?: number;
  roi_prior?: number;
}

export interface MMMPreModelInput {
  channels: MMMChannelInput[];
  time_periods: number;
  geos: number;
  kpi: string;
  has_control_variables: boolean;
  has_gqv: boolean;
}

export interface MMMModelInput {
  total_budget: number;
  total_kpi: number;
  channels: MMMChannelInput[];
  time_periods: number;
}

export interface MMMOptimizeInput {
  total_budget: number;
  channels: MMMChannelInput[];
  scenarios?: string[];
  constraints?: Record<string, { min_pct?: number; max_pct?: number }>;
}

export interface MMMIssue {
  field: string;
  severity: Severity;
  message: string;
  recommendation: string;
}

export interface MMMPreModelOutput {
  phase: 'pre_model';
  data_readiness_score: number;
  status: 'READY' | 'NEEDS_WORK' | 'INSUFFICIENT';
  time_periods: number;
  geos: number;
  kpi: string;
  channels_assessed: number;
  channel_assessments: Array<{
    channel: string;
    weeks_active: number;
    spend_variation_cv: number;
    has_roi_prior: boolean;
    readiness_score: number;
    issues: string[];
  }>;
  issues: MMMIssue[];
  has_control_variables: boolean;
  has_gqv: boolean;
  recommendation: string;
  next_step: 'model' | 'collect_more_data';
}

export interface MMMChannelModel {
  channel: string;
  spend: number;
  spend_share_pct: number;
  parameters: {
    alpha: number;
    ec50: number;
    max_response: number;
    decay_rate: number;
    adstock_half_life_weeks: number;
  };
  results: {
    estimated_contribution: number;
    contribution_share_pct: number;
    roi: number;
    marginal_roi: number;
    saturation_pct: number;
  };
}

export interface MMMModelOutput {
  phase: 'model';
  model_type: string;
  methodology: string;
  total_budget: number;
  total_kpi: number;
  predicted_kpi: number;
  base_contribution: number;
  media_contribution: number;
  media_contribution_pct: number;
  overall_roi: number;
  r_squared_estimate: number;
  channel_models: MMMChannelModel[];
  next_step: 'post_model';
}

export interface MMMScenarioChannel {
  channel: string;
  spend: number;
  spend_pct: number;
  response: number;
  roi: number;
  marginal_roi: number;
  saturation_pct: number;
}

export interface MMMScenario {
  scenario: string;
  budget_multiplier: number;
  total_budget: number;
  total_response: number;
  overall_roi: number;
  channels: MMMScenarioChannel[];
}

export interface MMMOptimizeOutput {
  phase: 'scenario_planning';
  methodology: string;
  total_budget: number;
  scenarios: Record<string, MMMScenario>;
  comparison_vs_current: {
    kpi_lift: number;
    kpi_lift_pct: number;
    roi_improvement: number;
    reallocation: Array<{
      channel: string;
      current_spend: number;
      optimized_spend: number;
      delta: number;
      direction: 'increase' | 'decrease';
    }>;
  };
  recommendations: Array<{
    priority: 'high' | 'medium';
    action: string;
    impact: string;
  }>;
}

// ─── Benchmark Tracker ──────────────────────────────────────────────

export interface BenchmarkChannelInput {
  name: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
}

export interface BenchmarkHealthInput {
  industry: Industry;
  channels: BenchmarkChannelInput[];
}

export interface BenchmarkCheck {
  metric: string;
  actual: number;
  benchmark: number;
  deviation_pct: number;
  status: 'healthy' | 'warning' | 'critical';
  recommendation: string;
}

export interface BenchmarkHealthOutput {
  industry: string;
  channels: Array<{
    channel: string;
    overall_status: 'healthy' | 'warning' | 'critical';
    checks: BenchmarkCheck[];
  }>;
}

export interface AnomalyDetectInput {
  metric: string;
  values: number[];
  threshold?: number;
}

export interface AnomalyDetectOutput {
  metric: string;
  data_points: number;
  mean: number;
  std: number;
  threshold: number;
  anomalies_detected: number;
  anomalies: Array<{
    index: number;
    value: number;
    z_score: number;
    severity: 'medium' | 'high';
    direction: 'above' | 'below';
  }>;
}

// ─── Media Plan Generator ───────────────────────────────────────────

export interface MediaPlanChannelInput {
  name: string;
  platform: string;
  monthly_budget: number;
  duration_months: number;
  buying_model?: string;
}

export interface MediaPlanInput {
  campaign_name: string;
  client: string;
  start_date?: string;
  channels: MediaPlanChannelInput[];
}

export interface MediaPlanOutput {
  campaign: string;
  client: string;
  start_date: string;
  total_budget: number;
  flowchart: Array<{
    channel: string;
    platform: string;
    total_budget: number;
    months: Array<{ month: number; budget: number }>;
  }>;
  insertion_orders: Array<{
    io_number: string;
    advertiser: string;
    campaign: string;
    channel: string;
    platform: string;
    start_date: string;
    total_budget: number;
    payment_terms: string;
    buying_model: string;
  }>;
  utm_taxonomy: Array<{
    channel: string;
    utm_source: string;
    utm_medium: string;
    utm_campaign: string;
    utm_content: string;
    utm_term: string;
    full_utm: string;
  }>;
}
