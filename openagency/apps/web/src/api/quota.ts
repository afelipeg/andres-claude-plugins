// ─── Quota API Client ────────────────────────────────────────────────

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

export interface QuotaStatus {
  agency_id: string;
  agency_name: string;
  brand_count: number;
  month: string;
  resets_at: string;
  runs: {
    initial: { used: number; limit: number };
    optimization: { used: number; limit: number };
    total: { used: number; limit: number };
    extra_granted: number;
  };
  assistant: { used: number; limit: number };
}

export interface QuotaRequest {
  id: string;
  agency_id: string;
  requested_by: string;
  month: string;
  extra_runs_requested: number;
  reason: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  agency_name?: string;
  requester_email?: string;
  requester_name?: string;
}

export async function getQuotaStatus(): Promise<QuotaStatus> {
  return fetchJson('/v1/quota/status');
}

export async function requestExtraRuns(extra_runs_requested: number, reason?: string): Promise<{ request_id: string }> {
  return fetchJson('/v1/quota/request-runs', {
    method: 'POST',
    body: JSON.stringify({ extra_runs_requested, reason }),
  });
}

export async function getQuotaRequests(): Promise<{ requests: QuotaRequest[] }> {
  return fetchJson('/v1/quota/requests');
}

export async function updateBrandCount(brand_count: number): Promise<{ brand_count: number; monthly_run_limit: number }> {
  return fetchJson('/v1/quota/brand-count', {
    method: 'PATCH',
    body: JSON.stringify({ brand_count }),
  });
}
