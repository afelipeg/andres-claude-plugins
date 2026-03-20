// ─── Auth Routes ────────────────────────────────────────────────────
// Endpoints for user login, session, API key management, and user management.

import { Hono } from 'hono';
import { randomUUID, createHash } from 'node:crypto';
import { hashSync, compareSync } from 'bcryptjs';
import { signToken, clientCredentialsGrant } from '@openagency/auth';
import { createApiKeyRecord, revokeApiKey, listApiKeys } from '@openagency/auth';
import { authMiddleware } from '@openagency/auth/middleware';
import type { Role, AuthPayload } from '@openagency/types';
import type { UserRepo, UserRow } from '@openagency/memory';
import { sendEmail, UserInvitation, WelcomeEmail } from '@polanyi/email';

// ─── In-memory fallback (when no DB) ────────────────────────────────
interface UserRecord {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: Role;
  scopes: string[];
  status: 'active' | 'invited' | 'deactivated';
}

const memoryStore = new Map<string, UserRecord>(); // email → user
const memoryById = new Map<string, UserRecord>();  // id → user

const BCRYPT_ROUNDS = 12;

function hashPassword(password: string): string {
  return hashSync(password, BCRYPT_ROUNDS);
}

function verifyPassword(password: string, hash: string): boolean {
  // Support legacy SHA-256 hashes (64 hex chars) for migration
  if (/^[a-f0-9]{64}$/.test(hash)) {
    return createHash('sha256').update(password).digest('hex') === hash;
  }
  return compareSync(password, hash);
}

// ─── Seed admin user ────────────────────────────────────────────────
const ADMIN_PASSWORD = process.env['ADMIN_INITIAL_PASSWORD'] ?? (process.env['NODE_ENV'] !== 'production' ? 'Morchis1512*' : '');
const ADMIN_USER: UserRecord = {
  id: 'c1a2b3d4-0000-0000-0000-dedalo000001',
  email: 'dedalo@polanyi.tech',
  password_hash: ADMIN_PASSWORD ? hashPassword(ADMIN_PASSWORD) : '',
  name: 'Andrés',
  role: 'super_admin',
  scopes: ['*'],
  status: 'active',
};

memoryStore.set(ADMIN_USER.email, ADMIN_USER);
memoryById.set(ADMIN_USER.id, ADMIN_USER);

// ─── Helpers: DB or memory ─────────────────────────────────────────
async function getUser(repo: UserRepo | null, email: string): Promise<UserRecord | null> {
  if (repo) {
    const row = await repo.getByEmail(email);
    return row ? rowToRecord(row) : null;
  }
  return memoryStore.get(email) ?? null;
}

async function getUserById(repo: UserRepo | null, id: string): Promise<UserRecord | null> {
  if (repo) {
    const row = await repo.getById(id);
    return row ? rowToRecord(row) : null;
  }
  return memoryById.get(id) ?? null;
}

function rowToRecord(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    password_hash: row.password_hash,
    name: row.name,
    role: row.role as Role,
    scopes: row.scopes,
    status: row.status,
  };
}

function roleScopesMap(role: string): string[] {
  switch (role) {
    case 'super_admin': return ['*'];
    case 'agency_admin':
    case 'admin': return ['admin:*', 'engine:*', 'connectors:*'];
    case 'account_manager':
    case 'engine_user': return ['engine:*', 'connectors:read', 'hfl:*', 'pipeline:*'];
    case 'viewer': return ['dashboard:read', 'scorecard:read', 'billing:read'];
    default: return [];
  }
}

