// ─── Super Admin API Client ──────────────────────────────────────────

const API_URL = import.meta.env.VITE_API_URL ?? '';

function headers(): HeadersInit {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('plinth_token');
  if (token) h['Authorization'] = `Bearer ${token}`;
  const apiKey = import.meta.env.VITE_API_KEY as string | undefined;
  if (apiKey) h['X-API-Key'] = apiKey;
  return h;
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { ...init, headers: { ...headers(), ...init?.headers } });
  if (!res.ok) throw new Error(`Admin API error ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

// ─── Types ──────────────────────────────────────────────────────────

export interface AdminOverview {
  total_agencies: number;
  total_users: number;
  active_users: number;
  runs_today: number;
  runs_mtd: number;
  llm_cost_mtd: number;
  outcome_fees_mtd: number;
  a2a_calls_mtd: number;
  total_connectors: number;
  stale_connectors: number;
}

export interface AgencySummary {
  agency_id: string;
  connection_count: number;
  advertiser_count: number;
  user_count: number;
  run_count: number;
  last_activity: string | null;
}

export interface AdminUser {
  id: string;
  email: string;
  role: string;
  agency_id: string | null;
  status: string;
  created_at: string;
  last_login: string | null;
}

export interface AdminRun {
  id: string;
  agency_id: string;
  pipeline_id: string;
  status: string;
  engine_count: number;
  duration_ms: number;
  llm_cost_usd: number;
  started_at: string;
  completed_at: string | null;
}

export interface TokenData {
  by_day: Array<{ date: string; tokens_prompt: number; tokens_completion: number; llm_cost_usd: number }>;
  by_agency: Array<{ agency_id: string; tokens_prompt: number; tokens_completion: number; llm_cost_usd: number }>;
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
  connected_at: string;
  created_at: string;
  updated_at: string;
  advertiser_count: number;
}

export interface FederationData {
  peers: Array<Record<string, unknown>>;
  count_by_day: Array<{ date: string; inbound: number; outbound: number }>;
  discovered: Array<Record<string, unknown>>;
  log: Array<Record<string, unknown>>;
}

export interface AdminQuotaRequest {
  id: string;
  agency_id: string;
  requested_brand_count: number;
  current_brand_count: number;
  status: string;
  reason: string;
  created_at: string;
  reviewed_at: string | null;
}

// ─── API Functions ──────────────────────────────────────────────────

export async function getOverview(): Promise<AdminOverview> {
  return fetchJson('/v1/admin/overview');
}

export async function getAgencies(): Promise<{ agencies: AgencySummary[] }> {
  return fetchJson('/v1/admin/agencies');
}

export async function getUsers(): Promise<{ users: AdminUser[] }> {
  return fetchJson('/v1/admin/users');
}

export async function getRuns(limit = 50): Promise<{ runs: AdminRun[] }> {
  return fetchJson(`/v1/admin/runs?limit=${limit}`);
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

export async function deactivateUser(userId: string): Promise<void> {
  await fetchJson(`/v1/admin/users/${userId}/deactivate`, { method: 'POST' });
}

export async function reactivateUser(userId: string): Promise<void> {
  await fetchJson(`/v1/admin/users/${userId}/reactivate`, { method: 'POST' });
}

export async function deleteAgency(agencyId: string): Promise<void> {
  await fetchJson(`/v1/admin/agencies/${agencyId}`, { method: 'DELETE' });
}

export async function impersonateAgency(agencyId: string): Promise<{ token: string }> {
  return fetchJson(`/v1/admin/agencies/${agencyId}/impersonate`, { method: 'POST' });
}

export async function getQuotaRequests(): Promise<{ requests: AdminQuotaRequest[] }> {
  return fetchJson('/v1/admin/quota-requests');
}

export async function approveQuotaRequest(requestId: string, newBrandCount: number): Promise<void> {
  await fetchJson(`/v1/admin/quota-requests/${requestId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ brand_count: newBrandCount }),
  });
}

export async function denyQuotaRequest(requestId: string, reason: string): Promise<void> {
  await fetchJson(`/v1/admin/quota-requests/${requestId}/deny`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}
