// ─── OAuth Storage Routes (Google Drive, OneDrive) ──────────────────
// Full-redirect OAuth flow: backend generates auth URL, Google calls back
// to backend, backend stores encrypted tokens, redirects to frontend.

import { Hono } from 'hono';
import { google } from 'googleapis';
import { ulid } from 'ulid';
import { authMiddleware } from '@openagency/auth';
import { verifyToken } from '@openagency/auth';
import { encrypt } from '@openagency/memory';
import type { AuthPayload } from '@openagency/types';

const FRONTEND_URL = 'https://plinth.polanyi.tech';

type Db = { unsafe: (q: string, params?: unknown[]) => Promise<unknown[]> };

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env['GOOGLE_DRIVE_CLIENT_ID'],
    process.env['GOOGLE_DRIVE_CLIENT_SECRET'],
    process.env['GOOGLE_DRIVE_REDIRECT_URI'],
  );
}

export function oauthStorageRoutes(db: unknown) {
  const app = new Hono();

  if (!db) return app; // No DB — skip routes

  const sql = db as Db;
  const encKey = process.env['ENCRYPTION_KEY'] ?? '';

  // ─── GET /auth/google-drive ─────────────────────────────────────────
  // Accepts token as query param (browser redirect, can't use headers)
  app.get('/auth/google-drive', async (c) => {
    // Authenticate from query param or header
    let auth: AuthPayload | null = null;
    const token =
      c.req.query('token') ?? c.req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return c.json({ error: 'unauthorized', message: 'Token required', status: 401 }, 401);
    }
    try {
      auth = await verifyToken(token);
    } catch {
      return c.json({ error: 'unauthorized', message: 'Invalid or expired token', status: 401 }, 401);
    }

    const clientId = auth.sub;
    const state = Buffer.from(JSON.stringify({ clientId, returnTo: '/app/integrations' })).toString('base64url');

    const oauth2 = getOAuth2Client();
    const authUrl = oauth2.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/drive.metadata.readonly',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
      state,
    });

    return c.redirect(authUrl);
  });

  // ─── GET /auth/callback/google-drive ────────────────────────────────
  // Google redirects here after user authorizes. No auth required.
  app.get('/auth/callback/google-drive', async (c) => {
    const code = c.req.query('code');
    const stateRaw = c.req.query('state');
    const error = c.req.query('error');

    if (error) {
      return c.redirect(`${FRONTEND_URL}/app/integrations?error=${encodeURIComponent(error)}`);
    }

    if (!code || !stateRaw) {
      return c.redirect(`${FRONTEND_URL}/app/integrations?error=missing_code`);
    }

    // Decode state
    let clientId: string;
    try {
      const parsed = JSON.parse(Buffer.from(stateRaw, 'base64url').toString()) as { clientId: string };
      clientId = parsed.clientId;
    } catch {
      return c.redirect(`${FRONTEND_URL}/app/integrations?error=invalid_state`);
    }

    // Exchange code for tokens
    const oauth2 = getOAuth2Client();
    let tokens: { access_token?: string | null; refresh_token?: string | null; expiry_date?: number | null; scope?: string | null };
    try {
      const res = await oauth2.getToken(code);
      tokens = res.tokens;
    } catch (err) {
      console.error('[oauth-storage] Token exchange failed:', err);
      return c.redirect(`${FRONTEND_URL}/app/integrations?error=token_exchange_failed`);
    }

    if (!tokens.access_token || !tokens.refresh_token) {
      return c.redirect(`${FRONTEND_URL}/app/integrations?error=no_refresh_token`);
    }

    // Fetch user email
    let email = '';
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (res.ok) {
        const info = (await res.json()) as { email?: string };
        email = info.email ?? '';
      }
    } catch {
      // Non-fatal — email is optional
    }

    // Encrypt tokens
    const encAccessToken = encrypt(tokens.access_token, encKey);
    const encRefreshToken = encrypt(tokens.refresh_token, encKey);
    const expiresAt = tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null;

    // UPSERT into storage_connections
    const id = ulid();
    await sql.unsafe(
      `INSERT INTO storage_connections (id, client_id, provider, access_token, refresh_token, expires_at, scope, email, status, connected_at)
       VALUES ($1, $2, 'google_drive', $3, $4, $5, $6, $7, 'connected', NOW())
       ON CONFLICT (client_id, provider)
       DO UPDATE SET access_token = $3, refresh_token = $4, expires_at = $5, scope = $6, email = $7, status = 'connected', connected_at = NOW()`,
      [id, clientId, encAccessToken, encRefreshToken, expiresAt, tokens.scope ?? '', email],
    );

    return c.redirect(`${FRONTEND_URL}/app/integrations?connected=google_drive`);
  });

  // ─── GET /auth/google-drive/status ──────────────────────────────────
  app.get('/auth/google-drive/status', authMiddleware(), async (c) => {
    const auth = c.get('auth');
    const clientId = auth.sub;

    const rows = await sql.unsafe(
      `SELECT email, connected_at, status FROM storage_connections WHERE client_id = $1 AND provider = 'google_drive'`,
      [clientId],
    );

    if (rows.length === 0) {
      return c.json({ connected: false, email: null, connected_at: null });
    }

    const row = rows[0] as { email: string; connected_at: string; status: string };
    return c.json({
      connected: row.status === 'connected',
      email: row.email || null,
      connected_at: row.connected_at,
    });
  });

  // ─── DELETE /auth/google-drive/disconnect ───────────────────────────
  app.delete('/auth/google-drive/disconnect', authMiddleware(), async (c) => {
    const auth = c.get('auth');
    const clientId = auth.sub;

    await sql.unsafe(
      `DELETE FROM storage_connections WHERE client_id = $1 AND provider = 'google_drive'`,
      [clientId],
    );

    return c.json({ disconnected: true });
  });

  return app;
}
