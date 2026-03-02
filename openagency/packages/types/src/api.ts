// ─── API Response Types ─────────────────────────────────────────────

import type { EngineResult } from './engine.js';

export interface ApiEngineResult<T = unknown> extends EngineResult<T> {
  trace_id: string;
}

export interface ApiError {
  error: string;
  message: string;
  status: number;
  trace_id?: string;
}

export interface ApiHealthResponse {
  status: 'ok' | 'degraded';
  version: string;
  uptime_s: number;
}

export interface ApiEngineListItem {
  id: string;
  name: string;
  description: string;
  skills: string[];
}

export interface ApiTokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
}

export interface ApiKeyCreateRequest {
  name: string;
  role: string;
  scopes: string[];
}

export interface ApiKeyCreateResponse {
  id: string;
  key: string; // Full key, shown only once
  prefix: string;
  name: string;
  created_at: string;
}
