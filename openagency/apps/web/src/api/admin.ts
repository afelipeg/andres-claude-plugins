// ─── Super Admin API Client ──────────────────────────────────────────

const API_URL = import.meta.env.VITE_API_URL ?? '';

function headers(): HeadersInit {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('plinth_token');
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { ...init, headers: { ...headers(), ...init?.headers } });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

// ─── Types ───────────────────────────────────────────────────────────

export interface AdminOverview {
  total_agencies: number;
  total_users: number;
  active_users: number;
  runs_today: number;
  runs_mtd: number;
  llm_cost_mtd: number;
  outcome_fees_mtd: number;
  a2a_calls_mtd: number;
  stale_connectors: number;
  total_connectors: number;
}

export interface AgencySummary {
  agency_id: string;
  connection_count: number;
  advertiser_count: number;
  user_count: number;
  run_count: number;
  last_activity: string;
}

export interface AgencyDetail {
  agency_id: string;
  connections: Array<Record<string, unknown>>;
  advertisers: Array<Record<string, unknown>>;
  runs: Array<Record<string, unknown>>;
  scorecards: Array<Record<string, unknown>>;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  last_login_at: string | null;
  created_at: string;
}

export interface AdminRun {
  id: string;
  pipeline_id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  total_duration_ms: number;
  client_id: string | null;
  goal_id: string | null;
  usage: Record<string, unknown> | null;
}

export interface TokenData {
  by_day: Array<Record<string, unknown>>;
  by_agency: Array<Record<string, unknown>>;
  by_model: Array<{ model: string; tokens_prompt: number; tokens_completion: number; llm_cost_usd: number }>;
  by_engine: Array<{ engine_id: string; tokens_prompt: number; tokens_completion: number; llm_cost_usd: number; skills_invoked: number }>;
  mtd: Record<string, number>;
}

export interface AdminConnector {
  id: string;
  agency_id: string;
  platform: string;
  connection_type: string;
  status: string;
  created_at: string;
  updated_at: string;
  advertiser_count: number;
}

export interface FederationData {
  log: Array<Record<string, unknown>>;
  peers: Array<{ peer_url: string; peer_name: string | null; total: number; success: number; failed: number; last_call: string }>;
  count_by_day: Array<{ date: string; inbound: number; outbound: number }>;
  discovered: Array<Record<string, unknown>>;
}

export interface ImpersonateResult {
  token: string;
  expires_at: string;
  agency_id: string;
  impersonated_by: string;
}

// ─── API Calls ───────────────────────────────────────────────────────

export async function getOverview(): Promise<AdminOverview> {
  return fetchJson('/v1/admin/overview');
}

export async function getAgencies(): Promise<{ agencies: AgencySummary[] }> {
  return fetchJson('/v1/admin/agencies');
}

export async function getAgencyDetail(id: string): Promise<AgencyDetail> {
  return fetchJson(`/v1/admin/agencies/${id}`);
}

export async function getUsers(params?: { role?: string; status?: string; limit?: number; offset?: number }): Promise<{ users: AdminUser[]; total: number }> {
  const qs = new URLSearchParams();
  if (params?.role) qs.set('role', params.role);
  if (params?.status) qs.set('status', params.status);
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.offset) qs.set('offset', String(params.offset));
  const q = qs.toString();
  return fetchJson(`/v1/admin/users${q ? `?${q}` : ''}`);
}

export async function getRuns(params?: { status?: string; client_id?: string; from?: string; to?: string; limit?: number; offset?: number }): Promise<{ runs: AdminRun[]; total: number }> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.client_id) qs.set('client_id', params.client_id);
  if (params?.from) qs.set('from', params.from);
  if (params?.to) qs.set('to', params.to);
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.offset) qs.set('offset', String(params.offset));
  const q = qs.toString();
  return fetchJson(`/v1/admin/runs${q ? `?${q}` : ''}`);
}

export async function getTokens(days = 30): Promise<TokenData> {
  return fetchJson(`/v1/admin/tokens?days=${days}`);
}

export async function getConnectors(): Promise<{ connectors: AdminConnector[] }> {
  return fetchJson('/v1/admin/connectors');
}

export async function getFederation(limit = 50): Promise<FederationData> {
  return fetchJson(`/v1/admin/federation?limit=${limit}`);
}

export async function getFederationPeers(): Promise<{ peers: Array<Record<string, unknown>> }> {
  return fetchJson('/v1/admin/federation/peers');
}

export async function deactivateUser(id: string): Promise<void> {
  await fetchJson(`/v1/admin/users/${id}/deactivate`, { method: 'POST' });
}

export async function reactivateUser(id: string): Promise<void> {
  await fetchJson(`/v1/admin/users/${id}/reactivate`, { method: 'POST' });
}

export async function deleteAgency(id: string): Promise<void> {
  await fetchJson(`/v1/admin/agencies/${id}`, { method: 'DELETE' });
}

export async function impersonateAgency(id: string): Promise<ImpersonateResult> {
  return fetchJson(`/v1/admin/agencies/${id}/impersonate`, { method: 'POST' });
}

// ─── Quota Management (Super Admin) ─────────────────────────────

export interface AdminQuotaRequest {
  id: string;
  agency_id: string;
  requested_by: string;
  month: string;
  extra_runs_requested: number;
  reason: string | null;
  status: string;
  created_at: string;
  agency_name?: string;
  requester_email?: string;
  requester_name?: string;
}

export async function getQuotaRequests(): Promise<{ requests: AdminQuotaRequest[]; pending_count: number }> {
  return fetchJson('/v1/admin/quota/requests');
}

export async function approveQuotaRequest(id: string, extra_runs_granted: number): Promise<void> {
  await fetchJson(`/v1/admin/quota/requests/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ extra_runs_granted }),
  });
}

export async function denyQuotaRequest(id: string): Promise<void> {
  await fetchJson(`/v1/admin/quota/requests/${id}/deny`, { method: 'POST' });
}

export async function getAgencyQuota(id: string): Promise<{ agency: Record<string, unknown>; usage_history: Array<Record<string, unknown>> }> {
  return fetchJson(`/v1/admin/agencies/${id}/quota`);
}

export async function updateAgency(id: string, data: { brand_count?: number; name?: string }): Promise<void> {
  await fetchJson(`/v1/admin/agencies/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}
