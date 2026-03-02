// ─── Media Architect Schemas ────────────────────────────────────────

import { z } from 'zod';
import { IndustrySchema, SeveritySchema } from './common.js';

// ─── Channel Optimizer ──────────────────────────────────────────────

const ChannelOptInputSchema = z.object({
  name: z.string(),
  spend: z.number().optional(),
  max_response: z.number().optional(),
  alpha: z.number().optional(),
  ec50: z.number().optional(),
  min_spend: z.number().optional(),
  max_spend: z.number().optional(),
});

export const ChannelOptimizerInputSchema = z.object({
  total_budget: z.number().positive(),
  channels: z.array(ChannelOptInputSchema),
  step_size: z.number().optional(),
});

const ChannelOptResultSchema = z.object({
  channel: z.string(),
  spend: z.number(),
  spend_pct: z.number(),
  expected_response: z.number(),
  marginal_roi: z.number(),
  saturation_pct: z.number(),
});

export const ChannelOptimizerOutputSchema = z.object({
  total_budget: z.number(),
  total_allocated: z.number(),
  total_expected_response: z.number(),
  channels: z.array(ChannelOptResultSchema),
});

// ─── MMM Scenario Planner ───────────────────────────────────────────

const MMMChannelInputSchema = z.object({
  name: z.string(),
  weeks_active: z.number().optional(),
  spend_cv: z.number().optional(),
  has_roi_prior: z.boolean().optional(),
  spend: z.number().optional(),
  alpha: z.number().optional(),
  decay_rate: z.number().optional(),
  ec50: z.number().optional(),
  max_response: z.number().optional(),
  roi_prior: z.number().optional(),
});

export const MMMPreModelInputSchema = z.object({
  channels: z.array(MMMChannelInputSchema),
  time_periods: z.number(),
  geos: z.number(),
  kpi: z.string(),
  has_control_variables: z.boolean(),
  has_gqv: z.boolean(),
});

export const MMMModelInputSchema = z.object({
  total_budget: z.number().positive(),
  total_kpi: z.number(),
  channels: z.array(MMMChannelInputSchema),
  time_periods: z.number(),
});

export const MMMOptimizeInputSchema = z.object({
  total_budget: z.number().positive(),
  channels: z.array(MMMChannelInputSchema),
  scenarios: z.array(z.string()).optional(),
  constraints: z
    .record(
      z.string(),
      z.object({
        min_pct: z.number().optional(),
        max_pct: z.number().optional(),
      }),
    )
    .optional(),
});

const MMMIssueSchema = z.object({
  field: z.string(),
  severity: SeveritySchema,
  message: z.string(),
  recommendation: z.string(),
});

export const MMMPreModelOutputSchema = z.object({
  phase: z.literal('pre_model'),
  data_readiness_score: z.number(),
  status: z.enum(['READY', 'NEEDS_WORK', 'INSUFFICIENT']),
  time_periods: z.number(),
  geos: z.number(),
  kpi: z.string(),
  channels_assessed: z.number(),
  channel_assessments: z.array(
    z.object({
      channel: z.string(),
      weeks_active: z.number(),
      spend_variation_cv: z.number(),
      has_roi_prior: z.boolean(),
      readiness_score: z.number(),
      issues: z.array(z.string()),
    }),
  ),
  issues: z.array(MMMIssueSchema),
  has_control_variables: z.boolean(),
  has_gqv: z.boolean(),
  recommendation: z.string(),
  next_step: z.enum(['model', 'collect_more_data']),
});

const MMMChannelModelSchema = z.object({
  channel: z.string(),
  spend: z.number(),
  spend_share_pct: z.number(),
  parameters: z.object({
    alpha: z.number(),
    ec50: z.number(),
    max_response: z.number(),
    decay_rate: z.number(),
    adstock_half_life_weeks: z.number(),
  }),
  results: z.object({
    estimated_contribution: z.number(),
    contribution_share_pct: z.number(),
    roi: z.number(),
    marginal_roi: z.number(),
    saturation_pct: z.number(),
  }),
});

export const MMMModelOutputSchema = z.object({
  phase: z.literal('model'),
  model_type: z.string(),
  methodology: z.string(),
  total_budget: z.number(),
  total_kpi: z.number(),
  predicted_kpi: z.number(),
  base_contribution: z.number(),
  media_contribution: z.number(),
  media_contribution_pct: z.number(),
  overall_roi: z.number(),
  r_squared_estimate: z.number(),
  channel_models: z.array(MMMChannelModelSchema),
  response_curves: z.array(
    z.object({
      channel: z.string(),
      current_spend: z.number(),
      current_response: z.number(),
      points: z.array(z.object({ spend: z.number(), response: z.number() })),
    }),
  ),
  model_fit: z.object({
    periods: z.array(z.string()),
    actual: z.array(z.number()),
    predicted: z.array(z.number()),
  }),
  roi_intervals: z.array(
    z.object({
      channel: z.string(),
      roi: z.number(),
      lower_ci: z.number(),
      upper_ci: z.number(),
      mroi: z.number(),
      mroi_lower_ci: z.number(),
      mroi_upper_ci: z.number(),
    }),
  ),
  contribution_waterfall: z.array(
    z.object({
      channel: z.string(),
      contribution: z.number(),
      contribution_pct: z.number(),
    }),
  ),
  next_step: z.literal('post_model'),
});

