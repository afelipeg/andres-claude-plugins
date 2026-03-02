// ─── Auth Routes ────────────────────────────────────────────────────

import { Hono } from 'hono';
import { clientCredentialsGrant } from '@openagency/auth';
import { createApiKeyRecord, revokeApiKey, listApiKeys } from '@openagency/auth';
import { authMiddleware } from '@openagency/auth/middleware';
import type { Role } from '@openagency/types';

export function authRoutes() {
  const app = new Hono();

  // ─── M2M Token Exchange ─────────────────────────────────────────
  app.post('/v1/auth/token', async (c) => {
    const body = await c.req.json<{
      grant_type: string;
      client_id: string;
      client_secret: string;
    }>();

    if (body.grant_type !== 'client_credentials') {
      return c.json(
        { error: 'unsupported_grant_type', message: 'Only client_credentials is supported', status: 400 },
        400,
      );
    }

    const result = await clientCredentialsGrant(body.client_id, body.client_secret);
    if (!result) {
      return c.json(
        { error: 'invalid_client', message: 'Invalid client credentials', status: 401 },
        401,
      );
    }

    return c.json(result);
  });

  // ─── API Key Management (admin only) ────────────────────────────
  app.post('/v1/auth/api-keys', authMiddleware('admin:*'), async (c) => {
    const body = await c.req.json<{
      name: string;
      role: Role;
      scopes: string[];
    }>();

    const { record, key } = createApiKeyRecord(body.name, body.role, body.scopes);
    return c.json(
      {
        id: record.id,
        key, // shown only once
        prefix: record.prefix,
        name: record.name,
        role: record.role,
        scopes: record.scopes,
        created_at: record.created_at,
      },
      201,
    );
  });

  app.get('/v1/auth/api-keys', authMiddleware('admin:*'), (c) => {
    const keys = listApiKeys().map((k) => ({
      id: k.id,
      prefix: k.prefix,
      name: k.name,
      role: k.role,
      scopes: k.scopes,
      created_at: k.created_at,
      revoked: k.revoked,
    }));
    return c.json({ keys });
  });

  app.delete('/v1/auth/api-keys/:hash', authMiddleware('admin:*'), (c) => {
    const hash = c.req.param('hash');
    const revoked = revokeApiKey(hash);
    if (!revoked) {
      return c.json({ error: 'not_found', message: 'API key not found', status: 404 }, 404);
    }
    return c.json({ message: 'API key revoked' });
  });

  return app;
}
