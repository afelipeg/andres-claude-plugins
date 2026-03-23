// ─── Platform Sync Scheduler ────────────────────────────────────────
// Runs weekly sync for all connected agency platforms.
// Decrypts credentials, calls connector.fetchCampaigns(), persists to
// sync_results table, and populates the in-memory syncResultCache.
//
// Respects quota: brand_count * 8 runs/month — sync counts as 1 run.
// Schedule: weekly on Mondays at 03:00 UTC (configurable via SYNC_CRON).

import { createLogger } from '@openagency/core';
import { getConnector, hasConnector } from '@openagency/connectors';
import { decrypt } from '@openagency/memory';
import { ulid } from 'ulid';
import type { ConnectorPlatform, NormalizedCampaignRow, SyncResult } from '@openagency/types';
import type { ConnectorInfra } from './setup.js';

const log = createLogger('sync-scheduler');

type Db = { unsafe: (q: string, params?: unknown[]) => Promise<unknown[]> };

interface SyncSchedulerDeps {
  db: unknown;
  connectorInfra: ConnectorInfra;
  encryptionKey: string;
}

// Default: every Monday at 03:00 UTC — "0 3 * * 1"
const DEFAULT_SYNC_CRON = '0 3 * * 1';
const SYNC_INTERVAL_MS = 60_000; // Check every minute

/**
 * Simple cron matcher for 5-field cron expressions.
 * Copied from PipelineScheduler to avoid circular dependency.
 */
function parseCronField(field: string, value: number): boolean {
  if (field === '*') return true;
  for (const part of field.split(',')) {
    if (part.includes('-')) {
      const [lo, hi] = part.split('-').map(Number);
      if (lo !== undefined && hi !== undefined && value >= lo && value <= hi) return true;
    } else {
      if (Number(part) === value) return true;
    }
  }
  return false;
}

function matchesCron(cron: string, date: Date): boolean {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const [minF, hourF, domF, monF, dowF] = parts as [string, string, string, string, string];
  return (
    parseCronField(minF, date.getMinutes()) &&
    parseCronField(hourF, date.getHours()) &&
    parseCronField(domF, date.getDate()) &&
    parseCronField(monF, date.getMonth() + 1) &&
    parseCronField(dowF, date.getDay())
  );
}

/**
 * Build platform credentials from decrypted agency credentials + advertiser ID.
 * Mirrors the logic in agency-connectors.ts buildPlatformCredentials.
 */
function buildPlatformCredentials(
  platform: ConnectorPlatform,
  connectionType: string,
  creds: Record<string, string>,
  advertiserId: string,
): Record<string, unknown> {
  const base = {
    platform,
    tokens: {
      access_token: creds.system_user_token ?? creds.access_token ?? '',
      refresh_token: creds.refresh_token,
      token_type: 'Bearer',
      expires_at: Date.now() + 3_600_000,
    },
    connected_at: new Date().toISOString(),
  };

  switch (platform) {
    case 'google_ads':
      return { ...base, account_id: advertiserId, manager_id: creds.login_customer_id, developer_token: creds.developer_token, client_id: creds.client_id, client_secret: creds.client_secret, refresh_token: creds.refresh_token };
    case 'meta_ads':
      return { ...base, account_id: advertiserId, app_id: creds.app_id, app_secret: creds.app_secret };
    case 'dv360':
      return { ...base, account_id: advertiserId, partner_id: creds.partner_id, client_id: creds.client_id, client_secret: creds.client_secret, refresh_token: creds.refresh_token };
    case 'tiktok_ads':
      return { ...base, advertiser_id: advertiserId, app_id: creds.app_id, app_secret: creds.app_secret };
    case 'tiktok_shop':
      return { ...base, shop_id: advertiserId, app_key: creds.app_key, app_secret: creds.app_secret };
    case 'amazon_ads':
      return { ...base, profile_id: advertiserId, client_id: creds.client_id, client_secret: creds.client_secret, refresh_token: creds.refresh_token, region: creds.region };
    default:
      return base;
  }
}

export class PlatformSyncScheduler {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private cron: string;

  constructor(private deps: SyncSchedulerDeps) {
    this.cron = process.env['SYNC_CRON'] ?? DEFAULT_SYNC_CRON;
  }

  start(): void {
    if (this.timer) return;

    this.timer = setInterval(() => {
      void this.tick();
    }, SYNC_INTERVAL_MS);

    log.info({ cron: this.cron }, 'Platform sync scheduler started');
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    log.info('Platform sync scheduler stopped');
  }

  private async tick(): Promise<void> {
    const now = new Date();
    now.setSeconds(0, 0);

    if (!matchesCron(this.cron, now)) return;
    if (this.running) {
      log.warn('Sync already running — skipping this tick');
      return;
    }

    this.running = true;
    try {
      await this.syncAllAgencies();
    } catch (err) {
      log.error({ err }, 'Scheduled platform sync failed');
    } finally {
      this.running = false;
    }
  }

  /** Run on-demand (e.g., from admin endpoint). */
  async runNow(): Promise<{ synced: number; errors: number }> {
    if (this.running) return { synced: 0, errors: 0 };
    this.running = true;
    try {
      return await this.syncAllAgencies();
    } finally {
      this.running = false;
    }
  }

