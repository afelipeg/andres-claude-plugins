// ─── Connector API Client ──────────────────────────────────────────

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

export async function syncPlatform(platform: string, dateRangeDays?: number): Promise<SyncResultResponse> {
  return fetchJson(`/v1/connectors/${platform}/sync`, {
    method: 'POST',
    body: JSON.stringify({ date_range_days: dateRangeDays }),
  });
}

export async function getSyncResults(platform: string): Promise<SyncResultResponse> {
  return fetchJson(`/v1/connectors/${platform}/sync/results`);
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
