// ─── Sync Scheduler ─────────────────────────────────────────────────
// Manages periodic data sync for connected platforms using setInterval.

import type {
  ConnectorPlatform,
  SyncInterval,
  PlatformCredentials,
  SyncResult,
  NormalizedCampaignRow,
} from '@openagency/types';
import { getConnector } from '../registry.js';

const INTERVAL_MS: Record<SyncInterval, number> = {
  '15m': 15 * 60_000,
  '1h': 60 * 60_000,
  '6h': 6 * 60 * 60_000,
  '24h': 24 * 60 * 60_000,
  manual: 0,
};

export type SyncEventHandler = (result: SyncResult) => void;

export class SyncScheduler {
  private timers = new Map<ConnectorPlatform, ReturnType<typeof setInterval>>();
  private handlers: SyncEventHandler[] = [];

  onSync(handler: SyncEventHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  /**
   * Start periodic sync for a platform.
   */
  start(
    platform: ConnectorPlatform,
    credentials: PlatformCredentials,
    interval: SyncInterval,
    dateRangeDays = 30,
  ): void {
    this.stop(platform);

    if (interval === 'manual') return;

    const ms = INTERVAL_MS[interval];
    if (ms <= 0) return;

    // Run immediately, then on interval
    void this.syncNow(platform, credentials, dateRangeDays);

    const timer = setInterval(() => {
      void this.syncNow(platform, credentials, dateRangeDays);
    }, ms);

    this.timers.set(platform, timer);
  }

  /**
   * Stop periodic sync for a platform.
   */
  stop(platform: ConnectorPlatform): void {
    const timer = this.timers.get(platform);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(platform);
    }
  }

  /**
   * Stop all syncs.
   */
  stopAll(): void {
    for (const [platform] of this.timers) {
      this.stop(platform);
    }
  }

  /**
   * Trigger an immediate sync for a platform.
   */
  async syncNow(
    platform: ConnectorPlatform,
    credentials: PlatformCredentials,
    dateRangeDays = 30,
  ): Promise<SyncResult> {
    const connector = getConnector(platform);

    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - dateRangeDays);

    const dateRange = {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    };

    try {
      // Refresh tokens if needed
      let activeCredentials = credentials;
      if (!connector.isTokenValid(credentials.tokens)) {
        const newTokens = await connector.refreshTokens(credentials.tokens);
        activeCredentials = { ...credentials, tokens: newTokens };
      }

      const rows: NormalizedCampaignRow[] = await connector.fetchCampaigns(
        activeCredentials,
        dateRange,
      );

      const result: SyncResult = {
        platform,
        status: 'success',
        rows,
        row_count: rows.length,
        date_range: dateRange,
        synced_at: new Date().toISOString(),
      };

      this.emit(result);
      return result;
    } catch (error) {
      const result: SyncResult = {
        platform,
        status: 'error',
        rows: [],
        row_count: 0,
        date_range: dateRange,
        synced_at: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      };

      this.emit(result);
      return result;
    }
  }

  /**
   * Check which platforms are actively syncing.
   */
  activePlatforms(): ConnectorPlatform[] {
    return Array.from(this.timers.keys());
  }

  private emit(result: SyncResult): void {
    for (const handler of this.handlers) {
      try {
        handler(result);
      } catch {
        // Don't let handler errors break the scheduler
      }
    }
  }
}
