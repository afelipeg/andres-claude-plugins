// ─── Connector REST Routes ──────────────────────────────────────────
// Dashboard endpoints for platform connector management.
// Supports OAuth flow (auth-url → callback → connect) and sync operations.

import { Hono } from 'hono';
import type { EventBus, ConnectorPlatform, OAuthTokens } from '@openagency/types';
import { getConnector, hasConnector } from '@openagency/connectors';
import { authMiddleware } from '@openagency/auth/middleware';
import type { ConnectorInfra } from '../connectors/setup.js';
import { rateLimiter } from '../middleware/rate-limiter.js';

// In-memory connection type preferences (rest/mcp/both per platform)
const connectionPrefs = new Map<string, 'rest' | 'mcp' | 'both'>();
export { connectionPrefs };

const VALID_PLATFORMS = new Set<string>([
  'google_ads', 'meta_ads', 'dv360', 'tiktok_ads', 'tiktok_shop', 'amazon_ads',
]);

function isValidPlatform(p: string): p is ConnectorPlatform {
  return VALID_PLATFORMS.has(p);
}

export function connectorRoutes(infra: ConnectorInfra, eventBus: EventBus) {
  const app = new Hono();

  app.use('/v1/connectors/*', rateLimiter());

  // ─── List connected platforms ─────────────────────────────────
  app.get('/v1/connectors', authMiddleware(), (c) => {
    const platforms = infra.credentialStore.platforms();
    const activeSyncs = infra.syncScheduler.activePlatforms();
    const result = platforms.map((platform) => ({
      platform,
      connected: true,
      syncing: activeSyncs.includes(platform),
      last_sync: infra.syncResultCache.get(platform)?.synced_at ?? null,
    }));
    return c.json({ connectors: result });
  });

  // ─── Aggregate connector status (for dashboard) ────────────────
  app.get('/v1/connectors/status', authMiddleware(), (c) => {
    const connectedPlatforms = infra.credentialStore.platforms();
    const activeSyncs = infra.syncScheduler.activePlatforms();

    const allPlatforms = Array.from(VALID_PLATFORMS) as ConnectorPlatform[];
    const platforms = allPlatforms.map((platform) => {
      const connected = connectedPlatforms.includes(platform);
      const credentials = connected ? infra.credentialStore.get(platform) : null;
      const syncResult = infra.syncResultCache.get(platform);

      return {
        platform,
        connected,
        syncing: activeSyncs.includes(platform),
        last_sync: syncResult?.synced_at ?? null,
        sync_status: syncResult?.status ?? null,
        sync_row_count: syncResult?.row_count ?? 0,
        connected_at: credentials?.connected_at ?? null,
        has_connector: hasConnector(platform),
      };
    });

    return c.json({
      total: allPlatforms.length,
      connected: connectedPlatforms.length,
      syncing: activeSyncs.length,
      platforms,
    });
  });

  // ─── Get OAuth URL for platform ────────────────────────────────
  app.get('/v1/connectors/:platform/auth-url', authMiddleware(), (c) => {
    const platform = c.req.param('platform');
    if (!isValidPlatform(platform)) {
      return c.json({ error: 'invalid_platform', message: `Invalid platform: ${platform}`, status: 400 }, 400);
    }

    if (!hasConnector(platform)) {
      return c.json({
        error: 'no_connector',
        message: `No connector configured for ${platform}. Check environment variables.`,
        status: 404,
      }, 404);
    }

    const redirectUri = c.req.query('redirect_uri');
    if (!redirectUri) {
      return c.json(
        { error: 'validation_error', message: 'redirect_uri query parameter is required', status: 400 },
        400,
      );
    }

    const state = c.req.query('state') ?? undefined;

    try {
      const connector = getConnector(platform);
      const authUrl = connector.getAuthUrl(redirectUri, state);
      return c.json({ platform, auth_url: authUrl, redirect_uri: redirectUri });
    } catch (err) {
      return c.json({
        error: 'connector_error',
        message: err instanceof Error ? err.message : String(err),
        status: 500,
      }, 500);
    }
  });

  // ─── OAuth callback (exchange code → store credentials) ────────
  app.post('/v1/connectors/:platform/callback', authMiddleware(), async (c) => {
    const platform = c.req.param('platform');
    if (!isValidPlatform(platform)) {
      return c.json({ error: 'invalid_platform', message: `Invalid platform: ${platform}`, status: 400 }, 400);
    }

    if (!hasConnector(platform)) {
      return c.json({ error: 'no_connector', message: `No connector for ${platform}`, status: 404 }, 404);
    }

    try {
      const body = await c.req.json<{
        code: string;
        redirect_uri: string;
        account_id?: string;
        manager_id?: string;
      }>();

      if (!body.code || !body.redirect_uri) {
        return c.json(
          { error: 'validation_error', message: 'code and redirect_uri are required', status: 400 },
          400,
        );
      }

      const connector = getConnector(platform);
      const tokens = await connector.exchangeCode(body.code, body.redirect_uri);

      // Store credentials
      infra.credentialStore.set({
        platform,
        tokens,
        account_id: body.account_id,
        manager_id: body.manager_id,
        connected_at: new Date().toISOString(),
      });

      return c.json({
        status: 'connected',
        platform,
        token_type: tokens.token_type,
        expires_at: tokens.expires_at,
      });
    } catch (err) {
      return c.json({
        error: 'oauth_error',
        message: err instanceof Error ? err.message : String(err),
        status: 400,
      }, 400);
    }
  });

  // ─── Platform status (per-platform detail) ─────────────────────
  app.get('/v1/connectors/:platform/status', authMiddleware(), (c) => {
    const platform = c.req.param('platform');
    if (!isValidPlatform(platform)) {
      return c.json({ error: 'invalid_platform', message: `Invalid platform: ${platform}`, status: 400 }, 400);
    }

    const credentials = infra.credentialStore.get(platform);
    const syncResult = infra.syncResultCache.get(platform);
    const syncing = infra.syncScheduler.activePlatforms().includes(platform);

    return c.json({
      platform,
      connected: !!credentials,
      connected_at: credentials?.connected_at ?? null,
      account_id: credentials?.account_id ?? null,
      syncing,
      last_sync: syncResult?.synced_at ?? null,
      sync_status: syncResult?.status ?? null,
      sync_row_count: syncResult?.row_count ?? 0,
      sync_error: syncResult?.error ?? null,
      has_connector: hasConnector(platform),
      token_valid: credentials ? !isTokenExpired(credentials.tokens) : false,
    });
  });

  // ─── Configure connection type (REST / MCP / Both) ───────────
  app.post('/v1/connectors/:platform/configure', authMiddleware(), async (c) => {
    const platform = c.req.param('platform');
    if (!isValidPlatform(platform)) {
      return c.json({ error: 'invalid_platform', message: `Invalid platform: ${platform}`, status: 400 }, 400);
    }

    try {
      const body = await c.req.json<{ connection_type: 'rest' | 'mcp' | 'both' }>();
      const validTypes = ['rest', 'mcp', 'both'];
      if (!validTypes.includes(body.connection_type)) {
        return c.json(
          { error: 'validation_error', message: 'connection_type must be "rest", "mcp", or "both"', status: 400 },
          400,
        );
      }

      connectionPrefs.set(platform, body.connection_type);

      return c.json({
        platform,
        connection_type: body.connection_type,
        message: `Connection type set to "${body.connection_type}" for ${platform}`,
      });
    } catch (err) {
      return c.json({
        error: 'bad_request',
        message: err instanceof Error ? err.message : String(err),
        status: 400,
      }, 400);
    }
  });

  // ─── Connect (store credentials) ──────────────────────────────
  app.post('/v1/connectors/:platform/connect', authMiddleware(), async (c) => {
    const platform = c.req.param('platform');
    if (!isValidPlatform(platform)) {
      return c.json({ error: 'invalid_platform', message: `Invalid platform: ${platform}`, status: 400 }, 400);
    }

    const body = await c.req.json<{
      tokens: OAuthTokens;
      account_id?: string;
      manager_id?: string;
      developer_token?: string;
      app_id?: string;
      profile_id?: string;
    }>();

    if (!body.tokens?.access_token) {
      return c.json({ error: 'validation_error', message: 'tokens.access_token is required', status: 400 }, 400);
    }

    infra.credentialStore.set({
      platform,
      tokens: body.tokens,
      account_id: body.account_id,
      manager_id: body.manager_id,
      developer_token: body.developer_token,
      app_id: body.app_id,
      profile_id: body.profile_id,
      connected_at: new Date().toISOString(),
    });

    return c.json({ status: 'connected', platform });
  });

  // ─── Disconnect ───────────────────────────────────────────────
  app.delete('/v1/connectors/:platform', authMiddleware(), (c) => {
    const platform = c.req.param('platform');
    if (!isValidPlatform(platform)) {
      return c.json({ error: 'invalid_platform', message: `Invalid platform: ${platform}`, status: 400 }, 400);
    }

    infra.syncScheduler.stop(platform);
    const removed = infra.credentialStore.remove(platform);
    infra.syncResultCache.delete(platform);

    return c.json({ status: removed ? 'disconnected' : 'not_connected', platform });
  });

  // ─── List ad accounts ─────────────────────────────────────────
  app.get('/v1/connectors/:platform/accounts', authMiddleware(), async (c) => {
    const platform = c.req.param('platform');
    if (!isValidPlatform(platform)) {
      return c.json({ error: 'invalid_platform', message: `Invalid platform: ${platform}`, status: 400 }, 400);
    }

    const credentials = infra.credentialStore.get(platform);
    if (!credentials) {
      return c.json({ error: 'not_connected', message: `Platform ${platform} is not connected`, status: 404 }, 404);
    }

    if (!hasConnector(platform)) {
      return c.json({ error: 'no_connector', message: `No connector registered for ${platform}`, status: 404 }, 404);
    }

    try {
      const connector = getConnector(platform);
      const accounts = await connector.listAccounts(credentials.tokens);
      return c.json({ platform, accounts });
    } catch (err) {
      return c.json({
        error: 'connector_error',
        message: err instanceof Error ? err.message : String(err),
        status: 500,
      }, 500);
    }
  });

  // ─── Trigger sync ─────────────────────────────────────────────
  app.post('/v1/connectors/:platform/sync', authMiddleware(), async (c) => {
    const platform = c.req.param('platform');
    if (!isValidPlatform(platform)) {
      return c.json({ error: 'invalid_platform', message: `Invalid platform: ${platform}`, status: 400 }, 400);
    }

    const credentials = infra.credentialStore.get(platform);
    if (!credentials) {
      return c.json({ error: 'not_connected', message: `Platform ${platform} is not connected`, status: 404 }, 404);
    }

    let dateRangeDays = 30;
    try {
      const body = await c.req.json<{ date_range_days?: number }>();
      if (body.date_range_days && body.date_range_days > 0) {
        dateRangeDays = body.date_range_days;
      }
    } catch {
      // No body or invalid JSON — use default
    }

    try {
      const result = await infra.syncScheduler.syncNow(platform, credentials, dateRangeDays);
      return c.json({
        platform: result.platform,
        status: result.status,
        row_count: result.row_count,
        date_range: result.date_range,
        synced_at: result.synced_at,
        error: result.error,
      });
    } catch (err) {
      return c.json({
        error: 'sync_error',
        message: err instanceof Error ? err.message : String(err),
        status: 500,
      }, 500);
    }
  });

  // ─── Get sync results ─────────────────────────────────────────
  app.get('/v1/connectors/:platform/sync/results', authMiddleware(), (c) => {
    const platform = c.req.param('platform');
    if (!isValidPlatform(platform)) {
      return c.json({ error: 'invalid_platform', message: `Invalid platform: ${platform}`, status: 400 }, 400);
    }

    const cached = infra.syncResultCache.get(platform);
    if (!cached) {
      return c.json({ error: 'no_results', message: `No sync results for ${platform}`, status: 404 }, 404);
    }

    return c.json({
      platform: cached.platform,
      status: cached.status,
      row_count: cached.row_count,
      date_range: cached.date_range,
      synced_at: cached.synced_at,
      error: cached.error,
      rows: cached.rows.slice(0, 50),
    });
  });

  return app;
}

// ─── Helpers ────────────────────────────────────────────────────────

function isTokenExpired(tokens: OAuthTokens): boolean {
  if (!tokens.expires_at) return false;
  return Date.now() > tokens.expires_at;
}
