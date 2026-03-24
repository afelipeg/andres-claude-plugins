// ─── Agency Connector Routes (Multi-Advertiser Model) ───────────────
// Level 1: agency_connections — master credentials per platform
// Level 2: advertiser_scopes — per-client advertiser selection
//
// FIX (2026-03-22): Added unified sync-all endpoint, health check,
// persistent sync results (survive redeploys), and updated_at touch.

import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import { ulid } from 'ulid';
import { authMiddleware } from '@openagency/auth';
import { encrypt, decrypt } from '@openagency/memory';
import {
  getConnector, hasConnector, registerConnector,
  GoogleAdsConnector, MetaConnector, DV360Connector, TikTokAdsConnector, TikTokShopConnector, AmazonAdsConnector,
  getServiceAccountToken, parseServiceAccountJson,
} from '@openagency/connectors';
import type { PlatformConnector } from '@openagency/connectors';
import type { ConnectorPlatform, OAuthTokens, PlatformAccount, AuthPayload } from '@openagency/types';
import type { AgencyRepo } from '@openagency/memory';
import type { ConnectorInfra } from '../connectors/setup.js';
import { createLogger } from '@openagency/core';

const log = createLogger('agency-connectors');

type Db = { unsafe: (q: string, params?: unknown[]) => Promise<unknown[]> };

const ADMIN_ROLES = new Set(['super_admin', 'agency_admin', 'admin']);

/** Middleware: require agency_admin or super_admin role */
function requireAdminRole() {
  return async (c: Context, next: Next) => {
    const auth = c.get('auth') as AuthPayload;
    if (!auth || !ADMIN_ROLES.has(auth.role)) {
      return c.json({ error: 'forbidden', message: 'Connector management requires Admin role', status: 403 }, 403);
    }
    await next();
  };
}

const VALID_PLATFORMS = new Set([
  'google_ads', 'meta_ads', 'dv360', 'tiktok_ads', 'tiktok_shop', 'amazon_ads',
]);

const CONNECTION_TYPES: Record<string, string[]> = {
  google_ads: ['mcc', 'direct'],
  meta_ads: ['system_user', 'oauth_user'],
  dv360: ['service_account', 'oauth2'],
  tiktok_ads: ['business_center', 'direct'],
  tiktok_shop: ['direct'],
  amazon_ads: ['agency', 'direct'],
};

// Per-platform required fields by connection_type
const REQUIRED_BY_TYPE: Record<string, Record<string, string[]>> = {
  google_ads: {
    mcc: ['developer_token', 'client_id', 'client_secret', 'refresh_token', 'login_customer_id'],
    direct: ['developer_token', 'client_id', 'client_secret', 'refresh_token'],
  },
  meta_ads: {
    system_user: ['business_manager_id', 'app_id', 'app_secret', 'system_user_token'],
    oauth_user: ['business_manager_id', 'app_id', 'app_secret', 'access_token'],
  },
  dv360: {
    service_account: ['service_account_json', 'partner_id'],
    oauth2: ['client_id', 'client_secret', 'refresh_token', 'partner_id'],
  },
  tiktok_ads: {
    business_center: ['bc_id', 'app_id', 'app_secret', 'access_token'],
    direct: ['app_id', 'app_secret', 'access_token'],
  },
  tiktok_shop: {
    direct: ['app_key', 'app_secret', 'access_token', 'shop_id'],
  },
  amazon_ads: {
    agency: ['client_id', 'client_secret', 'refresh_token', 'region'],
    direct: ['client_id', 'client_secret', 'refresh_token', 'region'],
  },
};

function isValidPlatform(p: string): p is ConnectorPlatform {
  return VALID_PLATFORMS.has(p);
}

/** Get or create a connector for the given platform.
 *  If not in the global registry, instantiate one on-the-fly from DB credentials. */
