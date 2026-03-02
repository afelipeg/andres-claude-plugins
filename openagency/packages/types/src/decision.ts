// ─── Decision and Action Types ──────────────────────────────────────

export type ActionType =
  | 'budget_update'
  | 'campaign_pause'
  | 'campaign_enable'
  | 'bid_adjustment'
  | 'skill_execution'
  | 'notification';

export interface ActionTarget {
  platform?: string;
  campaign_id?: string;
  ad_set_id?: string;
  account_id?: string;
}

export interface PlannedAction {
  id: string;
  type: ActionType;
  target: ActionTarget;
  parameters: Record<string, unknown>;
  dry_run: boolean;
  safety_checks: string[];
  estimated_impact: string;
  rollback_plan?: string;
}

export type DecisionStatus =
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'executed'
  | 'rolled_back'
  | 'failed';

export interface Decision {
  id: string;
  agent_id: string;
  goal_id?: string;
  actions: PlannedAction[];
  reasoning: string;
  confidence: number; // 0-1
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  requires_approval: boolean;
  orientation_id?: string;
  status: DecisionStatus;
  created_at: string; // ISO 8601
  approved_at?: string;
  approved_by?: string;
}

export interface ActionResult {
  action_id: string;
  status: 'executed' | 'skipped' | 'failed' | 'dry_run';
  result?: unknown;
  error?: string;
  executed_at: string; // ISO 8601
  duration_ms: number;
  rollback_available: boolean;
}
