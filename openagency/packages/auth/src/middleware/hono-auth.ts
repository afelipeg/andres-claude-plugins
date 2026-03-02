// ─── Hono Auth Middleware ────────────────────────────────────────────

import type { Context, Next } from 'hono';
import { verifyToken } from '../jwt.js';
import { validateApiKey } from '../api-keys.js';
import { hasScope } from '../rbac.js';
import type { AuthPayload } from '@openagency/types';

declare module 'hono' {
  interface ContextVariableMap {
    auth: AuthPayload;
  }
}

/**
 * Authentication middleware for Hono.
 * Tries JWT from `Authorization: Bearer <token>` first,
 * falls back to `X-API-Key` header.
 */
export function authMiddleware(requiredScope?: string) {
  return async (c: Context, next: Next) => {
    let payload: AuthPayload | null = null;

    // Try JWT Bearer token
    const authHeader = c.req.header('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      try {
        payload = await verifyToken(token);
      } catch {
        return c.json({ error: 'unauthorized', message: 'Invalid or expired token', status: 401 }, 401);
      }
    }

    // Fallback: API Key
    if (!payload) {
      const apiKey = c.req.header('X-API-Key');
      if (apiKey) {
        const record = validateApiKey(apiKey);
        if (!record) {
          return c.json({ error: 'unauthorized', message: 'Invalid API key', status: 401 }, 401);
        }
        payload = {
          sub: record.id,
          role: record.role,
          scopes: record.scopes,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        };
      }
    }

    if (!payload) {
      return c.json(
        { error: 'unauthorized', message: 'Authentication required. Provide Bearer token or X-API-Key header.', status: 401 },
        401,
      );
    }

    // Check scope if required
    if (requiredScope && !hasScope(payload.scopes, requiredScope)) {
      return c.json(
        { error: 'forbidden', message: `Missing required scope: ${requiredScope}`, status: 403 },
        403,
      );
    }

    c.set('auth', payload);
    await next();
  };
}