function getOrCreateConnector(platform: ConnectorPlatform, creds: Record<string, string>): PlatformConnector {
  if (hasConnector(platform)) return getConnector(platform);

  // Create a connector instance from decrypted credentials
  let connector: PlatformConnector;
  switch (platform) {
    case 'google_ads':
      connector = new GoogleAdsConnector({
        clientId: creds['client_id'] ?? '',
        clientSecret: creds['client_secret'] ?? '',
        developerToken: creds['developer_token'] ?? '',
      });
      break;
    case 'meta_ads':
      connector = new MetaConnector({
        appId: creds['app_id'] ?? '',
        appSecret: creds['app_secret'] ?? '',
      });
      break;
    case 'dv360':
      if (creds['service_account_json']) {
        connector = new DV360Connector({
          serviceAccountJson: creds['service_account_json'],
        });
      } else {
        connector = new DV360Connector({
          clientId: creds['client_id'] ?? '',
          clientSecret: creds['client_secret'] ?? '',
        });
      }
      break;
    case 'tiktok_ads':
      connector = new TikTokAdsConnector({
        appId: creds['app_id'] ?? '',
        secret: creds['app_secret'] ?? creds['secret'] ?? '',
      });
      break;
    case 'tiktok_shop':
      connector = new TikTokShopConnector({
        appKey: creds['app_key'] ?? '',
        appSecret: creds['app_secret'] ?? '',
        region: creds['region'],
      });
      break;
    case 'amazon_ads':
      connector = new AmazonAdsConnector({
        clientId: creds['client_id'] ?? '',
        clientSecret: creds['client_secret'] ?? '',
      });
      break;
    default:
      throw new Error(`No connector implementation for ${platform}`);
  }
  // Register for reuse during this server lifecycle
  registerConnector(connector);
  return connector;
}

/** Resolve agency ID: impersonation JWT claim → DB lookup → fallback to auth.sub */
async function resolveAgencyId(c: Context, agencyRepo?: AgencyRepo | null): Promise<string | null> {
  const auth = c.get('auth') as AuthPayload;
  if (auth.agency_id) return auth.agency_id;
  if (agencyRepo) return agencyRepo.resolveForUser(auth.sub);
  return auth.sub;
}

