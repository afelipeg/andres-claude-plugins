// ─── Connector API Client ──────────────────────────────────────────

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

// ─── Types ──────────────────────────────────────────────────────────

export interface ConnectorStatus {
  platform: string;
  connected: boolean;
  syncing: boolean;
  last_sync: string | null;
}

export interface SyncResultResponse {
  platform: string;
  status: string;
  row_count: number;
  date_range: { start: string; end: string };
  synced_at: string;
  error?: string;
}

// ─── API Functions ──────────────────────────────────────────────────

export async function listConnectors(): Promise<ConnectorStatus[]> {
  const res = await fetchJson<{ connectors: ConnectorStatus[] }>('/v1/connectors');
  return res.connectors;
}

export async function connectPlatform(
  platform: string,
  tokens: { access_token: string; refresh_token?: string; expires_at?: string },
  accountId?: string,
): Promise<{ status: string; platform: string }> {
  return fetchJson(`/v1/connectors/${platform}/connect`, {
    method: 'POST',
    body: JSON.stringify({ tokens, account_id: accountId }),
  });
}

export async function disconnectPlatform(platform: string): Promise<{ status: string; platform: string }> {
  return fetchJson(`/v1/connectors/${platform}`, { method: 'DELETE' });
}

export async function syncPlatform(platform: string, dateRangeDays?: number): Promise<SyncResultResponse> {
  return fetchJson(`/v1/connectors/${platform}/sync`, {
    method: 'POST',
    body: JSON.stringify({ date_range_days: dateRangeDays }),
  });
}

export async function getSyncResults(platform: string): Promise<SyncResultResponse> {
  return fetchJson(`/v1/connectors/${platform}/sync/results`);
}