// ─── Seed admin to DB on startup ────────────────────────────────────
export async function seedAdminUser(repo: UserRepo): Promise<void> {
  const { setSeedStatus } = await import('./health.js');
  try {
    // Upsert by email (ON CONFLICT email) to handle any existing row
    await repo.upsert({
      id: ADMIN_USER.id,
      email: ADMIN_USER.email,
      password_hash: ADMIN_USER.password_hash,
      name: ADMIN_USER.name,
      role: ADMIN_USER.role,
      scopes: ADMIN_USER.scopes,
      status: 'active',
      invite_token: null,
    });
    // Ensure role is super_admin regardless of what was in DB before
    const existing = await repo.getByEmail(ADMIN_USER.email);
    if (existing && existing.role !== 'super_admin') {
      await repo.updateRole(existing.id, 'super_admin', ['*']);
    }
    // Report seed status for debugging
    const user = await repo.getByEmail(ADMIN_USER.email);
    setSeedStatus({
      seeded: true,
      role: user?.role,
    });
  } catch (err) {
    setSeedStatus({
      seeded: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ─── Routes ─────────────────────────────────────────────────────────
export function authRoutes(userRepo?: UserRepo | null) {
  const repo = userRepo ?? null;
  const app = new Hono();

  // ─── Register — closed ────────────────────────────────────────────
  app.post('/v1/auth/register', (c) => {
    return c.json(
      { error: 'forbidden', message: 'Registration is closed. Contact the administrator.', status: 403 },
      403,
    );
  });

  // ─── Login ────────────────────────────────────────────────────────
  app.post('/v1/auth/login', async (c) => {
    try {
      const body = await c.req.json<{ email: string; password: string }>();

      if (!body.email?.trim() || !body.password) {
        return c.json(
          { error: 'validation_error', message: 'email and password are required', status: 400 },
          400,
        );
      }

      const email = body.email.trim().toLowerCase();
      const user = await getUser(repo, email);

      if (!user || !verifyPassword(body.password, user.password_hash)) {
        return c.json(
          { error: 'unauthorized', message: 'Invalid email or password', status: 401 },
          401,
        );
      }

      if (user.status === 'deactivated') {
        return c.json(
          { error: 'forbidden', message: 'Account is deactivated', status: 403 },
          403,
        );
      }

      // Track last login
      if (repo) {
        repo.updateLastLogin(user.id).catch(() => {});
      }

      const token = await signToken({
        sub: user.id,
        role: user.role,
        scopes: user.scopes,
      });

      return c.json({
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
        token,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: 'bad_request', message, status: 400 }, 400);
    }
  });

  // ─── Me (current user profile) ────────────────────────────────────
  app.get('/v1/auth/me', authMiddleware(), async (c) => {
    const auth = c.get('auth') as AuthPayload | undefined;
    if (!auth) {
      return c.json({ error: 'unauthorized', message: 'Not authenticated', status: 401 }, 401);
    }

    const user = await getUserById(repo, auth.sub);
    if (user) {
      return c.json({
        user: { id: user.id, email: user.email, name: user.name, role: user.role, scopes: user.scopes },
      });
    }

    return c.json({ user: { id: auth.sub, role: auth.role, scopes: auth.scopes } });
  });

  // ─── M2M Token Exchange ─────────────────────────────────────────
  app.post('/v1/auth/token', async (c) => {
    const body = await c.req.json<{ grant_type: string; client_id: string; client_secret: string }>();

    if (body.grant_type !== 'client_credentials') {
      return c.json(
        { error: 'unsupported_grant_type', message: 'Only client_credentials is supported', status: 400 },
        400,
      );
    }

    const result = await clientCredentialsGrant(body.client_id, body.client_secret);
    if (!result) {
      return c.json({ error: 'invalid_client', message: 'Invalid client credentials', status: 401 }, 401);
    }

    return c.json(result);
  });

  // ─── API Key Management (admin only) ────────────────────────────
  app.post('/v1/auth/api-keys', authMiddleware('admin:*'), async (c) => {
    const body = await c.req.json<{ name: string; role: Role; scopes: string[] }>();
    const { record, key } = createApiKeyRecord(body.name, body.role, body.scopes);
    return c.json(
      { id: record.id, key, prefix: record.prefix, name: record.name, role: record.role, scopes: record.scopes, created_at: record.created_at },
      201,
    );
  });

  app.get('/v1/auth/api-keys', authMiddleware('admin:*'), (c) => {
    const keys = listApiKeys().map((k) => ({
      id: k.id, prefix: k.prefix, name: k.name, role: k.role, scopes: k.scopes, created_at: k.created_at, revoked: k.revoked,
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

  // ─── User Management (admin only) ────────────────────────────────

  // List all users
  app.get('/v1/users', authMiddleware('admin:*'), async (c) => {
    if (!repo) {
      const users = Array.from(memoryStore.values()).map((u) => ({
        id: u.id, email: u.email, name: u.name, role: u.role, status: u.status,
      }));
      return c.json({ users });
    }

    const rows = await repo.listAll();
    const users = rows.map((r) => ({
      id: r.id, email: r.email, name: r.name, role: r.role, status: r.status,
      last_login_at: r.last_login_at, created_at: r.created_at,
    }));
    return c.json({ users });
  });

  // Invite a new user
  app.post('/v1/auth/invite', authMiddleware('admin:*'), async (c) => {
    const body = await c.req.json<{ email: string; role?: string; name?: string; job_title?: string; advertiser_access?: string[] }>();

    if (!body.email?.trim()) {
      return c.json({ error: 'validation_error', message: 'email is required', status: 400 }, 400);
    }

    const email = body.email.trim().toLowerCase();
    const role = (body.role ?? 'viewer') as Role;
    const scopes = roleScopesMap(role);
    const inviteToken = randomUUID();
    const userId = randomUUID();

    if (repo) {
      const existing = await repo.getByEmail(email);
      if (existing) {
        return c.json({ error: 'conflict', message: 'User already exists', status: 409 }, 409);
      }

      await repo.create({
        id: userId,
        email,
        password_hash: '',
        name: body.name ?? '',
        role,
        scopes,
        status: 'invited',
        invite_token: inviteToken,
      });
      // Store job_title + advertiser_access for account_manager/engine_user
      if (body.job_title || body.advertiser_access) {
        const db = (repo as unknown as { sql: unknown }).sql as { unsafe: (q: string, p?: unknown[]) => Promise<unknown[]> };
        await db.unsafe(
          'UPDATE users SET job_title = $1, advertiser_access = $2 WHERE id = $3',
          [body.job_title ?? '', JSON.stringify(body.advertiser_access ?? []), userId],
        );
      }
    } else {
      if (memoryStore.has(email)) {
        return c.json({ error: 'conflict', message: 'User already exists', status: 409 }, 409);
      }
      const user: UserRecord = {
        id: userId, email, password_hash: '', name: body.name ?? '',
        role, scopes, status: 'invited',
      };
      memoryStore.set(email, user);
      memoryById.set(userId, user);
    }

    // Send invitation email (non-blocking)
    const appUrl = process.env['APP_URL'] ?? 'https://plinth.polanyi.tech';
    const acceptUrl = `${appUrl}/accept-invite?token=${inviteToken}`;
    const inviterAuth = c.get('auth') as AuthPayload | undefined;
    const inviterName = inviterAuth?.sub ? (await getUserById(repo, inviterAuth.sub))?.name ?? 'Admin' : 'Admin';
    void sendEmail({
      to: email,
      subject: `You've been invited to join Plinth`,
      template: UserInvitation({ inviterName, agencyName: 'Plinth', role, acceptUrl }),
    });

    return c.json({
      user_id: userId, email, role, invite_token: inviteToken,
      invite_url: `/accept-invite?token=${inviteToken}`,
    }, 201);
  });

  // Accept an invite
  app.post('/v1/auth/accept-invite', async (c) => {
    const body = await c.req.json<{ token: string; password: string; name?: string }>();

    if (!body.token || !body.password) {
      return c.json({ error: 'validation_error', message: 'token and password are required', status: 400 }, 400);
    }

    if (body.password.length < 8 || !/[A-Z]/.test(body.password) || !/[0-9]/.test(body.password)) {
      return c.json({ error: 'validation_error', message: 'Password must be at least 8 characters with 1 uppercase and 1 number', status: 400 }, 400);
    }

    if (!repo) {
      return c.json({ error: 'not_implemented', message: 'Invite system requires database', status: 501 }, 501);
    }

    const user = await repo.getByInviteToken(body.token);
    if (!user) {
      return c.json({ error: 'not_found', message: 'Invalid or expired invite token', status: 404 }, 404);
    }

    await repo.activate(user.id, hashPassword(body.password), body.name ?? user.name);

    // Send welcome email (non-blocking)
    const appUrl = process.env['APP_URL'] ?? 'https://plinth.polanyi.tech';
    void sendEmail({
      to: user.email,
      subject: 'Welcome to Plinth',
      template: WelcomeEmail({ name: body.name ?? user.name, appUrl }),
    });

    const token = await signToken({ sub: user.id, role: user.role as Role, scopes: user.scopes });

    return c.json({
      user: { id: user.id, email: user.email, name: body.name ?? user.name, role: user.role },
      token,
    });
  });

  // Update user
  app.patch('/v1/users/:id', authMiddleware('admin:*'), async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json<{ role?: string; name?: string; status?: string }>();

    if (repo) {
      const user = await repo.getById(id);
      if (!user) return c.json({ error: 'not_found', message: 'User not found', status: 404 }, 404);

      if (body.role) await repo.updateRole(id, body.role, roleScopesMap(body.role));
      if (body.name) await repo.updateName(id, body.name);
      if (body.status === 'deactivated') await repo.deactivate(id);

      const updated = await repo.getById(id);
      return c.json({ user: updated });
    }

    const user = memoryById.get(id);
    if (!user) return c.json({ error: 'not_found', message: 'User not found', status: 404 }, 404);
    if (body.role) { user.role = body.role as Role; user.scopes = roleScopesMap(body.role); }
    if (body.name) user.name = body.name;
    if (body.status === 'deactivated') user.status = 'deactivated';
    return c.json({ user });
  });

  // Delete user
  app.delete('/v1/users/:id', authMiddleware('admin:*'), async (c) => {
    const id = c.req.param('id');
    const auth = c.get('auth') as AuthPayload | undefined;
    if (auth?.sub === id) {
      return c.json({ error: 'forbidden', message: 'Cannot delete your own account', status: 403 }, 403);
    }

    if (repo) {
      const user = await repo.getById(id);
      if (!user) return c.json({ error: 'not_found', message: 'User not found', status: 404 }, 404);
      await repo.delete(id);
    } else {
      const user = memoryById.get(id);
      if (!user) return c.json({ error: 'not_found', message: 'User not found', status: 404 }, 404);
      memoryStore.delete(user.email);
      memoryById.delete(id);
    }

    return c.json({ message: 'User deleted' });
  });

  // ─── Profile: change password ─────────────────────────────────────
  app.post('/v1/auth/change-password', authMiddleware(), async (c) => {
    const auth = c.get('auth') as AuthPayload | undefined;
    if (!auth) return c.json({ error: 'unauthorized', status: 401 }, 401);

    const body = await c.req.json<{ current_password: string; new_password: string }>();
    if (!body.current_password || !body.new_password) {
      return c.json({ error: 'validation_error', message: 'current_password and new_password required', status: 400 }, 400);
    }

    const user = await getUserById(repo, auth.sub);
    if (!user) return c.json({ error: 'not_found', message: 'User not found', status: 404 }, 404);

    if (!verifyPassword(body.current_password, user.password_hash)) {
      return c.json({ error: 'unauthorized', message: 'Current password is incorrect', status: 401 }, 401);
    }

    if (repo) {
      await repo.updatePassword(auth.sub, hashPassword(body.new_password));
    } else {
      user.password_hash = hashPassword(body.new_password);
    }

    return c.json({ message: 'Password updated' });
  });

  // ─── Profile: update name ─────────────────────────────────────────
  app.patch('/v1/auth/profile', authMiddleware(), async (c) => {
    const auth = c.get('auth') as AuthPayload | undefined;
    if (!auth) return c.json({ error: 'unauthorized', status: 401 }, 401);

    const body = await c.req.json<{ name?: string }>();
    if (body.name) {
      if (repo) {
        await repo.updateName(auth.sub, body.name);
      } else {
        const user = memoryById.get(auth.sub);
        if (user) user.name = body.name;
      }
    }

    const updated = await getUserById(repo, auth.sub);
    return c.json({ user: updated ? { id: updated.id, email: updated.email, name: updated.name, role: updated.role } : null });
  });

  // ─── Demo Request (public, no auth) ──────────────────────────────
  const demoRequests = new Map<string, {
    id: string;
    company: string;
    contact_name: string;
    email: string;
    monthly_spend: string;
    platforms: string[];
    created_at: string;
  }>();

  app.post('/v1/demo-request', async (c) => {
    try {
      const body = await c.req.json<{
        company?: string;
        contact_name?: string;
        email?: string;
        monthly_spend?: string;
        platforms?: string[];
      }>();

      if (!body.email || !body.company || !body.contact_name) {
        return c.json({ error: 'validation_error', message: 'company, contact_name, and email are required' }, 400);
      }

      const id = randomUUID();
      const record = {
        id,
        company: body.company,
        contact_name: body.contact_name,
        email: body.email,
        monthly_spend: body.monthly_spend ?? 'unknown',
        platforms: body.platforms ?? [],
        created_at: new Date().toISOString(),
      };
      demoRequests.set(id, record);

      return c.json({ message: 'Demo request received. We will reach out within 24 hours.', id }, 201);
    } catch {
      return c.json({ error: 'bad_request', message: 'Invalid JSON body' }, 400);
    }
  });

  app.get('/v1/demo-requests', authMiddleware(), async (c) => {
    const auth = c.get('auth') as AuthPayload | undefined;
    if (!auth || auth.role !== 'admin') {
      return c.json({ error: 'forbidden', message: 'Admin access required' }, 403);
    }
    const requests = Array.from(demoRequests.values()).sort(
      (a, b) => b.created_at.localeCompare(a.created_at),
    );
    return c.json({ requests, total: requests.length });
  });

  return app;
}
