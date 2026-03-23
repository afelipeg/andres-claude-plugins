// ─── Connector API Client ──────────────────────────────────────────
// Updated 2026-03-22: syncPlatform now uses the agency connector
// endpoint which reads credentials from PostgreSQL (not file-based).

const API_URL = import.meta.env.VITE_API_URL ?? '';
const API_KEY = import.meta.env.VITE_API_KEY ?? '';

function headers(): HeadersInit {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (API_KEY) h['X-API-Key'] = API_KEY;
  const token = localStorage.getItem('plinth_token');
  if (token) h['Authorization'] = `Bearer ${token}`;
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
  advertisers_synced?: number;
  advertisers_failed?: number;
  date_range?: { start: string; end: string };
  synced_at: string;
  error?: string;
  errors?: Array<{ advertiser_id: string; error: string }>;
}

/** Sync status with scheduling metadata */
export interface SyncStatusResponse {
  platform: string;
  has_synced: boolean;
  last_sync: SyncResultResponse | null;
  row_count: number;
  synced_at: string | null;
}

// ─── API Functions ──────────────────────────────────────────────────

export async function listConnectors(): Promise<ConnectorStatus[]> {
  const res = await fetchJson<{ connectors: ConnectorStatus[] }>('/v1/connectors');
  return res.connectors;
}

export async function connectPlatform(
  platform: string,
  tokens: { access_token: string; refresh_token?: string; expires_at?: string },
  credentials?: Record<string, string | undefined>,
): Promise<{ status: string; platform: string }> {
  return fetchJson(`/v1/connectors/${platform}/connect`, {
    method: 'POST',
    body: JSON.stringify({ tokens, ...credentials }),
  });
}

export async function disconnectPlatform(platform: string): Promise<{ status: string; platform: string }> {
  return fetchJson(`/v1/connectors/${platform}`, { method: 'DELETE' });
}

/**
 * Sync platform data.
 * Uses the agency connector endpoint which reads encrypted credentials
 * from PostgreSQL and syncs ALL active advertisers for the platform.
 * Falls back to the legacy connector endpoint if agency route returns 404.
 */
export async function syncPlatform(platform: string, dateRangeDays?: number): Promise<SyncResultResponse> {
  try {
    // Try agency connector sync first (multi-advertiser, DB-persisted credentials)
    return await fetchJson<SyncResultResponse>(`/v1/agency/connections/${platform}/sync`, {
      method: 'POST',
      body: JSON.stringify({ date_range_days: dateRangeDays }),
    });
  } catch (err) {
    // If agency route fails (no connection saved), fall back to legacy connector
    const msg = err instanceof Error ? err.message : '';
    if (msg.includes('404') || msg.includes('not_connected') || msg.includes('no_agency')) {
      return fetchJson<SyncResultResponse>(`/v1/connectors/${platform}/sync`, {
        method: 'POST',
        body: JSON.stringify({ date_range_days: dateRangeDays }),
      });
    }
    throw err;
  }
}

/**
 * Get sync results. Tries agency endpoint first, then legacy.
 */
export async function getSyncResults(platform: string): Promise<SyncResultResponse> {
  try {
    const res = await fetchJson<{ platform: string; has_synced: boolean; last_sync: SyncResultResponse | null }>(
      `/v1/agency/connections/${platform}/sync/status`,
    );
    if (res.has_synced && res.last_sync) {
      return res.last_sync;
    }
  } catch {
    // Fall back to legacy
  }
  return fetchJson(`/v1/connectors/${platform}/sync/results`);
}

/**
 * Get sync status for a platform (lightweight — no data payload).
 * Returns has_synced, last_sync metadata, and row_count.
 * Gracefully returns defaults if no sync has occurred.
 */
export async function getSyncStatus(platform: string): Promise<SyncStatusResponse> {
  try {
    const res = await fetchJson<{
      platform: string;
      has_synced: boolean;
      last_sync: SyncResultResponse | null;
    }>(`/v1/agency/connections/${platform}/sync/status`);
    return {
      platform: res.platform ?? platform,
      has_synced: res.has_synced ?? false,
      last_sync: res.last_sync ?? null,
      row_count: res.last_sync?.row_count ?? 0,
      synced_at: res.last_sync?.synced_at ?? null,
    };
  } catch {
    // No sync status available — return defaults
    return {
      platform,
      has_synced: false,
      last_sync: null,
      row_count: 0,
      synced_at: null,
    };
  }
}

/**
 * Health check for a platform connection.
 * Validates that stored credentials can authenticate with the platform API.
 */
export async function checkPlatformHealth(platform: string): Promise<{
  healthy: boolean;
  error?: string;
  checked_at: string;
}> {
  return fetchJson(`/v1/agency/connections/${platform}/health`, {
    method: 'POST',
  });
}

// ─── OAuth Flow ────────────────────────────────────────────────────

export async function getAuthUrl(
  platform: string,
  redirectUri: string,
  state?: string,
): Promise<{ auth_url: string }> {
  const params = new URLSearchParams({ redirect_uri: redirectUri });
  if (state) params.set('state', state);
  return fetchJson(`/v1/connectors/${platform}/auth-url?${params}`);
}

export async function exchangeOAuthCode(
  platform: string,
  code: string,
  redirectUri: string,
): Promise<{ status: string; platform: string }> {
  return fetchJson(`/v1/connectors/${platform}/callback`, {
    method: 'POST',
    body: JSON.stringify({ code, redirect_uri: redirectUri }),
  });
}

export function openOAuthPopup(url: string): Promise<{ code: string; state?: string }> {
  return new Promise((resolve, reject) => {
    const w = 600;
    const h = 700;
    const left = window.screenX + (window.innerWidth - w) / 2;
    const top = window.screenY + (window.innerHeight - h) / 2;
    const popup = window.open(
      url,
      'oauth_popup',
      `width=${w},height=${h},left=${left},top=${top}`,
    );
    if (!popup) {
      reject(new Error('Popup blocked — please allow popups for this site'));
      return;
    }

    const handler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'oauth_callback') {
        window.removeEventListener('message', handler);
        clearInterval(interval);
        resolve({ code: event.data.code, state: event.data.state });
      }
    };
    window.addEventListener('message', handler);

    // Detect popup closed without completing
    const interval = setInterval(() => {
      if (popup.closed) {
        clearInterval(interval);
        window.removeEventListener('message', handler);
        reject(new Error('Authorization window was closed'));
      }
    }, 500);
  });
}
