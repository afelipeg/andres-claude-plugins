// ─── Goal-Driven Execution Types ────────────────────────────────────

export type GoalType = 'maximize' | 'minimize' | 'maintain' | 'achieve';

export type GoalStatus = 'active' | 'paused' | 'completed' | 'failed' | 'cancelled';

export type SubTaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';

export interface GoalConstraints {
  max_budget?: number;
  min_budget?: number;
  allowed_platforms?: string[];
  excluded_campaigns?: string[];
  max_cpa?: number;
  min_roas?: number;
}

export interface SubTask {
  id: string;
  description: string;
  assigned_agent: string;
  skill_to_run?: string;
  status: SubTaskStatus;
  depends_on: string[];
  result?: unknown;
}

export interface Goal {
  id: string;
  agent_id?: string;
  parent_goal_id?: string;
  name: string;
  description: string;
  type: GoalType;
  target_metric: string;
  target_value: number;
  current_value?: number;
  deadline?: string; // ISO 8601
  priority: number; // 1 (highest) to 10 (lowest)
  status: GoalStatus;
  constraints: GoalConstraints;
  sub_tasks: SubTask[];
  progress_pct: number;
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
}

export interface GoalProgressReport {
  goal_id: string;
  name: string;
  target_value: number;
  current_value: number;
  progress_pct: number;
  on_track: boolean;
  estimated_completion?: string; // ISO 8601
  blockers: string[];
}