  private async syncAllAgencies(): Promise<{ synced: number; errors: number }> {
    const sql = this.deps.db as Db;
    const encKey = this.deps.encryptionKey;

    if (!encKey || encKey.length < 32) {
      log.warn('ENCRYPTION_KEY not set — skipping scheduled sync');
      return { synced: 0, errors: 0 };
    }

    // Load all active agency connections
    let connections: Array<Record<string, unknown>>;
    try {
      connections = (await sql.unsafe(
        `SELECT ac.agency_id, ac.platform, ac.connection_type, ac.credentials
         FROM agency_connections ac
         WHERE ac.status = 'connected'
         ORDER BY ac.agency_id`,
      )) as Array<Record<string, unknown>>;
    } catch (err) {
      log.error({ err }, 'Failed to load agency connections for scheduled sync');
      return { synced: 0, errors: 0 };
    }

    if (connections.length === 0) {
      log.info('No active agency connections — nothing to sync');
      return { synced: 0, errors: 0 };
    }

    log.info({ connections: connections.length }, 'Starting scheduled platform sync');

    let synced = 0;
    let errors = 0;

    for (const conn of connections) {
      const agencyId = conn['agency_id'] as string;
      const platform = conn['platform'] as ConnectorPlatform;
      const connectionType = conn['connection_type'] as string;
      const encCredentials = conn['credentials'] as string;

      if (!hasConnector(platform)) {
        log.warn({ platform, agency_id: agencyId }, 'No connector available — skipping');
        continue;
      }

      let creds: Record<string, string>;
      try {
        creds = JSON.parse(decrypt(encCredentials, encKey)) as Record<string, string>;
      } catch (err) {
        log.warn({ err, agency_id: agencyId, platform }, 'Failed to decrypt credentials — skipping');
        errors++;
        continue;
      }

      // Get active advertisers for this connection
      let advertiserIds: string[];
      try {
        const connIdRows = await sql.unsafe(
          `SELECT id FROM agency_connections WHERE agency_id = $1 AND platform = $2`,
          [agencyId, platform],
        );
        if (connIdRows.length === 0) continue;
        const connectionId = (connIdRows[0] as { id: string }).id;

        const advRows = await sql.unsafe(
          `SELECT advertiser_id FROM advertiser_scopes WHERE agency_connection_id = $1 AND status = 'active'`,
          [connectionId],
        );
        advertiserIds = (advRows as Array<{ advertiser_id: string }>).map((r) => r.advertiser_id);
      } catch {
        log.warn({ agency_id: agencyId, platform }, 'Failed to load advertisers — skipping');
        errors++;
        continue;
      }

      if (advertiserIds.length === 0) {
        log.info({ agency_id: agencyId, platform }, 'No active advertisers — skipping sync');
        continue;
      }

      // Sync data
      const days = 30;
      const end = new Date();
      const start = new Date(end.getTime() - days * 86_400_000);
      const dateRange = { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };

      const connector = getConnector(platform);
      const allRows: NormalizedCampaignRow[] = [];
      const syncErrors: string[] = [];

      for (const advId of advertiserIds) {
        const platformCreds = buildPlatformCredentials(platform, connectionType, creds, advId);
        try {
          const fetchedRows = await connector.fetchCampaigns(platformCreds as any, dateRange);
          allRows.push(...fetchedRows);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          log.warn({ platform, agency_id: agencyId, advertiser_id: advId, error: msg }, 'Scheduled sync failed for advertiser');
          syncErrors.push(`${advId}: ${msg}`);
        }
      }

      const syncStatus = syncErrors.length === advertiserIds.length ? 'error'
        : syncErrors.length > 0 ? 'partial'
        : 'success';

      // Update in-memory cache
      const syncResult: SyncResult = {
        platform,
        status: syncStatus as 'success' | 'partial' | 'error',
        rows: allRows,
        row_count: allRows.length,
        date_range: dateRange,
        synced_at: new Date().toISOString(),
        error: syncErrors.length > 0 ? syncErrors.join('; ') : undefined,
      };
      this.deps.connectorInfra.syncResultCache.set(`${agencyId}:${platform}`, syncResult);

      // Persist to DB
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
            syncErrors.length > 0 ? syncErrors.join('; ') : null,
            allRows.length <= 500 ? JSON.stringify(allRows) : JSON.stringify(allRows.slice(0, 500)),
          ],
        );
      } catch (err) {
        log.warn({ err, agency_id: agencyId, platform }, 'Failed to persist scheduled sync result');
      }

      // Touch updated_at on agency_connections
      await sql.unsafe(
        `UPDATE agency_connections SET updated_at = NOW() WHERE agency_id = $1 AND platform = $2`,
        [agencyId, platform],
      ).catch(() => {});

      if (syncStatus === 'error') {
        errors++;
      } else {
        synced++;
      }

      log.info({
        agency_id: agencyId,
        platform,
        status: syncStatus,
        row_count: allRows.length,
        advertiser_count: advertiserIds.length,
      }, 'Scheduled sync completed for platform');
    }

    log.info({ synced, errors, total: connections.length }, 'Scheduled platform sync completed');
    return { synced, errors };
  }
}
