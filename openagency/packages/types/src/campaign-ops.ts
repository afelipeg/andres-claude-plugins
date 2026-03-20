// ─── Campaign Ops Engine Types ──────────────────────────────────────

import type { Severity } from './common.js';

// ─── Campaign State ─────────────────────────────────────────────────

export type CampaignStatus =
  | 'BRIEFED'
  | 'PLANNING'
  | 'ARCHITECTING'
  | 'ACTIVATING'
  | 'LIVE'
  | 'OPTIMIZING'
  | 'WRAPPING'
  | 'COMPLETED'
  | 'BLOCKED';

export type EngineStatus = 'IDLE' | 'ACTIVE' | 'BLOCKED' | 'COMPLETED';
export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'BLOCKED' | 'REVIEW' | 'DONE' | 'SKIPPED';

export interface CampaignTask {
  id: string;
  name: string;
  engine: string;
  hours: number;
  depends_on: string[];
  status: TaskStatus;
}

export interface Sprint {
  name: string;
  duration_hours: number;
  tasks: CampaignTask[];
}

export interface CampaignCreateInput {
  campaign_name: string;
  client: string;
  start_date?: string;
  brief_summary?: string;
}

export interface CampaignState {
  campaign: {
    name: string;
    client: string;
    state: CampaignStatus;
    start_date: string;
    brief_summary: string;
  };
  engines: Record<
    string,
    { state: EngineStatus; progress: number }
  >;
  sprints: Record<string, Sprint>;
  blockers: string[];
  created_at: string;
}

export interface TaskUpdateInput {
  state: CampaignState;
  task_id: string;
  new_status: TaskStatus;
}

export interface NextAction {
  task_id: string;
  task_name: string;
  engine: string;
  sprint: string;
  estimated_hours: number;
}

// ─── Cross-Engine Signal Types (v4.0) ───────────────────────────────

/** Waste signal from Leak Detector engine */
export interface LeakDetectorSignals {
  /** Waste % by category */
  waste_waterfall?: Record<string, number>;
  /** Per-channel quality scores (0-1) */
  media_quality?: Record<string, {
    fraud_score?: number;
    viewability?: number;
    brand_safety?: number;
    mfa_score?: number;
    overall: number;
  }>;
  /** Supply chain audit data */
  supply_chain?: Record<string, {
    working_media_ratio?: number;
    tech_fee_pct?: number;
    total_fee_pct?: number;
  }>;
}

/** Media Architect signals for Campaign Ops */
export interface MediaArchitectSignals {
  /** Per-channel optimization data from channel-optimize */
  channel_optimize?: Record<string, {
    optimal_spend: number;
    marginal_roi: number;
    saturation_pct: number;
  }>;
  /** Per-channel MMM model data */
  mmm_model?: Record<string, {
    roi: number;
    marginal_roi: number;
    saturation_pct: number;
    contribution: number;
    roi_ci_lower?: number;
    roi_ci_upper?: number;
  }>;
  /** Anomaly detection results */
  anomalies?: Array<{
    channel: string;
    metric: string;
    z_score: number;
    direction: 'above' | 'below';
  }>;
}

// ─── Optimization Rules ─────────────────────────────────────────────

export interface CampaignMetricsInput {
  name: string;
  channel: string;
  spend: number;
  budget: number;
  days_elapsed: number;
  days_total: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  cpa_target: number;
  roas_target: number;
  historical_ctr: number;
}

export interface OptimizationInput {
  campaigns: CampaignMetricsInput[];
  /** Cross-engine signals from Leak Detector (v4.0) */
  leak_detector?: LeakDetectorSignals;
  /** Cross-engine signals from Media Architect (v4.0) */
  media_architect?: MediaArchitectSignals;
}

export interface OptAlert {
  type: string;
  severity: Severity;
  message: string;
  recommendation: string;
}

export interface OptCampaignResult {
  campaign: string;
  channel: string;
  metrics: {
    spend: number;
    budget: number;
    cpa: number;
    roas: number;
    ctr: number;
    pacing_pct: number;
  };
  alerts: OptAlert[];
  alert_count: { critical: number; warning: number; info: number };
  /** Priority score from cross-engine analysis (v4.0, 0-1) */
  priority_score?: number;
}

export interface OptimizationOutput {
  campaigns: OptCampaignResult[];
  total_alerts: { critical: number; warning: number; info: number };
  /** Cross-engine alerts combining signals from multiple engines (v4.0) */
  cross_engine_alerts?: OptAlert[];
}

export interface ReallocateInput {
  campaigns: Array<{
    name: string;
    channel: string;
    spend: number;
    roas: number;
  }>;
  /** Cross-engine signals from Leak Detector (v4.0) */
  leak_detector?: LeakDetectorSignals;
  /** Cross-engine signals from Media Architect (v4.0) */
  media_architect?: MediaArchitectSignals;
  /** Total budget constraint */
  total_budget?: number;
}

export interface ReallocateRecommendation {
  action: string;
  from_campaign: string;
  to_campaign: string;
  amount: number;
  rationale: string;
  /** Recommendation category (v4.0) */
  category?: 'quick_win' | 'strategic_shift' | 'growth_opportunity';
  /** Expected impact description (v4.0) */
  expected_impact?: string;
  /** Risk level (v4.0) */
  risk?: 'low' | 'medium' | 'high';
}

export interface ReallocateOutput {
  performances: Array<{
    campaign: string;
    channel: string;
    current_spend: number;
    roas: number;
    cpa: number | null;
    /** Priority score from cross-engine analysis (v4.0, 0-1) */
    priority_score?: number;
  }>;
  recommendations: ReallocateRecommendation[];
  /** Estimated overall ROAS improvement from recommendations (v4.0) */
  estimated_roas_improvement?: number;
  /** Pacing alerts for campaigns (v4.0) */
  pacing_alerts?: Array<{
    campaign: string;
    status: 'over_delivery' | 'under_delivery';
    message: string;
  }>;
}