export function agencyConnectorRoutes(db: unknown, infra: ConnectorInfra, agencyRepo?: AgencyRepo) {
  const app = new Hono();

  if (!db) return app;

  const sql = db as Db;
  const encKey = process.env['ENCRYPTION_KEY'] ?? '';
  if (!encKey || encKey.length < 32) {
    console.warn('[SECURITY] ENCRYPTION_KEY is missing or too short — credential encryption will be weak');
  }

  // All agency connector routes require admin role
  app.use('/v1/agency/*', authMiddleware(), requireAdminRole());

  // ─── POST /v1/agency/connections — Save Level 1 credentials ────
  app.post('/v1/agency/connections', async (c) => {
    const agencyId = await resolveAgencyId(c, agencyRepo);
    if (!agencyId) return c.json({ error: 'no_agency', message: 'User is not assigned to an agency' }, 404);
    const body = await c.req.json<{
      platform: string;
      connection_type: string;
      credentials: Record<string, unknown>;
    }>();

    if (!body.platform || !isValidPlatform(body.platform)) {
      return c.json({ error: 'invalid_platform', message: `Invalid platform: ${body.platform}` }, 400);
    }

    const validTypes = CONNECTION_TYPES[body.platform];
    if (!validTypes?.includes(body.connection_type)) {
      return c.json({ error: 'invalid_connection_type', message: `Valid types: ${validTypes?.join(', ')}` }, 400);
    }

    // Validate required fields
    const requiredFields = REQUIRED_BY_TYPE[body.platform]?.[body.connection_type] ?? [];
    const missing = requiredFields.filter((f) => {
      const val = body.credentials[f];
      return !val || (typeof val === 'string' && !val.trim());
    });
    if (missing.length > 0) {
      return c.json({ error: 'missing_fields', message: `Missing: ${missing.join(', ')}` }, 400);
    }

    // Encrypt credentials JSON
    const encCredentials = encrypt(JSON.stringify(body.credentials), encKey);

    const id = ulid();
    await sql.unsafe(
      `INSERT INTO agency_connections (id, agency_id, platform, connection_type, credentials, status, connected_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'connected', NOW(), NOW())
       ON CONFLICT (agency_id, platform)
       DO UPDATE SET connection_type = $4, credentials = $5, status = 'connected', updated_at = NOW()`,
      [id, agencyId, body.platform, body.connection_type, encCredentials],
    );

    return c.json({ status: 'connected', platform: body.platform, connection_type: body.connection_type }, 201);
  });

  // ─── GET /v1/agency/connections — List all ─────────────────────
  app.get('/v1/agency/connections', async (c) => {
    const agencyId = await resolveAgencyId(c, agencyRepo);
    if (!agencyId) return c.json({ error: 'no_agency', message: 'User is not assigned to an agency' }, 404);
    const rows = await sql.unsafe(
      `SELECT ac.id, ac.platform, ac.connection_type, ac.status, ac.connected_at, ac.updated_at,
              COUNT(s.id)::int AS advertiser_count,
              sr.synced_at AS last_sync, sr.status AS sync_status, sr.row_count AS sync_row_count
       FROM agency_connections ac
       LEFT JOIN advertiser_scopes s ON s.agency_connection_id = ac.id AND s.status = 'active'
       LEFT JOIN sync_results sr ON sr.agency_id = ac.agency_id AND sr.platform = ac.platform
       WHERE ac.agency_id = $1
       GROUP BY ac.id, sr.synced_at, sr.status, sr.row_count`,
      [agencyId],
    );
    return c.json({ connections: rows });
  });

  // ─── GET /v1/agency/connections/:platform — Detail ─────────────
  app.get('/v1/agency/connections/:platform', async (c) => {
    const agencyId = await resolveAgencyId(c, agencyRepo);
    if (!agencyId) return c.json({ error: 'no_agency', message: 'User is not assigned to an agency' }, 404);
    const platform = c.req.param('platform');

    const rows = await sql.unsafe(
      `SELECT id, platform, connection_type, status, connected_at, updated_at
       FROM agency_connections WHERE agency_id = $1 AND platform = $2`,
      [agencyId, platform],
    );
    if (rows.length === 0) return c.json({ error: 'not_found' }, 404);

    const conn = rows[0] as { id: string };
    const scopes = await sql.unsafe(
      `SELECT id, advertiser_id, advertiser_name, status, created_at
       FROM advertiser_scopes WHERE agency_connection_id = $1 ORDER BY created_at`,
      [conn.id],
    );

    // Get latest sync result
    const syncRows = await sql.unsafe(
      `SELECT synced_at, status, row_count, error FROM sync_results
       WHERE agency_id = $1 AND platform = $2 ORDER BY synced_at DESC LIMIT 1`,
      [agencyId, platform],
    );

    return c.json({
      connection: rows[0],
      advertisers: scopes,
      last_sync: syncRows.length > 0 ? syncRows[0] : null,
    });
  });

  // ─── DELETE /v1/agency/connections/:platform — Disconnect ──────
  app.delete('/v1/agency/connections/:platform', async (c) => {
    const agencyId = await resolveAgencyId(c, agencyRepo);
    if (!agencyId) return c.json({ error: 'no_agency', message: 'User is not assigned to an agency' }, 404);
    const platform = c.req.param('platform');

    await sql.unsafe(
      `DELETE FROM agency_connections WHERE agency_id = $1 AND platform = $2`,
      [agencyId, platform],
    );

    // Clean up sync results
    await sql.unsafe(
      `DELETE FROM sync_results WHERE agency_id = $1 AND platform = $2`,
      [agencyId, platform],
    ).catch(() => {});

    // Remove from in-memory cache
    infra.syncResultCache.delete(`${agencyId}:${platform}`);

    return c.json({ disconnected: true, platform });
  });

  // ─── GET /v1/agency/connections/:platform/sub-accounts ─────────
  // Fetches available sub-accounts from platform API using stored creds
  app.get('/v1/agency/connections/:platform/sub-accounts', async (c) => {
    const agencyId = await resolveAgencyId(c, agencyRepo);
    if (!agencyId) return c.json({ error: 'no_agency', message: 'User is not assigned to an agency' }, 404);
    const platform = c.req.param('platform');

    if (!isValidPlatform(platform)) {
      return c.json({ error: 'invalid_platform' }, 400);
    }

    // Load & decrypt credentials
    const rows = await sql.unsafe(
      `SELECT id, credentials, connection_type FROM agency_connections WHERE agency_id = $1 AND platform = $2`,
      [agencyId, platform],
    );
    if (rows.length === 0) return c.json({ error: 'not_connected', message: 'Save credentials first' }, 404);

    const row = rows[0] as { id: string; credentials: string; connection_type: string };
    let creds: Record<string, string>;
    try {
      creds = JSON.parse(decrypt(row.credentials, encKey)) as Record<string, string>;
    } catch {
      return c.json({ error: 'decrypt_failed', message: 'Failed to decrypt credentials' }, 500);
    }

    try {
      const accounts = await fetchSubAccounts(platform, row.connection_type, creds, infra);

      // Touch updated_at on successful API call — proves credentials are valid
      await sql.unsafe(
        `UPDATE agency_connections SET updated_at = NOW() WHERE agency_id = $1 AND platform = $2`,
        [agencyId, platform],
      ).catch(() => {});

      return c.json({ platform, accounts });
    } catch (err) {
      return c.json({
        error: 'fetch_failed',
        message: err instanceof Error ? err.message : String(err),
      }, 500);
    }
  });

  // ─── POST /v1/agency/connections/:platform/advertisers ─────────
  app.post('/v1/agency/connections/:platform/advertisers', async (c) => {
    const agencyId = await resolveAgencyId(c, agencyRepo);
    if (!agencyId) return c.json({ error: 'no_agency', message: 'User is not assigned to an agency' }, 404);
    const platform = c.req.param('platform');
    const body = await c.req.json<{
      advertisers: Array<{ id: string; name?: string }>;
    }>();

    if (!body.advertisers?.length) {
      return c.json({ error: 'missing_advertisers' }, 400);
    }

    // Get agency connection ID
    const connRows = await sql.unsafe(
      `SELECT id FROM agency_connections WHERE agency_id = $1 AND platform = $2`,
      [agencyId, platform],
    );
    if (connRows.length === 0) return c.json({ error: 'not_connected' }, 404);
    const connectionId = (connRows[0] as { id: string }).id;

    // Upsert each advertiser
    for (const adv of body.advertisers) {
      const id = ulid();
      await sql.unsafe(
        `INSERT INTO advertiser_scopes (id, agency_connection_id, platform, advertiser_id, advertiser_name, status, created_at)
         VALUES ($1, $2, $3, $4, $5, 'active', NOW())
         ON CONFLICT (agency_connection_id, advertiser_id)
         DO UPDATE SET advertiser_name = $5, status = 'active'`,
        [id, connectionId, platform, adv.id, adv.name ?? ''],
      );
    }

    return c.json({ saved: body.advertisers.length, platform }, 201);
  });

  // ─── GET /v1/agency/connections/:platform/advertisers ──────────
  app.get('/v1/agency/connections/:platform/advertisers', async (c) => {
    const agencyId = await resolveAgencyId(c, agencyRepo);
    if (!agencyId) return c.json({ error: 'no_agency', message: 'User is not assigned to an agency' }, 404);
    const platform = c.req.param('platform');

    const rows = await sql.unsafe(
      `SELECT s.id, s.advertiser_id, s.advertiser_name, s.status, s.created_at
       FROM advertiser_scopes s
       JOIN agency_connections ac ON ac.id = s.agency_connection_id
       WHERE ac.agency_id = $1 AND ac.platform = $2 AND s.status = 'active'
       ORDER BY s.created_at`,
      [agencyId, platform],
    );

    return c.json({ platform, advertisers: rows });
  });

  // ─── DELETE /v1/agency/connections/:platform/advertisers/:id ───
  app.delete('/v1/agency/connections/:platform/advertisers/:advertiserId', async (c) => {
    const agencyId = await resolveAgencyId(c, agencyRepo);
    if (!agencyId) return c.json({ error: 'no_agency', message: 'User is not assigned to an agency' }, 404);
    const platform = c.req.param('platform');
    const advertiserId = c.req.param('advertiserId');

    await sql.unsafe(
      `UPDATE advertiser_scopes SET status = 'inactive'
       WHERE advertiser_id = $1 AND platform = $2
         AND agency_connection_id IN (SELECT id FROM agency_connections WHERE agency_id = $3 AND platform = $2)`,
      [advertiserId, platform, agencyId],
    );

    return c.json({ removed: true, advertiser_id: advertiserId });
  });

  // ─── POST /v1/agency/connections/:platform/sync ────────────────
  // Sync data for a specific advertiser
  app.post('/v1/agency/connections/:platform/sync', async (c) => {
    const agencyId = await resolveAgencyId(c, agencyRepo);
    if (!agencyId) return c.json({ error: 'no_agency', message: 'User is not assigned to an agency' }, 404);
    const platform = c.req.param('platform');

    let body: { advertiser_id?: string; date_range_days?: number } = {};
    try {
      body = await c.req.json();
    } catch {
      // Empty body is OK for sync-all mode
    }

    if (!isValidPlatform(platform)) return c.json({ error: 'invalid_platform' }, 400);

    // Load agency credentials
    const connRows = await sql.unsafe(
      `SELECT credentials, connection_type FROM agency_connections WHERE agency_id = $1 AND platform = $2`,
      [agencyId, platform],
    );
    if (connRows.length === 0) return c.json({ error: 'not_connected' }, 404);

    const row = connRows[0] as { credentials: string; connection_type: string };
    let creds: Record<string, string>;
    try {
      creds = JSON.parse(decrypt(row.credentials, encKey)) as Record<string, string>;
    } catch {
      return c.json({ error: 'decrypt_failed' }, 500);
    }

    let connector: PlatformConnector;
    try {
      connector = getOrCreateConnector(platform, creds);
    } catch (err) {
      return c.json({ error: 'no_connector', message: err instanceof Error ? err.message : `No connector for ${platform}` }, 404);
    }

    const days = body.date_range_days ?? 30;
    const end = new Date();
    const start = new Date(end.getTime() - days * 86_400_000);
    const dateRange = { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };

    // If advertiser_id is provided, sync just that one.
    // If not, sync ALL active advertisers for this platform.
    let advertiserIds: string[] = [];
    if (body.advertiser_id) {
      advertiserIds = [body.advertiser_id];
    } else {
      const advRows = await sql.unsafe(
        `SELECT s.advertiser_id FROM advertiser_scopes s
         JOIN agency_connections ac ON ac.id = s.agency_connection_id
         WHERE ac.agency_id = $1 AND ac.platform = $2 AND s.status = 'active'`,
        [agencyId, platform],
      );
      advertiserIds = (advRows as Array<{ advertiser_id: string }>).map((r) => r.advertiser_id);
    }

    if (advertiserIds.length === 0) {
      return c.json({ error: 'no_advertisers', message: 'No active advertisers to sync. Add advertisers first.' }, 400);
    }
    const allRows: import('@openagency/types').NormalizedCampaignRow[] = [];
    const errors: Array<{ advertiser_id: string; error: string }> = [];

    for (const advId of advertiserIds) {
      const platformCreds = buildPlatformCredentials(platform, row.connection_type, creds, advId);
      try {
        const fetchedRows = await connector.fetchCampaigns(platformCreds, dateRange);
        allRows.push(...fetchedRows);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.warn({ platform, advertiser_id: advId, error: msg }, 'Sync failed for advertiser');
        errors.push({ advertiser_id: advId, error: msg });
      }
    }

    const syncStatus = errors.length === advertiserIds.length ? 'error'
      : errors.length > 0 ? 'partial'
      : 'success';

    // Cache the sync result in memory for context assembly
    const syncResult = {
      platform,
      status: syncStatus as 'success' | 'error',
      rows: allRows,
      row_count: allRows.length,
      date_range: dateRange,
      synced_at: new Date().toISOString(),
      error: errors.length > 0 ? errors.map((e) => `${e.advertiser_id}: ${e.error}`).join('; ') : undefined,
    };
    infra.syncResultCache.set(`${agencyId}:${platform}`, syncResult);

    // Persist sync result to DB (survives redeploys)
    try {
      await sql.unsafe(
        `INSERT INTO sync_results (id, agency_id, platform, status, row_count, date_range_start, date_range_end, synced_at, error, rows_json)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9)
         ON CONFLICT (agency_id, platform, advertiser_id)
         DO UPDATE SET status = $4, row_count = $5, date_range_start = $6, date_range_end = $7,
                       synced_at = NOW(), error = $8, rows_json = $9`,
        [
          ulid(), agencyId, platform, syncStatus, allRows.length,
          dateRange.start, dateRange.end,
          errors.length > 0 ? errors.map((e) => `${e.advertiser_id}: ${e.error}`).join('; ') : null,
          allRows.length <= 500 ? JSON.stringify(allRows) : JSON.stringify(allRows.slice(0, 500)),
        ],
      );
    } catch (err) {
      log.warn({ err }, 'Failed to persist sync result to DB');
    }

    // Touch updated_at on the agency_connections row so stale detection works
    await sql.unsafe(
      `UPDATE agency_connections SET updated_at = NOW(), status = 'connected' WHERE agency_id = $1 AND platform = $2`,
      [agencyId, platform],
    ).catch(() => {});

    return c.json({
      platform,
      status: syncStatus,
      row_count: allRows.length,
      advertisers_synced: advertiserIds.length - errors.length,
      advertisers_failed: errors.length,
      errors: errors.length > 0 ? errors : undefined,
      synced_at: new Date().toISOString(),
    });
  });

  // ─── POST /v1/agency/connections/:platform/health ──────────────
  // Validates that stored credentials can actually authenticate with the platform API.
  // Does NOT sync data — just checks connectivity.
  app.post('/v1/agency/connections/:platform/health', async (c) => {
    const agencyId = await resolveAgencyId(c, agencyRepo);
    if (!agencyId) return c.json({ error: 'no_agency' }, 404);
    const platform = c.req.param('platform');

    if (!isValidPlatform(platform)) return c.json({ error: 'invalid_platform' }, 400);

    const connRows = await sql.unsafe(
      `SELECT credentials, connection_type FROM agency_connections WHERE agency_id = $1 AND platform = $2`,
      [agencyId, platform],
    );
    if (connRows.length === 0) return c.json({ error: 'not_connected' }, 404);

    const row = connRows[0] as { credentials: string; connection_type: string };
    let creds: Record<string, string>;
    try {
      creds = JSON.parse(decrypt(row.credentials, encKey)) as Record<string, string>;
    } catch {
      return c.json({ healthy: false, error: 'decrypt_failed', message: 'Credentials could not be decrypted' });
    }

    try {
      // Try fetching sub-accounts as a health check (lightest possible API call)
      await fetchSubAccounts(platform, row.connection_type, creds, infra);

      // Touch updated_at
      await sql.unsafe(
        `UPDATE agency_connections SET updated_at = NOW(), status = 'connected' WHERE agency_id = $1 AND platform = $2`,
        [agencyId, platform],
      ).catch(() => {});

      return c.json({ healthy: true, platform, checked_at: new Date().toISOString() });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);

      // Mark as error status
      await sql.unsafe(
        `UPDATE agency_connections SET status = 'error', updated_at = NOW() WHERE agency_id = $1 AND platform = $2`,
        [agencyId, platform],
      ).catch(() => {});

      return c.json({ healthy: false, platform, error: msg, checked_at: new Date().toISOString() });
    }
  });

  // ─── GET /v1/agency/connections/:platform/sync/status ──────────
  // Returns the latest sync result from DB (persisted across redeploys)
  app.get('/v1/agency/connections/:platform/sync/status', async (c) => {
    const agencyId = await resolveAgencyId(c, agencyRepo);
    if (!agencyId) return c.json({ error: 'no_agency' }, 404);
    const platform = c.req.param('platform');

    const rows = await sql.unsafe(
      `SELECT status, row_count, date_range_start, date_range_end, synced_at, error
       FROM sync_results WHERE agency_id = $1 AND platform = $2
       ORDER BY synced_at DESC LIMIT 1`,
      [agencyId, platform],
    );

    if (rows.length === 0) {
      return c.json({ platform, has_synced: false, last_sync: null });
    }

    const r = rows[0] as Record<string, unknown>;
    return c.json({
      platform,
      has_synced: true,
      last_sync: {
        status: r.status,
        row_count: r.row_count,
        date_range: { start: r.date_range_start, end: r.date_range_end },
        synced_at: r.synced_at,
        error: r.error,
      },
    });
  });

  return app;
}

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Fetch sub-accounts from platform API using decrypted agency credentials.
 * Each platform has different APIs for listing child accounts.
 */
