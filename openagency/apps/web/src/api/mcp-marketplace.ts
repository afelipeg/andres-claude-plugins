// ─── MCP Marketplace API Client ──────────────────────────────────────

const API_URL = import.meta.env.VITE_API_URL ?? '';
const API_KEY = import.meta.env.VITE_API_KEY ?? '';

function headers(): Record<string, string> {
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

// ─── Types ───────────────────────────────────────────────────────────

export interface AuthField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'textarea' | 'select';
  help: string;
  required?: boolean;
  options?: string[];
}

export interface CatalogEntry {
  id: string;
  name: string;
  description: string;
  repo?: string;
  endpoint?: string;
  hosted: boolean;
  auth_type: string;
  auth_fields: AuthField[];
  logo: string;
  tools_preview: string[];
  tools_count: number;
  source: 'official' | 'open-source';
  badge: string | null;
}

export interface McpConnection {
  id: string;
  client_id: string;
  name: string;
  url: string;
  catalog_id: string | null;
  tools: Array<{ name: string; description: string }>;
  status: 'connected' | 'failed' | 'stale';
  error: string | null;
  connected_at: string;
  last_health: string | null;
  process_pid: number | null;
}

// ─── API Functions ───────────────────────────────────────────────────

export async function getCatalog(): Promise<CatalogEntry[]> {
  const res = await fetchJson<{ catalog: CatalogEntry[] }>('/v1/mcp/catalog');
  return res.catalog;
}

export async function listConnections(): Promise<McpConnection[]> {
  const res = await fetchJson<{ connections: McpConnection[] }>('/v1/mcp/connections');
  return res.connections;
}

export async function createConnection(data: {
  catalog_id?: string;
  name?: string;
  url?: string;
  auth_type?: string;
  auth_fields?: Record<string, string>;
  auth_token?: string;
  endpoint_url?: string;
}): Promise<{ id: string; name: string; tools_discovered: number; status: string }> {
  return fetchJson('/v1/mcp/connections', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function testConnection(id: string): Promise<{ status: string; tools_count?: number; error?: string }> {
  return fetchJson(`/v1/mcp/connections/${id}/test`, { method: 'POST' });
}

export async function deleteConnection(id: string): Promise<void> {
  await fetchJson(`/v1/mcp/connections/${id}`, { method: 'DELETE' });
}
