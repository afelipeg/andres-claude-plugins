'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  Search,
  Tv2,
  ShoppingBag,
  BarChart3,
  Target,
  Megaphone,
  RefreshCw,
  Link2,
  Link2Off,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  Building2,
} from 'lucide-react';
import { BrandDiscoveryModal } from '@/components/connections/BrandDiscoveryModal';
import { ConnectDialog } from '@/components/connections/ConnectDialog';

interface ConnectorStatus {
  platform: string;
  connected: boolean;
  last_sync?: string;
  accounts_count?: number;
  status: 'connected' | 'disconnected' | 'syncing' | 'error';
  error_message?: string;
}

interface PlatformConfig {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const PLATFORMS: PlatformConfig[] = [
  {
    id: 'google_ads',
    name: 'Google Ads',
    description: 'Search, Display, YouTube, Performance Max campaigns',
    icon: Search,
    color: 'bg-blue-500/15 text-blue-400',
  },
  {
    id: 'meta_ads',
    name: 'Meta Ads',
    description: 'Facebook & Instagram advertising campaigns',
    icon: Megaphone,
    color: 'bg-indigo-500/15 text-indigo-400',
  },
  {
    id: 'dv360',
    name: 'Display & Video 360',
    description: 'Programmatic display, video and connected TV',
    icon: Tv2,
    color: 'bg-green-500/15 text-green-400',
  },
  {
    id: 'tiktok_ads',
    name: 'TikTok Ads',
    description: 'TikTok For Business advertising platform',
    icon: Target,
    color: 'bg-pink-500/15 text-pink-400',
  },
  {
    id: 'amazon_ads',
    name: 'Amazon Ads',
    description: 'Sponsored Products, Brands, Display and DSP',
    icon: ShoppingBag,
    color: 'bg-orange-500/15 text-orange-400',
  },
];

function StatusBadge({ status }: { status: ConnectorStatus['status'] }) {
  const config = {
    connected: {
      icon: CheckCircle2,
      label: 'Connected',
      classes: 'bg-emerald-500/15 text-emerald-400',
    },
    disconnected: {
      icon: XCircle,
      label: 'Disconnected',
      classes: 'bg-zinc-500/15 text-zinc-400',
    },
    syncing: {
      icon: RefreshCw,
      label: 'Syncing',
      classes: 'bg-blue-500/15 text-blue-400',
    },
    error: {
      icon: AlertCircle,
      label: 'Error',
      classes: 'bg-red-500/15 text-red-400',
    },
  }[status];

  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        config.classes
      )}
    >
      <Icon className={cn('h-3 w-3', status === 'syncing' && 'animate-spin')} />
      {config.label}
    </span>
  );
}

