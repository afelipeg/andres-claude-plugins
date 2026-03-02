// ─── Connector REST Routes ──────────────────────────────────────────
// Dashboard endpoints for platform connector management.

import { Hono } from 'hono';
import type { EventBus, ConnectorPlatform, OAuthTokens } from '@openagency/types';
import { getConnector, hasConnector } from '@openagency/connectors';
import { authMiddleware } from '@openagency/auth/middleware';
import type { ConnectorInfra } from '../connectors/setup.js';
import { rateLimiter } from '../middleware/rate-limiter.js';

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