async function fetchSubAccounts(
  platform: ConnectorPlatform,
  connectionType: string,
  creds: Record<string, string>,
  infra: ConnectorInfra,
): Promise<PlatformAccount[]> {
  switch (platform) {
    case 'google_ads': {
      // Get access token — refresh if needed
      let accessToken = creds.access_token ?? '';
      if (!accessToken && creds.refresh_token && creds.client_id && creds.client_secret) {
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: creds.refresh_token,
            client_id: creds.client_id,
            client_secret: creds.client_secret,
          }),
        });
        if (!tokenRes.ok) {
          const errText = await tokenRes.text();
          console.error(`[google_ads] Token refresh failed (${tokenRes.status}):`, errText);
          throw new Error(`Token refresh failed (${tokenRes.status}): ${errText}`);
        }
        const tokenData = (await tokenRes.json()) as { access_token: string };
        accessToken = tokenData.access_token;
      }
      if (!accessToken) throw new Error('No access_token and cannot refresh — check client_id/client_secret/refresh_token');

      // List accessible customers under MCC
      const devToken = creds.developer_token ?? '';
      const mccId = creds.login_customer_id ?? '';
      if (!devToken) throw new Error('Missing developer_token — required for Google Ads API');
      const headers: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
        'developer-token': devToken,
      };
      if (mccId) headers['login-customer-id'] = mccId.replace(/-/g, '');

      console.log(`[google_ads] listAccessibleCustomers — devToken: ${devToken.slice(0, 6)}..., mccId: ${mccId || '(none)'}`);
      const listRes = await fetch('https://googleads.googleapis.com/v23/customers:listAccessibleCustomers', { headers });
      if (!listRes.ok) {
        const errText = await listRes.text();
        console.error(`[google_ads] listAccessibleCustomers failed (${listRes.status}):`, errText);
        throw new Error(`Google Ads API error (${listRes.status}): ${errText}`);
      }
      const listData = (await listRes.json()) as { resourceNames?: string[] };
      console.log(`[google_ads] listAccessibleCustomers returned ${listData.resourceNames?.length ?? 0} customers`);
      const customerIds = (listData.resourceNames ?? []).map((r: string) => r.replace('customers/', ''));

      // Fetch names for each customer
      const accounts: PlatformAccount[] = [];
      for (const custId of customerIds) {
        try {
          const q = `SELECT customer.id, customer.descriptive_name, customer.status FROM customer LIMIT 1`;
          const qRes = await fetch(`https://googleads.googleapis.com/v23/customers/${custId}/googleAds:searchStream`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: q }),
          });
          if (qRes.ok) {
            const qData = (await qRes.json()) as Array<{ results?: Array<{ customer?: { id?: string; descriptiveName?: string; status?: string } }> }>;
            const cust = qData?.[0]?.results?.[0]?.customer;
            accounts.push({
              id: custId,
              name: cust?.descriptiveName ?? custId,
              status: (cust?.status === 'ENABLED' ? 'active' : 'inactive') as 'active' | 'inactive',
            });
          } else {
            accounts.push({ id: custId, name: custId, status: 'active' as const });
          }
        } catch {
          accounts.push({ id: custId, name: custId, status: 'active' as const });
        }
      }
      return accounts;
    }

    case 'meta_ads': {
      // BM client ad accounts: GET /{bm_id}/client_ad_accounts
      const bmId = creds.business_manager_id;
      const token = creds.system_user_token ?? creds.access_token;
      if (!bmId || !token) throw new Error('business_manager_id and token required');

      const url = `https://graph.facebook.com/v21.0/${bmId}/client_ad_accounts?fields=name,currency,timezone_name,account_status&access_token=${token}&limit=500`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Meta API error (${res.status}): ${await res.text()}`);
      const data = (await res.json()) as {
        data: Array<{ id: string; name: string; currency?: string; timezone_name?: string; account_status?: number }>;
      };
      return data.data.map((a) => ({
        id: a.id.replace('act_', ''),
        name: a.name,
        currency: a.currency,
        timezone: a.timezone_name,
        status: a.account_status === 1 ? 'active' as const : 'inactive' as const,
      }));
    }

    case 'dv360': {
      // Advertisers under partner: GET /v3/advertisers?partnerId={partner_id}
      const partnerId = creds.partner_id;
      const token = creds.access_token ?? '';
      if (!partnerId) throw new Error('partner_id required');

      // Resolve access token — service account JWT or OAuth2 refresh
      let accessToken = token;
      if (!accessToken && creds.service_account_json) {
        // Service account: sign JWT and exchange for access token
        const sa = parseServiceAccountJson(creds.service_account_json);
        const saToken = await getServiceAccountToken(sa, [
          'https://www.googleapis.com/auth/display-video',
          'https://www.googleapis.com/auth/doubleclickbidmanager',
        ]);
        accessToken = saToken.access_token;
      } else if (!accessToken && creds.refresh_token && creds.client_id && creds.client_secret) {
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: creds.refresh_token,
            client_id: creds.client_id,
            client_secret: creds.client_secret,
          }),
        });
        if (!tokenRes.ok) throw new Error(`DV360 token refresh failed (${tokenRes.status})`);
        const tokenData = (await tokenRes.json()) as { access_token: string };
        accessToken = tokenData.access_token;
      }

      const url = `https://displayvideo.googleapis.com/v3/advertisers?partnerId=${partnerId}&pageSize=200`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error(`DV360 API error (${res.status}): ${await res.text()}`);
      const data = (await res.json()) as {
        advertisers?: Array<{ advertiserId: string; displayName: string; entityStatus: string }>;
      };
      return (data.advertisers ?? []).map((a) => ({
        id: a.advertiserId,
        name: a.displayName,
        status: a.entityStatus === 'ENTITY_STATUS_ACTIVE' ? 'active' as const : 'inactive' as const,
      }));
    }

    case 'tiktok_ads': {
      // Advertiser list from BC: GET /oauth2/advertiser/get/?bc_id={bc_id}
      const bcId = creds.bc_id;
      const token = creds.access_token;
      if (!token) throw new Error('access_token required');

      if (bcId && connectionType === 'business_center') {
        const url = `https://business-api.tiktok.com/open_api/v1.3/bc/advertiser/get/?bc_id=${bcId}&page_size=100`;
        const res = await fetch(url, {
          headers: { 'Access-Token': token },
        });
        if (!res.ok) throw new Error(`TikTok API error (${res.status}): ${await res.text()}`);
        const data = (await res.json()) as {
          data?: { list?: Array<{ advertiser_id: string; advertiser_name: string }> };
        };
        return (data.data?.list ?? []).map((a) => ({
          id: String(a.advertiser_id),
          name: a.advertiser_name,
          status: 'active' as const,
        }));
      }
      // Direct — use connector's listAccounts
      if (hasConnector(platform)) {
        return getConnector(platform).listAccounts({
          access_token: token, token_type: 'Bearer', expires_at: Date.now() + 86_400_000,
        });
      }
      return [];
    }

    case 'amazon_ads': {
      // Refresh token if needed — direct Amazon LwA API
      let accessToken = creds.access_token ?? '';
      const region = creds.region ?? 'na';
      const amazonBaseUrl = region === 'eu' ? 'https://advertising-api-eu.amazon.com'
        : region === 'fe' ? 'https://advertising-api-fe.amazon.com'
        : 'https://advertising-api.amazon.com';

      if (!accessToken && creds.refresh_token && creds.client_id && creds.client_secret) {
        const tokenRes = await fetch('https://api.amazon.com/auth/o2/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: creds.refresh_token,
            client_id: creds.client_id,
            client_secret: creds.client_secret,
          }),
        });
        if (!tokenRes.ok) throw new Error(`Amazon token refresh failed (${tokenRes.status})`);
        const tokenData = (await tokenRes.json()) as { access_token: string };
        accessToken = tokenData.access_token;
      }
      if (!accessToken) throw new Error('No access_token and cannot refresh');

      const profilesRes = await fetch(`${amazonBaseUrl}/v3/profiles`, {
        headers: { Authorization: `Bearer ${accessToken}`, 'Amazon-Advertising-API-ClientId': creds.client_id ?? '' },
      });
      if (!profilesRes.ok) throw new Error(`Amazon API error (${profilesRes.status}): ${await profilesRes.text()}`);
      const profiles = (await profilesRes.json()) as Array<{ profileId: number; accountInfo?: { name?: string }; countryCode?: string }>;
      return profiles.map((p) => ({
        id: String(p.profileId),
        name: p.accountInfo?.name ?? String(p.profileId),
        status: 'active' as const,
      }));
    }

    case 'tiktok_shop': {
      // Direct API — no connector dependency needed
      const shopToken = creds.access_token ?? '';
      if (!shopToken) throw new Error('access_token required');
      const shopRes = await fetch('https://open-api.tiktokglobalshop.com/api/shop/get_authorized_shop', {
        headers: { 'x-tts-access-token': shopToken },
      });
      if (!shopRes.ok) throw new Error(`TikTok Shop API error (${shopRes.status})`);
      const shopData = (await shopRes.json()) as { data?: { shop_list?: Array<{ shop_id: string; shop_name: string }>; shops?: Array<{ shop_id: string; shop_name: string }> } };
      const shops = shopData.data?.shop_list ?? shopData.data?.shops ?? [];
      return shops.map((s) => ({
        id: s.shop_id,
        name: s.shop_name,
        status: 'active' as const,
      }));
    }

    default:
      return [];
  }
}

