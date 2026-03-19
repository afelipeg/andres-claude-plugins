// ─── Agency Dashboard API Client ─────────────────────────────────────

const API_URL = import.meta.env.VITE_API_URL ?? '';

function headers(): HeadersInit {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('plinth_token');
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { headers: headers() });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export interface AgencyOverview {
  agency_id: string;
  agency_name: string;
  brand_count: number;
  runs_used: number;
  runs_limit: number;
  assistant_sessions_used: number;
  assistant_sessions_limit: number;
  active_connectors: number;
  total_runs: number;
  last_run: string | null;
  total_scorecards: number;
  month: string;
}

export async function getAgencyOverview(): Promise<AgencyOverview> {
  return fetchJson('/v1/agency/dashboard/overview');
}

export async function getAgencyRuns(params?: { limit?: number; status?: string }): Promise<{ runs: Array<Record<string, unknown>>; total: number }> {
  const qs = new URLSearchParams();
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.status) qs.set('status', params.status);
  const q = qs.toString();
  return fetchJson(`/v1/agency/dashboard/runs${q ? `?${q}` : ''}`);
}

export async function getAgencyUsage(days = 30): Promise<{ by_day: Array<Record<string, unknown>> }> {
  return fetchJson(`/v1/agency/dashboard/usage?days=${days}`);
}

export async function getAgencyScorecards(limit = 20): Promise<{ scorecards: Array<Record<string, unknown>> }> {
  return fetchJson(`/v1/agency/dashboard/scorecards?limit=${limit}`);
}

export async function getAgencyConnectors(): Promise<{ connectors: Array<Record<string, unknown>> }> {
  return fetchJson('/v1/agency/dashboard/connectors');
}
