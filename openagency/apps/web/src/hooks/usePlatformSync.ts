// ─── Platform Sync Hook ─────────────────────────────────────────────
// Wraps connector sync logic for React components.

import { useCallback, useRef } from 'react';
import type {
  ConnectorPlatform,
  NormalizedCampaignRow,
  SyncResult,
} from '@openagency/types';
import { useConnectorStore } from '../stores/connector-store';

/**
 * Hook for syncing data from a connected platform.
 * Returns a sync function and the current sync state.
 */
export function usePlatformSync(platform: ConnectorPlatform) {
  const setSyncResult = useConnectorStore((s) => s.setSyncResult);
  const setStatus = useConnectorStore((s) => s.setStatus);
  const platformState = useConnectorStore((s) => s.getPlatform(platform));
  const syncingRef = useRef(false);

  const sync = useCallback(
    async (dateRangeDays = 30): Promise<SyncResult | null> => {
      if (syncingRef.current) return null;
      syncingRef.current = true;
      setStatus(platform, 'connecting');

      try {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - dateRangeDays);

        const dateRange = {
          start: start.toISOString().slice(0, 10),
          end: end.toISOString().slice(0, 10),
        };

        // In the browser, connectors are initialized by the IntegrationsPage
        // This hook triggers the actual data fetch
        const { getConnector } = await import('@openagency/connectors');
        const connector = getConnector(platform);
        const store = useConnectorStore.getState();
        const platformData = store.platforms.get(platform);

        if (!platformData) {
          throw new Error(`Platform ${platform} not connected`);
        }

        // For now, credentials are managed by the connector store
        // In production, they'd be loaded from BrowserCredentialStore
        const credentials = {
          platform,
          tokens: {
            access_token: '',
            token_type: 'bearer',
            expires_at: Date.now() + 3600000,
          },
          connected_at: new Date().toISOString(),
        };

        const rows: NormalizedCampaignRow[] = await connector.fetchCampaigns(
          credentials,
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

        setSyncResult(result);
        return result;
      } catch (error) {
        const result: SyncResult = {
          platform,
          status: 'error',
          rows: [],
          row_count: 0,
          date_range: { start: '', end: '' },
          synced_at: new Date().toISOString(),
          error: error instanceof Error ? error.message : String(error),
        };
        setSyncResult(result);
        return result;
      } finally {
        syncingRef.current = false;
      }
    },
    [platform, setSyncResult, setStatus],
  );

  return {
    sync,
    syncing: platformState?.status === 'connecting',
    lastSync: platformState?.lastSync,
    rows: platformState?.rows ?? [],
    error: platformState?.error,
  };
}

/**
 * Hook that provides all synced rows across all platforms.
 */
export function useAllPlatformRows(): NormalizedCampaignRow[] {
  return useConnectorStore((s) => s.getAllRows());
}
