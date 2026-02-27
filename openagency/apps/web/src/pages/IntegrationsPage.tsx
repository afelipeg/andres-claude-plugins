// ─── Integrations Page ──────────────────────────────────────────────
// Platform cards: connect/disconnect, sync status, interval settings.

import { useState, useCallback } from 'react';
import type { ConnectorPlatform, SyncInterval } from '@openagency/types';
import { useConnectorStore } from '../stores/connector-store';

interface PlatformCardConfig {
  platform: ConnectorPlatform;
  name: string;
  description: string;
  color: string;
  bgColor: string;
  icon: string;
  envVars: string[];
}

const PLATFORMS: PlatformCardConfig[] = [
  {
    platform: 'meta_ads',
    name: 'Meta Ads',
    description: 'Facebook + Instagram campaigns, ad sets, and insights',
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-100',
    icon: 'M',
    envVars: ['META_APP_ID', 'META_APP_SECRET'],
  },
  {
    platform: 'google_ads',
    name: 'Google Ads',
    description: 'Search, Display, Shopping, YouTube campaigns',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
    icon: 'G',
    envVars: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_ADS_DEVELOPER_TOKEN'],
  },
  {
    platform: 'dv360',
    name: 'Display & Video 360',
    description: 'Programmatic display, video, and audio campaigns',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-100',
    icon: 'D',
    envVars: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
  },
  {
    platform: 'tiktok_ads',
    name: 'TikTok Ads',
    description: 'In-feed, TopView, and Spark Ads campaigns',
    color: 'text-pink-700',
    bgColor: 'bg-pink-100',
    icon: 'T',
    envVars: ['TIKTOK_ADS_APP_ID', 'TIKTOK_ADS_SECRET'],
  },
  {
    platform: 'tiktok_shop',
    name: 'TikTok Shop',
    description: 'Shop orders, product performance, and sales data',
    color: 'text-rose-700',
    bgColor: 'bg-rose-100',
    icon: 'S',
    envVars: ['TIKTOK_SHOP_APP_KEY', 'TIKTOK_SHOP_APP_SECRET'],
  },
  {
    platform: 'amazon_ads',
    name: 'Amazon Ads',
    description: 'Sponsored Products, Brands, and Display campaigns',
    color: 'text-orange-700',
    bgColor: 'bg-orange-100',
    icon: 'A',
    envVars: ['AMAZON_ADS_CLIENT_ID', 'AMAZON_ADS_CLIENT_SECRET'],
  },
];

const SYNC_INTERVALS: { value: SyncInterval; label: string }[] = [
  { value: '15m', label: 'Every 15 min' },
  { value: '1h', label: 'Hourly' },
  { value: '6h', label: 'Every 6 hours' },
  { value: '24h', label: 'Daily' },
  { value: 'manual', label: 'Manual only' },
];

export function IntegrationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Platform Integrations</h2>
        <p className="mt-1 text-sm text-gray-500">
          Connect your advertising platforms to pull campaign data automatically.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PLATFORMS.map((config) => (
          <PlatformCard key={config.platform} config={config} />
        ))}
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h3 className="text-sm font-semibold text-gray-700">Setup Requirements</h3>
        <p className="mt-1 text-xs text-gray-500">
          Each platform requires API credentials set as environment variables before connecting.
          See the documentation for setup instructions per platform.
        </p>
        <div className="mt-3 grid gap-2 text-xs font-mono text-gray-600 sm:grid-cols-2">
          <div>
            <span className="font-semibold">Google:</span> GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
          </div>
          <div>
            <span className="font-semibold">Meta:</span> META_APP_ID, META_APP_SECRET
          </div>
          <div>
            <span className="font-semibold">TikTok Ads:</span> TIKTOK_ADS_APP_ID, TIKTOK_ADS_SECRET
          </div>
          <div>
            <span className="font-semibold">Amazon:</span> AMAZON_ADS_CLIENT_ID, AMAZON_ADS_CLIENT_SECRET
          </div>
        </div>
      </div>
    </div>
  );
}

function PlatformCard({ config }: { config: PlatformCardConfig }) {
  const platformState = useConnectorStore((s) => s.getPlatform(config.platform));
  const connect = useConnectorStore((s) => s.connect);
  const disconnect = useConnectorStore((s) => s.disconnect);
  const setSyncInterval = useConnectorStore((s) => s.setSyncInterval);
  const [syncing, setSyncing] = useState(false);

  const isConnected = platformState?.status === 'connected';
  const hasError = platformState?.status === 'error';

  const handleConnect = useCallback(async () => {
    // In production, this would open the OAuth popup
    // For now, mark as connected (OAuth flow requires backend)
    connect(config.platform);
  }, [config.platform, connect]);

  const handleDisconnect = useCallback(() => {
    disconnect(config.platform);
  }, [config.platform, disconnect]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    // Simulated sync — in production, uses usePlatformSync
    setTimeout(() => setSyncing(false), 2000);
  }, []);

  return (
    <div className={`rounded-xl border p-5 transition-shadow hover:shadow-md ${
      isConnected ? 'border-green-200 bg-green-50/30' : hasError ? 'border-red-200 bg-red-50/30' : 'border-gray-200 bg-white'
    }`}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold ${config.bgColor} ${config.color}`}>
          {config.icon}
        </span>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-gray-900">{config.name}</h3>
          <p className="text-xs text-gray-500">{config.description}</p>
        </div>
      </div>

      {/* Status */}
      {platformState && (
        <div className="mt-3 flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${
            isConnected ? 'bg-green-500' : hasError ? 'bg-red-500' : 'bg-gray-300'
          }`} />
          <span className="text-xs text-gray-600">
            {isConnected ? 'Connected' : hasError ? `Error: ${platformState.error}` : platformState.status}
          </span>
        </div>
      )}

      {/* Last sync */}
      {platformState?.lastSync && (
        <p className="mt-1 text-xs text-gray-400">
          Last sync: {new Date(platformState.lastSync.synced_at).toLocaleString()}
          {' '}({platformState.lastSync.row_count} rows)
        </p>
      )}

      {/* Sync interval */}
      {isConnected && (
        <div className="mt-3">
          <select
            value={platformState?.syncInterval ?? '1h'}
            onChange={(e) => setSyncInterval(config.platform, e.target.value as SyncInterval)}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700"
          >
            {SYNC_INTERVALS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex gap-2">
        {isConnected ? (
          <>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex-1 rounded-lg bg-brand-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
            >
              {syncing ? 'Syncing...' : 'Sync Now'}
            </button>
            <button
              onClick={handleDisconnect}
              className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              Disconnect
            </button>
          </>
        ) : (
          <button
            onClick={handleConnect}
            className="flex-1 rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-gray-800"
          >
            Connect
          </button>
        )}
      </div>
    </div>
  );
}