/**
 * Build PlatformCredentials from agency credentials + specific advertiser ID.
 * Maps the advertiser_id to the correct field per platform.
 */
function buildPlatformCredentials(
  platform: ConnectorPlatform,
  connectionType: string,
  creds: Record<string, string>,
  advertiserId: string,
): import('@openagency/types').PlatformCredentials {
  const base = {
    platform,
    tokens: {
      access_token: creds.system_user_token ?? creds.access_token ?? '',
      refresh_token: creds.refresh_token,
      token_type: 'Bearer',
      expires_at: Date.now() + 3_600_000,
    } as OAuthTokens,
    connected_at: new Date().toISOString(),
  };

  switch (platform) {
    case 'google_ads':
      return {
        ...base,
        account_id: advertiserId, // customer_id scoped to this advertiser
        manager_id: creds.login_customer_id, // MCC as login-customer-id header
        developer_token: creds.developer_token,
        client_id: creds.client_id,
        client_secret: creds.client_secret,
        refresh_token: creds.refresh_token,
      };
    case 'meta_ads':
      return {
        ...base,
        account_id: advertiserId, // ad_account_id
        app_id: creds.app_id,
        app_secret: creds.app_secret,
      };
    case 'dv360':
      return {
        ...base,
        account_id: advertiserId, // advertiser_id for DV360
        partner_id: creds.partner_id,
        // Service account creds: connector handles token internally via JWT
        // OAuth2 creds: pass through for refresh flow
        client_id: creds.client_id,
        client_secret: creds.client_secret,
        refresh_token: creds.refresh_token,
        service_account_json: creds.service_account_json,
      };
    case 'tiktok_ads':
      return {
        ...base,
        account_id: advertiserId,  // connector reads account_id
        advertiser_id: advertiserId,
        app_id: creds.app_id,
        app_secret: creds.app_secret,
      };
    case 'tiktok_shop':
      return {
        ...base,
        account_id: advertiserId,  // connector reads account_id
        shop_id: advertiserId,
        app_key: creds.app_key,
        app_secret: creds.app_secret,
      };
    case 'amazon_ads':
      return {
        ...base,
        profile_id: advertiserId,
        client_id: creds.client_id,
        client_secret: creds.client_secret,
        refresh_token: creds.refresh_token,
        region: creds.region,
      };
    default:
      return base;
  }
}