function ConnectorCard({
  platform,
  status,
  onConnect,
  onDisconnect,
  onSync,
  onManageBrands,
  advertiserCount,
  actionLoading,
}: {
  platform: PlatformConfig;
  status: ConnectorStatus | undefined;
  onConnect: (p: PlatformConfig) => void;
  onDisconnect: (p: PlatformConfig) => void;
  onSync: (p: PlatformConfig) => void;
  onManageBrands: (p: PlatformConfig) => void;
  advertiserCount?: number;
  actionLoading: string | null;
}) {
  const Icon = platform.icon;
  const isConnected = status?.connected ?? false;
  const isSyncing = status?.status === 'syncing';
  const isLoading = actionLoading === platform.id;

  const formatTime = (iso?: string) => {
    if (!iso) return 'Never';
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    return `${diffDays}d ago`;
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4">
      {/* Top: icon + status */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', platform.color)}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{platform.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
              {platform.description}
            </p>
          </div>
        </div>
        <StatusBadge status={status?.status ?? 'disconnected'} />
      </div>

      {/* Meta */}
      {isConnected && (
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Last sync: {formatTime(status?.last_sync)}</span>
          </div>
          <button
            onClick={() => onManageBrands(platform)}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <BarChart3 className="h-3 w-3" />
            <span>{advertiserCount ?? 0} brand{(advertiserCount ?? 0) !== 1 ? 's' : ''}</span>
          </button>
        </div>
      )}

      {/* Error message */}
      {status?.status === 'error' && status.error_message && (
        <p className="text-xs text-red-400 bg-red-500/10 rounded-md px-3 py-2">
          {status.error_message}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 mt-auto pt-1">
        {isConnected ? (
          <>
            <button
              onClick={() => onSync(platform)}
              disabled={isSyncing || isLoading}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50 transition-colors"
            >
              {isSyncing || isLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Sync Now
            </button>
            <button
              onClick={() => onManageBrands(platform)}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-emerald-500/30 px-3 py-2 text-sm text-emerald-400 hover:bg-emerald-500/10 transition-colors"
            >
              <Building2 className="h-3.5 w-3.5" />
              Brands
            </button>
            <button
              onClick={() => onDisconnect(platform)}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50 transition-colors"
            >
              <Link2Off className="h-3.5 w-3.5" />
              Disconnect
            </button>
          </>
        ) : (
          <button
            onClick={() => onConnect(platform)}
            disabled={isLoading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Link2 className="h-4 w-4" />
            )}
            Connect
          </button>
        )}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-muted" />
        <div className="space-y-1.5 flex-1">
          <div className="h-4 w-28 rounded bg-muted" />
          <div className="h-3 w-40 rounded bg-muted" />
        </div>
      </div>
      <div className="h-9 rounded-md bg-muted" />
    </div>
  );
}

export default function ConnectionsPage() {
  const [statuses, setStatuses] = useState<Record<string, ConnectorStatus>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [discoveryPlatform, setDiscoveryPlatform] = useState<PlatformConfig | null>(null);
  const [connectPlatform, setConnectPlatform] = useState<PlatformConfig | null>(null);

  const getToken = useCallback(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('plinth_token') || '';
    }
    return '';
  }, []);

  const fetchStatuses = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/agency/connections', {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Failed to load connector statuses');
      const json = await res.json();
      const connections = json.connections ?? json.data ?? (Array.isArray(json) ? json : []);
      const statusMap: Record<string, ConnectorStatus> = {};
      for (const conn of connections) {
        statusMap[conn.platform] = {
          platform: conn.platform,
          connected: conn.status === 'connected',
          last_sync: conn.last_sync,
          accounts_count: conn.advertiser_count,
          status: conn.sync_status === 'syncing' ? 'syncing' : conn.status === 'connected' ? 'connected' : 'disconnected',
        };
      }
      setStatuses(statusMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load statuses');
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchStatuses();
  }, [fetchStatuses]);

  function handleConnect(platform: PlatformConfig) {
    setConnectPlatform(platform);
  }

  async function handleDisconnect(platform: PlatformConfig) {
    setActionLoading(platform.id);
    try {
      await fetch(`/api/v1/agency/connections/${platform.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      await fetchStatuses();
    } catch {
      // Refresh statuses regardless
      await fetchStatuses();
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSync(platform: PlatformConfig) {
    setActionLoading(platform.id);
    try {
      await fetch(`/api/v1/agency/connections/${platform.id}/sync`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      // Update local status to syncing
      setStatuses((prev) => ({
        ...prev,
        [platform.id]: {
          ...(prev[platform.id] || { platform: platform.id, connected: true }),
          status: 'syncing',
        } as ConnectorStatus,
      }));
    } catch {
      // ignore
    } finally {
      setActionLoading(null);
    }
  }

  function handleManageBrands(platform: PlatformConfig) {
    setDiscoveryPlatform(platform);
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Platform Connections</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Connect your advertising platforms to enable data ingestion and analysis.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-4 flex items-center gap-3 text-sm text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
          : PLATFORMS.map((platform) => (
              <ConnectorCard
                key={platform.id}
                platform={platform}
                status={statuses[platform.id]}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
                onSync={handleSync}
                onManageBrands={handleManageBrands}
                advertiserCount={statuses[platform.id]?.accounts_count}
                actionLoading={actionLoading}
              />
            ))}
      </div>

      {/* Credential entry dialog */}
      {connectPlatform && (
        <ConnectDialog
          platform={connectPlatform}
          open={!!connectPlatform}
          onOpenChange={(open) => {
            if (!open) setConnectPlatform(null);
          }}
          onConnected={() => {
            const platform = connectPlatform;
            setConnectPlatform(null);
            fetchStatuses().then(() => {
              // Auto-open brand discovery after connecting
              if (platform) setDiscoveryPlatform(platform);
            });
          }}
        />
      )}

      {/* Brand discovery modal */}
      {discoveryPlatform && (
        <BrandDiscoveryModal
          platform={discoveryPlatform}
          open={!!discoveryPlatform}
          onOpenChange={(open) => { if (!open) setDiscoveryPlatform(null); }}
          onSaved={() => { setDiscoveryPlatform(null); fetchStatuses(); }}
        />
      )}
    </div>
  );
}
