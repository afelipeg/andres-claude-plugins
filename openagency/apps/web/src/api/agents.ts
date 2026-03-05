// ─── Agent & Mesh API Client ───────────────────────────────────────

const API_URL = import.meta.env.VITE_API_URL ?? '';
const API_KEY = import.meta.env.VITE_API_KEY ?? '';

function headers(): HeadersInit {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (API_KEY) h['X-API-Key'] = API_KEY;
  return h;
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { ...init, headers: { ...headers(), ...init?.headers } });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

// ─── Agent endpoints ───────────────────────────────────────────────

export interface AgentState {
  agent_id: string;
  engine_id: string;
  status: string;
  current_phase: string | null;
  cycles_completed: number;
  started_at: string | null;
}

export async function listAgents(): Promise<AgentState[]> {
  const res = await fetchJson<{ agents: AgentState[] }>('/v1/agents');
  return res.agents;
}

export async function startAgent(id: string): Promise<AgentState> {
  return fetchJson<AgentState>(`/v1/agents/${id}/start`, { method: 'POST' });
}

export async function stopAgent(id: string): Promise<AgentState> {
  return fetchJson<AgentState>(`/v1/agents/${id}/stop`, { method: 'POST' });
}

export async function pauseAgent(id: string): Promise<AgentState> {
  return fetchJson<AgentState>(`/v1/agents/${id}/pause`, { method: 'POST' });
}

export async function cycleAgent(id: string): Promise<unknown> {
  return fetchJson(`/v1/agents/${id}/cycle`, { method: 'POST' });
}

// ─── Decision endpoints ────────────────────────────────────────────

export interface PendingDecision {
  id: string;
  agent_id: string;
  reasoning: string;
  confidence: number;
  risk_level: string;
  requires_approval: boolean;
  actions: Array<{ type: string; target: Record<string, unknown>; estimated_impact: string }>;
}

export async function listPendingDecisions(): Promise<PendingDecision[]> {
  const res = await fetchJson<{ decisions: PendingDecision[] }>('/v1/agents/decisions/pending');
  return res.decisions;
}

export async function approveDecision(agentId: string, decisionId: string): Promise<void> {
  await fetchJson(`/v1/agents/${agentId}/decisions/${decisionId}/approve`, { method: 'POST' });
}

export async function rejectDecision(agentId: string, decisionId: string): Promise<void> {
  await fetchJson(`/v1/agents/${agentId}/decisions/${decisionId}/reject`, { method: 'POST' });
}

// ─── Mesh endpoints ────────────────────────────────────────────────

export interface MeshPipeline {
  id: string;
  name: string;
  description: string;
  stage_count: number;
  stages: Array<{ agent_id: string; order: number; skills: string[] }>;
}

export interface MeshRunSummary {
  id: string;
  pipeline_id: string;
  status: string;
  started_at: string;
  completed_at?: string;
  total_duration_ms: number;
}

export interface MeshRunDetail {
  id: string;
  pipeline_id: string;
  status: string;
  started_at: string;
  completed_at?: string;
  total_duration_ms: number;
  stage_results: Record<string, {
    agent_id: string;
    status: string;
    duration_ms: number;
    skills_invoked: string[];
    error?: string;
  }>;
  usage?: {
    stages_executed: number;
    total_duration_ms: number;
    actions_executed: number;
  };
}

export async function listPipelines(): Promise<MeshPipeline[]> {
  const res = await fetchJson<{ pipelines: MeshPipeline[] }>('/v1/mesh/pipelines');
  return res.pipelines;
}

export async function executePipeline(pipelineId: string, goalId?: string): Promise<MeshRunDetail> {
  return fetchJson<MeshRunDetail>(`/v1/mesh/pipelines/${pipelineId}/execute`, {
    method: 'POST',
    body: JSON.stringify({ goal_id: goalId }),
  });
}

export async function listRuns(): Promise<MeshRunSummary[]> {
  const res = await fetchJson<{ runs: MeshRunSummary[] }>('/v1/mesh/runs');
  return res.runs;
}

export async function getRun(runId: string): Promise<MeshRunDetail> {
  return fetchJson<MeshRunDetail>(`/v1/mesh/runs/${runId}`);
}

// ─── Goal endpoints ────────────────────────────────────────────────

export interface GoalSummary {
  id: string;
  name: string;
  target_metric: string;
  target_value: number;
  current_value?: number;
  progress_pct: number;
  status: string;
}

export async function listGoals(): Promise<GoalSummary[]> {
  const res = await fetchJson<{ goals: GoalSummary[] }>('/v1/goals');
  return res.goals;
}

// ─── Chat endpoints ───────────────────────────────────────────────

export interface ChatMessage {
  role: string;
  content: string;
  timestamp: string;
}

export async function getChatHistory(agentId: string): Promise<ChatMessage[]> {
  const res = await fetchJson<{ messages: ChatMessage[] }>(`/v1/agents/${agentId}/chat`);
  return res.messages;
}

export async function sendChatMessage(agentId: string, message: string): Promise<{
  messages: ChatMessage[];
  cycle_result?: { cycle_id: string; actions: number; reasoning?: string };
}> {
  return fetchJson(`/v1/agents/${agentId}/chat`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}
