// ─── Leak Detector Schemas ──────────────────────────────────────────

import { z } from 'zod';
import {
  IndustrySchema,
  DataSourceSchema,
  BenchmarkComparisonSchema,
  DifficultySchema,
  CSuiteSummarySchema,
  RecoveryActionSchema,
} from './common.js';

// ─── Waste Waterfall ────────────────────────────────────────────────

const WasteCategorySchema = z.union([
  z.record(z.string(), z.number()),
  z.number(),
]);

export const WasteWaterfallInputSchema = z.object({
  gross_spend: z.number().positive(),
  industry: IndustrySchema.optional(),
  actual_revenue: z.number().optional(),
  non_working: WasteCategorySchema.optional(),
  supply_chain: WasteCategorySchema.optional(),
  quality: WasteCategorySchema.optional(),
  audience: WasteCategorySchema.optional(),
  optimization: WasteCategorySchema.optional(),
  measurement: WasteCategorySchema.optional(),
});

export const WasteEstimateInputSchema = z.object({
  gross_spend: z.number().positive(),
  industry: IndustrySchema.optional(),
  actual_revenue: z.number().optional(),
});

export const WasteCompareInputSchema = z.object({
  period_1: WasteWaterfallInputSchema,
  period_2: WasteWaterfallInputSchema,
});

const WaterfallStageSchema = z.object({
  category: z.string(),
  label: z.string(),
  gross_in: z.number(),
  waste_amount: z.number(),
  waste_pct: z.number(),
  remaining: z.number(),
  benchmark_amount: z.number(),
  benchmark_pct: z.number(),
  vs_benchmark: BenchmarkComparisonSchema,
  data_source: DataSourceSchema,
  note: z.string().optional(),
});

const ROIImpactSchema = z.object({
  current_roas: z.number(),
  productive_roas: z.number(),
  improvement_potential_pct: z.number(),
});

export const WasteWaterfallOutputSchema = z.object({
  gross_spend: z.number(),
  waterfall: z.array(WaterfallStageSchema),
  productive_spend: z.object({ amount: z.number(), pct: z.number() }),
  waste_summary: z.object({ total_waste: z.number(), waste_pct: z.number() }),
  recovery_roadmap: z.array(RecoveryActionSchema),
  csuite_summary: CSuiteSummarySchema,
  industry: z.string(),
  math_validated: z.boolean(),
  roi_impact: ROIImpactSchema.optional(),
});

export const WasteCompareOutputSchema = z.object({
  period_1: WasteWaterfallOutputSchema,
  period_2: WasteWaterfallOutputSchema,
  comparison: z.array(
    z.object({
      category: z.string(),
      period_1_pct: z.number(),
      period_2_pct: z.number(),
      delta_pct: z.number(),
      direction: z.enum(['improved', 'regressed', 'unchanged']),
    }),
  ),
  productive_spend_delta: z.number(),
});

// ─── Supply Chain Audit ─────────────────────────────────────────────

const BuyingModelSchema = z.enum(['transparent', 'principal', 'reseller']);
const IntermediaryTypeSchema = z.enum([
  'dsp',
  'ssp',
  'verification',
  'data',
  'reseller',
  'platform',
]);

const IntermediarySchema = z.object({
  name: z.string(),
  type: IntermediaryTypeSchema,
  buying_model: BuyingModelSchema,
  disclosed_fee_pct: z.number(),
});

const SupplyChainChannelInputSchema = z.object({
  name: z.string(),
  spend: z.number(),
  publisher_cpm: z.number().optional(),
  intermediaries: z.array(IntermediarySchema),
});

export const SupplyChainInputSchema = z.object({
  gross_spend: z.number().positive(),
  channels: z.array(SupplyChainChannelInputSchema),
});

export const SupplyChainOutputSchema = z.object({
  gross_spend: z.number(),
  dollar_flow: z.object({
    gross_spend: z.number(),
    total_fees: z.number(),
    working_media: z.number(),
    working_media_ratio_pct: z.number(),
  }),
  channels: z.array(
    z.object({
      channel: z.string(),
      spend: z.number(),
      fee_breakdown: z.array(
        z.object({
          intermediary: z.string(),
          type: z.string(),
          buying_model: z.string(),
          disclosed_fee_pct: z.number(),
          disclosed_fee_amount: z.number(),
          estimated_undisclosed: z.number(),
          total_fee: z.number(),
          fee_status: z.enum(['normal', 'above_benchmark']),
        }),
      ),
      total_fees: z.number(),
      working_media: z.number(),
      working_media_ratio_pct: z.number(),
      risk_flags: z.array(
        z.object({
          type: z.enum(['principal_buying', 'reseller_path']),
          intermediary: z.string(),
          severity: z.enum(['high', 'medium']),
          message: z.string(),
        }),
      ),
      cpm_anomaly: z
        .object({
          channel: z.string(),
          actual_cpm: z.number(),
          benchmark_median: z.number(),
          anomaly_threshold: z.number(),
          severity: z.literal('high'),
        })
        .nullable(),
    }),
  ),
  anomalies: z.array(z.object({
    channel: z.string(),
    actual_cpm: z.number(),
    benchmark_median: z.number(),
    anomaly_threshold: z.number(),
    severity: z.literal('high'),
  })),
  spo_recommendations: z.array(
    z.object({
      channel: z.string(),
      current_working_ratio: z.number(),
      target_working_ratio: z.number(),
      estimated_savings: z.number(),
      recommendation: z.string(),
      impact: z.enum(['high', 'medium']),
    }),
  ),
  partner_comparison: z.array(
    z.object({ channel: z.string(), working_media_ratio: z.number() }),
  ),
});

// ─── Media Quality Score ────────────────────────────────────────────

const QualityChannelInputSchema = z.object({
  name: z.string(),
  spend: z.number(),
  ivt_rate_pct: z.number().optional(),
  viewability_pct: z.number().optional(),
  brand_safety_incidents: z.number().optional(),
  brand_safety_impressions: z.number().optional(),
  mfa_rate_pct: z.number().optional(),
});

export const QualityScoreInputSchema = z.object({
  channels: z.array(QualityChannelInputSchema),
});

const DimensionScoreSchema = z.object({
  rate_pct: z.number(),
  score: z.number(),
});

export const QualityScoreOutputSchema = z.object({
  channels: z.array(
    z.object({
      channel: z.string(),
      spend: z.number(),
      data_source: DataSourceSchema,
      dimensions: z.object({
        fraud: DimensionScoreSchema,
        viewability: DimensionScoreSchema,
        brand_safety: DimensionScoreSchema,
        mfa: DimensionScoreSchema,
      }),
      composite_score: z.number(),
      effective_quality_rate: z.number(),
      quality_waste_dollars: z.number(),
      remediation_actions: z.array(
        z.object({
          dimension: z.enum(['fraud', 'viewability', 'brand_safety', 'mfa']),
          action: z.string(),
          estimated_savings: z.number(),
          timeline: z.string(),
          priority: z.enum(['high', 'medium']),
        }),
      ),
    }),
  ),
  summary: z.object({
    total_spend: z.number(),
    total_quality_waste: z.number(),
    quality_waste_pct: z.number(),
    average_composite_score: z.number(),
  }),
});
