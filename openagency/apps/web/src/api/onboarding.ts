// ─── Onboarding API helpers ──────────────────────────────────────────

const API_URL = import.meta.env.VITE_API_URL ?? '';

function headers(): HeadersInit {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('plinth_token');
  if (token) h['Authorization'] = `Bearer ${token}`;
  const apiKey = import.meta.env.VITE_API_KEY as string | undefined;
  if (apiKey) h['X-API-Key'] = apiKey;
  return h;
}

export function isOnboarded(): boolean {
  return localStorage.getItem('plinth_onboarded') === 'true';
}

export function markOnboarded(): void {
  localStorage.setItem('plinth_onboarded', 'true');
}

export async function getAuthUrl(platform: string, redirectUri: string): Promise<string> {
  const res = await fetch(
    `${API_URL}/v1/connectors/${platform}/auth-url?redirect_uri=${encodeURIComponent(redirectUri)}`,
    { headers: headers() },
  );
  if (!res.ok) throw new Error(`Failed to get auth URL for ${platform}`);
  const data = await res.json() as { url: string };
  return data.url;
}

export async function getConnectorStatus(): Promise<Array<{ platform: string; connected: boolean; last_sync?: string }>> {
  const res = await fetch(`${API_URL}/v1/connectors/status`, { headers: headers() });
  if (!res.ok) return [];
  const data = await res.json() as { platforms: Array<{ platform: string; connected: boolean; last_sync?: string }> };
  return data.platforms ?? [];
}
