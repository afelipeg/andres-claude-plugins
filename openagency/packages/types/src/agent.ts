// ─── Autonomous Agent Types ─────────────────────────────────────────

export type AgentStatus =
  | 'idle'
  | 'observing'
  | 'orienting'
  | 'deciding'
  | 'acting'
  | 'paused'
  | 'error';

export type OodaPhase = 'observe' | 'orient' | 'decide' | 'act';

export type ObservationType =
  | 'sync_data'
  | 'metric_anomaly'
  | 'threshold_breach'
  | 'event_signal'
  | 'schedule_tick'
  | 'goal_update';

export interface Observation {
  id: string;
  source: string;
  type: ObservationType;
  data: unknown;
  timestamp: string; // ISO 8601
  platform?: string;
}

export interface AnomalySignal {
  metric: string;
  expected: number;
  actual: number;
  deviation_pct: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  platform?: string;
  campaign_id?: string;
}

export interface OpportunitySignal {
  description: string;
  potential_impact: number;
  confidence: number;
  suggested_action: string;
  platform?: string;
}

export interface RiskSignal {
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  probability: number;
  mitigation: string;
}

export interface Orientation {
  observations_analyzed: number;
  context: Record<string, unknown>;
  anomalies: AnomalySignal[];
  opportunities: OpportunitySignal[];
  risks: RiskSignal[];
  reasoning: string;
  llm_usage?: { prompt_tokens: number; completion_tokens: number; model: string };
}

export interface AgentConfiguration {
  cycle_interval_ms: number;
  max_budget_change_pct: number;
  approval_threshold_usd: number;
  dry_run: boolean;
  writable_platforms: string[];
  llm_config?: { model: string; temperature?: number; max_tokens?: number };
}

export interface AgentState {
  agent_id: string;
  engine_id: string;
  status: AgentStatus;
  current_phase: OodaPhase | null;
  active_goals: string[];
  last_cycle: string | null; // ISO 8601
  cycles_completed: number;
  configuration: AgentConfiguration;
  started_at: string | null; // ISO 8601
}

export interface AgentEngine {
  start(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(): Promise<void>;
  cycle(observations?: Observation[]): Promise<OodaCycleResult>;
  getState(): AgentState;
}

export interface OodaCycleResult {
  cycle_id: string;
  agent_id: string;
  started_at: string;
  completed_at: string;
  duration_ms: number;
  observe: { observation_count: number };
  orient: Orientation | null;
  decide: { decision_id: string | null; action_count: number };
  act: { results: ActionResultSummary[] };
}

export interface ActionResultSummary {
  action_id: string;
  type: string;
  status: 'executed' | 'skipped' | 'failed' | 'dry_run';
  error?: string;
}
