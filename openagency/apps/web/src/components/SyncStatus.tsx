// ─── Sync Status Indicator ──────────────────────────────────────────
// Shows colored dots for each connected platform in the header.

import type { ConnectorPlatform, ConnectionStatus } from '@openagency/types';
import { useConnectorStore } from '../stores/connector-store';

const PLATFORM_LABELS: Record<ConnectorPlatform, string> = {
  google_ads: 'Google',
  meta_ads: 'Meta',
  dv360: 'DV360',
  tiktok_ads: 'TikTok',
  tiktok_shop: 'TT Shop',
  amazon_ads: 'Amazon',
};

const STATUS_COLORS: Record<ConnectionStatus, string> = {
  disconnected: 'bg-gray-300',
  connecting: 'bg-yellow-400 animate-pulse',
  connected: 'bg-green-500',
  expired: 'bg-orange-400',
  error: 'bg-red-500',
};

export function SyncStatus() {
  const platforms = useConnectorStore((s) => s.platforms);
  const connected = Array.from(platforms.values()).filter(
    (p) => p.status !== 'disconnected',
  );

  if (connected.length === 0) return null;

  return (
    <div className="flex items-center gap-3">
      {connected.map((p) => (
        <div key={p.platform} className="flex items-center gap-1.5" title={`${PLATFORM_LABELS[p.platform]}: ${p.status}`}>
          <div className={`h-2 w-2 rounded-full ${STATUS_COLORS[p.status]}`} />
          <span className="text-xs text-gray-500">{PLATFORM_LABELS[p.platform]}</span>
        </div>
      ))}
    </div>
  );
}
