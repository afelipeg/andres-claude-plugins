// ─── Leak Detector Engine Types ─────────────────────────────────────

import type {
  Industry,
  DataSource,
  BenchmarkComparison,
  Difficulty,
  CSuiteSummary,
  RecoveryAction,
} from './common.js';

// ─── Waste Waterfall ────────────────────────────────────────────────

export interface WasteCategory {
  [key: string]: number;
}

export interface WasteWaterfallInput {
  gross_spend: number;
  industry?: Industry;
  actual_revenue?: number;
  non_working?: WasteCategory | number;
  supply_chain?: WasteCategory | number;
  quality?: WasteCategory | number;
  audience?: WasteCategory | number;
  optimization?: WasteCategory | number;
  measurement?: WasteCategory | number;
}

export interface WasteEstimateInput {
  gross_spend: number;
  industry?: Industry;
  actual_revenue?: number;
}

export interface WasteCompareInput {
  period_1: WasteWaterfallInput;
  period_2: WasteWaterfallInput;
}

export interface WaterfallStage {
  category: string;
  label: string;
  gross_in: number;
  waste_amount: number;
  waste_pct: number;
  remaining: number;
  benchmark_amount: number;
  benchmark_pct: number;
  vs_benchmark: BenchmarkComparison;
  data_source: DataSource;
  note?: string;
}

export interface ROIImpact {
  current_roas: number;
  productive_roas: number;
  improvement_potential_pct: number;
}

export interface WasteWaterfallOutput {
  gross_spend: number;
  waterfall: WaterfallStage[];
  productive_spend: { amount: number; pct: number };
  waste_summary: { total_waste: number; waste_pct: number };
  recovery_roadmap: RecoveryAction[];
  csuite_summary: CSuiteSummary;
  industry: string;
  math_validated: boolean;
  roi_impact?: ROIImpact;
}

export interface WasteCompareOutput {
  period_1: WasteWaterfallOutput;
  period_2: WasteWaterfallOutput;
  comparison: Array<{
    category: string;
    period_1_pct: number;
    period_2_pct: number;
    delta_pct: number;
    direction: 'improved' | 'regressed' | 'unchanged';
  }>;
  productive_spend_delta: number;
}

// ─── Supply Chain Audit ─────────────────────────────────────────────

export type BuyingModel = 'transparent' | 'principal' | 'reseller';
export type IntermediaryType = 'dsp' | 'ssp' | 'verification' | 'data' | 'reseller' | 'platform';

export interface Intermediary {
  name: string;
  type: IntermediaryType;
  buying_model: BuyingModel;
  disclosed_fee_pct: number;
}

export interface SupplyChainChannelInput {
  name: string;
  spend: number;
  publisher_cpm?: number;
  intermediaries: Intermediary[];
}

export interface SupplyChainInput {
  gross_spend: number;
  channels: SupplyChainChannelInput[];
}

export interface FeeBreakdown {
  intermediary: string;
  type: string;
  buying_model: string;
  disclosed_fee_pct: number;
  disclosed_fee_amount: number;
  estimated_undisclosed: number;
  total_fee: number;
  fee_status: 'normal' | 'above_benchmark';
}

export interface RiskFlag {
  type: 'principal_buying' | 'reseller_path';
  intermediary: string;
  severity: 'high' | 'medium';
  message: string;
}

export interface CPMAnomaly {
  channel: string;
  actual_cpm: number;
  benchmark_median: number;
  anomaly_threshold: number;
  severity: 'high';
}

export interface SPORecommendation {
  channel: string;
  current_working_ratio: number;
  target_working_ratio: number;
  estimated_savings: number;
  recommendation: string;
  impact: 'high' | 'medium';
}

export interface SupplyChainChannelResult {
  channel: string;
  spend: number;
  fee_breakdown: FeeBreakdown[];
  total_fees: number;
  working_media: number;
  working_media_ratio_pct: number;
  risk_flags: RiskFlag[];
  cpm_anomaly: CPMAnomaly | null;
}

export interface SupplyChainOutput {
  gross_spend: number;
  dollar_flow: {
    gross_spend: number;
    total_fees: number;
    working_media: number;
    working_media_ratio_pct: number;
  };
  channels: SupplyChainChannelResult[];
  anomalies: CPMAnomaly[];
  spo_recommendations: SPORecommendation[];
  partner_comparison: Array<{ channel: string; working_media_ratio: number }>;
}

// ─── Media Quality Score ────────────────────────────────────────────

export interface QualityChannelInput {
  name: string;
  spend: number;
  ivt_rate_pct?: number;
  viewability_pct?: number;
  brand_safety_incidents?: number;
  brand_safety_impressions?: number;
  mfa_rate_pct?: number;
}

export interface QualityScoreInput {
  channels: QualityChannelInput[];
}

export interface DimensionScore {
  rate_pct: number;
  score: number;
}

export interface RemediationAction {
  dimension: 'fraud' | 'viewability' | 'brand_safety' | 'mfa';
  action: string;
  estimated_savings: number;
  timeline: string;
  priority: 'high' | 'medium';
}

export interface QualityChannelResult {
  channel: string;
  spend: number;
  data_source: DataSource;
  dimensions: {
    fraud: DimensionScore;
    viewability: DimensionScore;
    brand_safety: DimensionScore;
    mfa: DimensionScore;
  };
  composite_score: number;
  effective_quality_rate: number;
  quality_waste_dollars: number;
  remediation_actions: RemediationAction[];
}

export interface QualityScoreOutput {
  channels: QualityChannelResult[];
  summary: {
    total_spend: number;
    total_quality_waste: number;
    quality_waste_pct: number;
    average_composite_score: number;
  };
}
