// ─── Human Feedback Loop Types ─────────────────────────────────────
// Backend types for risk scoring, channel dispatch, and render engine.

// ─── Configuration ──────────────────────────────────────────────────

export interface HFLConfig {
  client_id: string;
  auto_approve_threshold: number; // USD — below this, auto-execute
  channels: ChannelConfig[];
  default_channel: string;
  escalation_rules: EscalationRule[];
  timeout_ms: number; // how long to wait for human response
  scorecard_base_url?: string; // Plinth URL for "Ver detalle" links (e.g. https://plinth.polanyi.tech)
}

export interface ChannelConfig {
  id: string;
  type: 'webhook' | 'mcp_callback';
  url: string;
  render_level: RenderLevel;
  active: boolean;
}

export type RenderLevel = 'minimal' | 'rich' | 'full';

export interface EscalationRule {
  condition: string; // e.g. 'budget_change > 10000'
  urgency: Urgency;
  channel_id: string; // override default channel
}

export type Urgency = 'low' | 'medium' | 'high' | 'critical';

// ─── Risk Scoring ───────────────────────────────────────────────────

export interface RiskInput {
  run_id: string;
  pipeline_id: string;
  client_id?: string;
  total_duration_ms: number;
  stages_executed: number;
  stages_failed: number;
  usage?: {
    llm_tokens_used: { prompt: number; completion: number };
    actions_executed: number;
  };
  proposed_actions?: ProposedAction[];
  is_first_run: boolean;
}

export interface ProposedAction {
  type: string;
  description: string;
  estimated_impact_usd: number;
}

export interface RiskScore {
  needs_human: boolean;
  urgency: Urgency;
  reason: string;
  risk_factors: string[];
  total_impact_usd: number;
}

// ─── Render Engine ──────────────────────────────────────────────────

export interface RenderContext {
  channel: ChannelConfig;
  urgency: Urgency;
  complexity: 'simple' | 'moderate' | 'complex';
}

export interface RenderOutput {
  format: 'text' | 'markdown' | 'html' | 'json';
  content: string;
  actions: RenderAction[];
  attachments?: RenderAttachment[];
  metadata?: Record<string, unknown>;
}

export interface RenderAction {
  label: string;
  url: string;
  method: 'POST' | 'GET';
  style?: 'primary' | 'danger' | 'secondary';
}

export interface RenderAttachment {
  type: string;
  data: unknown;
}

// ─── Channel Dispatch ───────────────────────────────────────────────

export interface DispatchResult {
  channel_id: string;
  success: boolean;
  status_code?: number;
  error?: string;
  retries: number;
  dispatched_at: string;
}

// ─── HFL Decision (full record) ─────────────────────────────────────

export type HFLStatus =
  | 'auto_approved'
  | 'escalated'
  | 'human_approved'
  | 'human_rejected'
  | 'timed_out';

export interface HFLDecision {
  id: string;
  run_id: string;
  pipeline_id: string;
  client_id?: string;
  needs_human: boolean;
  urgency: Urgency;
  reason: string;
  status: HFLStatus;
  risk_score: RiskScore;
  dispatched_to?: string; // channel ID
  render_output?: RenderOutput;
  dispatch_result?: DispatchResult;
  human_response?: 'approved' | 'rejected';
  human_feedback?: string;
  created_at: string;
  resolved_at?: string;
}
