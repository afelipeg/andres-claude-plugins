// ─── Connector Registry ─────────────────────────────────────────────
// Central registry mapping platform names to their connector implementations.

import type { ConnectorPlatform, PlatformConnector } from '@openagency/types';

const connectors = new Map<ConnectorPlatform, PlatformConnector>();

export function registerConnector(connector: PlatformConnector): void {
  connectors.set(connector.platform, connector);
}

export function getConnector(platform: ConnectorPlatform): PlatformConnector {
  const connector = connectors.get(platform);
  if (!connector) {
    throw new Error(`No connector registered for platform: ${platform}`);
  }
  return connector;
}

export function hasConnector(platform: ConnectorPlatform): boolean {
  return connectors.has(platform);
}

export function listConnectors(): ConnectorPlatform[] {
  return Array.from(connectors.keys());
}
