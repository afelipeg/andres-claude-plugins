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
}

export interface OptimizationOutput {
  campaigns: OptCampaignResult[];
  total_alerts: { critical: number; warning: number; info: number };
}

export interface ReallocateInput {
  campaigns: Array<{
    name: string;
    channel: string;
    spend: number;
    roas: number;
  }>;
}

export interface ReallocateOutput {
  recommendations: Array<{
    from_campaign: string;
    to_campaign: string;
    amount: number;
    reason: string;
  }>;
  estimated_roas_improvement: number;
}
