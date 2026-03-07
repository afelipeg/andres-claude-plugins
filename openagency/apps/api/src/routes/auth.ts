// ─── Auth Routes ────────────────────────────────────────────────────
// Endpoints for user registration, login, session, and API key management.

import { Hono } from 'hono';
import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import { signToken, clientCredentialsGrant } from '@openagency/auth';
import { createApiKeyRecord, revokeApiKey, listApiKeys } from '@openagency/auth';
import { authMiddleware } from '@openagency/auth/middleware';
import type { Role, AuthPayload } from '@openagency/types';

// ─── In-memory user store (until DB persistence) ────────────────────
interface UserRecord {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: Role;
  scopes: string[];
  created_at: string;
}

const userStore = new Map<string, UserRecord>(); // email → user
const userById = new Map<string, UserRecord>();  // id → user

function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

export function authRoutes() {
  const app = new Hono();

  // ─── Register ─────────────────────────────────────────────────────
  app.post('/v1/auth/register', async (c) => {
    try {
      const body = await c.req.json<{
        email: string;
        password: string;
        name: string;
      }>();

      if (!body.email?.trim() || !body.password || !body.name?.trim()) {
        return c.json(
          { error: 'validation_error', message: 'email, password, and name are required', status: 400 },
          400,
        );
      }

      const email = body.email.trim().toLowerCase();

      if (userStore.has(email)) {
        return c.json(
          { error: 'conflict', message: 'Email already registered', status: 409 },
          409,
        );
      }

      if (body.password.length < 8) {
        return c.json(
          { error: 'validation_error', message: 'Password must be at least 8 characters', status: 400 },
          400,
        );
      }

      const user: UserRecord = {
        id: randomUUID(),
        email,
        password_hash: hashPassword(body.password),
        name: body.name.trim(),
        role: 'engine_user',
        scopes: ['engine:*'],
        created_at: new Date().toISOString(),
      };

      userStore.set(email, user);
      userById.set(user.id, user);

      // Issue JWT immediately
      const token = await signToken({
        sub: user.id,
        role: user.role,
        scopes: user.scopes,
      });

      return c.json(
        {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          },
          token,
        },
        201,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: 'bad_request', message, status: 400 }, 400);
    }
  });

  // ─── Login ────────────────────────────────────────────────────────
  app.post('/v1/auth/login', async (c) => {
    try {
      const body = await c.req.json<{
        email: string;
        password: string;
      }>();

      if (!body.email?.trim() || !body.password) {
        return c.json(
          { error: 'validation_error', message: 'email and password are required', status: 400 },
          400,
        );
      }

      const email = body.email.trim().toLowerCase();
      const user = userStore.get(email);

      if (!user || user.password_hash !== hashPassword(body.password)) {
        return c.json(
          { error: 'unauthorized', message: 'Invalid email or password', status: 401 },
          401,
        );
      }

      const token = await signToken({
        sub: user.id,
        role: user.role,
        scopes: user.scopes,
      });

      return c.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        token,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: 'bad_request', message, status: 400 }, 400);
    }
  });

  // ─── Me (current user profile) ────────────────────────────────────
  app.get('/v1/auth/me', authMiddleware(), (c) => {
    const auth = c.get('auth') as AuthPayload | undefined;
    if (!auth) {
      return c.json({ error: 'unauthorized', message: 'Not authenticated', status: 401 }, 401);
    }

    const user = userById.get(auth.sub);
    if (user) {
      return c.json({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        scopes: user.scopes,
        created_at: user.created_at,
      });
    }

    // Fall back to auth payload (e.g. API key user or M2M client)
    return c.json({
      id: auth.sub,
      role: auth.role,
      scopes: auth.scopes,
    });
  });

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
