// ─── Onboarding Routes ──────────────────────────────────────────────
// GET /v1/onboarding/status — onboarding progress for the setup wizard

import { Hono } from 'hono';
import { hasConnector } from '@openagency/connectors';
import type { ConnectorPlatform } from '@openagency/types';
import type { ConnectorInfra } from '../connectors/setup.js';
import type { McpClientRegistry } from '@openagency/agent';

const ALL_PLATFORMS: ConnectorPlatform[] = [
  'google_ads', 'meta_ads', 'dv360', 'tiktok_ads', 'tiktok_shop', 'amazon_ads',
];

// In-memory store for platform connection preferences
const connectionPrefs = new Map<string, 'rest' | 'mcp' | 'both'>();

export function onboardingRoutes(
  connectorInfra: ConnectorInfra,
  mcpRegistry: McpClientRegistry,
) {
  const app = new Hono();

  // ─── Onboarding status ─────────────────────────────────────────
  app.get('/v1/onboarding/status', (c) => {
    const connectedPlatforms = connectorInfra.credentialStore.platforms();
    const mcpServers = mcpRegistry.listServers();
    const activeSyncs = connectorInfra.syncScheduler.activePlatforms();

    const platforms = ALL_PLATFORMS.map((platform) => {
      const restConnected = connectedPlatforms.includes(platform);
      const syncResult = connectorInfra.syncResultCache.get(platform);
      const pref = connectionPrefs.get(platform);

      // Check if MCP is connected for this platform
      const mcpConnected = mcpServers.some(
        (s: { name: string }) => s.name.toLowerCase().includes(platform.replace('_', '')),
      );

      return {
        platform,
        connection_type: pref ?? null,
        rest_connected: restConnected,
        mcp_connected: mcpConnected,
        connected: restConnected || mcpConnected,
        syncing: activeSyncs.includes(platform),
        has_sync_data: !!syncResult?.rows?.length,
        last_sync: syncResult?.synced_at ?? null,
        has_connector: hasConnector(platform),
      };
    });

    const connected = platforms.filter((p) => p.connected).length;
    const pending = platforms.filter((p) => !p.connected).length;
    const synced = platforms.filter((p) => p.has_sync_data).length;

    return c.json({
      platforms_connected: connected,
      platforms_pending: pending,
      platforms_synced: synced,
      platforms_total: ALL_PLATFORMS.length,
      onboarding_complete: connected > 0 && synced > 0,
      mcp_servers_connected: mcpServers.length,
      sync_status: activeSyncs.length > 0 ? 'syncing' : synced > 0 ? 'synced' : 'pending',
      platforms,
    });
  });

  return app;
}

// Export for configure endpoint in connectors.ts
export { connectionPrefs };