export const MMMOptimizeOutputSchema = z.object({
  phase: z.literal('scenario_planning'),
  methodology: z.string(),
  total_budget: z.number(),
  scenarios: z.record(
    z.string(),
    z.object({
      scenario: z.string(),
      budget_multiplier: z.number(),
      total_budget: z.number(),
      total_response: z.number(),
      overall_roi: z.number(),
      channels: z.array(
        z.object({
          channel: z.string(),
          spend: z.number(),
          spend_pct: z.number(),
          response: z.number(),
          roi: z.number(),
          marginal_roi: z.number(),
          saturation_pct: z.number(),
        }),
      ),
    }),
  ),
  comparison_vs_current: z.object({
    kpi_lift: z.number(),
    kpi_lift_pct: z.number(),
    roi_improvement: z.number(),
    reallocation: z.array(
      z.object({
        channel: z.string(),
        current_spend: z.number(),
        optimized_spend: z.number(),
        delta: z.number(),
        direction: z.enum(['increase', 'decrease']),
      }),
    ),
  }),
  recommendations: z.array(
    z.object({
      priority: z.enum(['high', 'medium']),
      action: z.string(),
      impact: z.string(),
    }),
  ),
});

// ─── Benchmark Tracker ──────────────────────────────────────────────

const BenchmarkChannelInputSchema = z.object({
  name: z.string(),
  spend: z.number(),
  impressions: z.number(),
  clicks: z.number(),
  conversions: z.number(),
});

export const BenchmarkHealthInputSchema = z.object({
  industry: IndustrySchema,
  channels: z.array(BenchmarkChannelInputSchema),
});

export const BenchmarkHealthOutputSchema = z.object({
  industry: z.string(),
  channels: z.array(
    z.object({
      channel: z.string(),
      overall_status: z.enum(['healthy', 'warning', 'critical']),
      checks: z.array(
        z.object({
          metric: z.string(),
          actual: z.number(),
          benchmark: z.number(),
          deviation_pct: z.number(),
          status: z.enum(['healthy', 'warning', 'critical']),
          recommendation: z.string(),
        }),
      ),
    }),
  ),
});

// ─── Anomaly Detection ──────────────────────────────────────────────

export const AnomalyDetectInputSchema = z.object({
  metric: z.string(),
  values: z.array(z.number()),
  threshold: z.number().optional(),
});

export const AnomalyDetectOutputSchema = z.object({
  metric: z.string(),
  data_points: z.number(),
  mean: z.number(),
  std: z.number(),
  threshold: z.number(),
  anomalies_detected: z.number(),
  anomalies: z.array(
    z.object({
      index: z.number(),
      value: z.number(),
      z_score: z.number(),
      severity: z.enum(['medium', 'high']),
      direction: z.enum(['above', 'below']),
    }),
  ),
});

// ─── Media Plan Generator ───────────────────────────────────────────

const MediaPlanChannelInputSchema = z.object({
  name: z.string(),
  platform: z.string(),
  monthly_budget: z.number(),
  duration_months: z.number(),
  buying_model: z.string().optional(),
});

export const MediaPlanInputSchema = z.object({
  campaign_name: z.string(),
  client: z.string(),
  start_date: z.string().optional(),
  channels: z.array(MediaPlanChannelInputSchema),
});

export const MediaPlanOutputSchema = z.object({
  campaign: z.string(),
  client: z.string(),
  start_date: z.string(),
  total_budget: z.number(),
  flowchart: z.array(
    z.object({
      channel: z.string(),
      platform: z.string(),
      total_budget: z.number(),
      months: z.array(z.object({ month: z.number(), budget: z.number() })),
    }),
  ),
  insertion_orders: z.array(
    z.object({
      io_number: z.string(),
      advertiser: z.string(),
      campaign: z.string(),
      channel: z.string(),
      platform: z.string(),
      start_date: z.string(),
      total_budget: z.number(),
      payment_terms: z.string(),
      buying_model: z.string(),
    }),
  ),
  utm_taxonomy: z.array(
    z.object({
      channel: z.string(),
      utm_source: z.string(),
      utm_medium: z.string(),
      utm_campaign: z.string(),
      utm_content: z.string(),
      utm_term: z.string(),
      full_utm: z.string(),
    }),
  ),
});
