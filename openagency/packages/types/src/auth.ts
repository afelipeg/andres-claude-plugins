// ─── Authentication & Authorization Types ───────────────────────────

export type AuthMethod = 'jwt' | 'api_key' | 'm2m_oauth2';

export type Role = 'super_admin' | 'agency_admin' | 'account_manager' | 'viewer' | 'admin' | 'engine_user' | 'readonly' | 'agent';

export interface AuthPayload {
  sub: string;
  role: Role;
  scopes: string[];
  iat: number;
  exp: number;
  agency_id?: string;
}

export interface ApiKeyRecord {
  id: string;
  prefix: string;
  hash: string;
  name: string;
  role: Role;
  scopes: string[];
  created_at: string;
  revoked: boolean;
}

export interface M2MClient {
  client_id: string;
  client_secret_hash: string;
  name: string;
  role: Role;
  scopes: string[];
}
