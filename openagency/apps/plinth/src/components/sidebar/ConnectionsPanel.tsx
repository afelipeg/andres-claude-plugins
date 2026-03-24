'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Wifi, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConnectionStatus {
  platform: string;
  status?: 'connected' | 'disconnected' | 'syncing';
  connected?: boolean;
  syncing?: boolean;
  last_sync?: string | null;
}

interface ConnectionsPanelProps {
  compact?: boolean;
}

const PLATFORM_META: Record<string, { label: string; color: string; icon: string }> = {
  google_ads: { label: 'Google Ads', color: 'text-blue-400', icon: 'G' },
  meta_ads: { label: 'Meta Ads', color: 'text-indigo-400', icon: 'M' },
  dv360: { label: 'DV360', color: 'text-emerald-400', icon: 'D' },
  tiktok_ads: { label: 'TikTok Ads', color: 'text-pink-400', icon: 'T' },
};

function normalizeStatus(conn: ConnectionStatus): 'connected' | 'disconnected' | 'syncing' {
  if (conn.status) return conn.status;
  if (conn.syncing) return 'syncing';
  if (conn.connected) return 'connected';
  return 'disconnected';
}

const STATUS_BADGES: Record<string, { label: string; dotClass: string }> = {
  connected: { label: 'Connected', dotClass: 'bg-emerald-500' },
  disconnected: { label: 'Disconnected', dotClass: 'bg-zinc-500' },
  syncing: { label: 'Syncing', dotClass: 'bg-blue-500 animate-pulse' },
};

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  const lsToken = localStorage.getItem('plinth_token');
  if (lsToken) return lsToken;
  const match = document.cookie.match(/(?:^|;\s*)plinth_token=([^;]*)/);
  return match ? match[1] : null;
}

// Default platforms to show when API has no data
const DEFAULT_PLATFORMS: ConnectionStatus[] = [
  { platform: 'google_ads', status: 'disconnected' },
  { platform: 'meta_ads', status: 'disconnected' },
  { platform: 'dv360', status: 'disconnected' },
  { platform: 'tiktok_ads', status: 'disconnected' },
];

export function ConnectionsPanel({ compact = false }: ConnectionsPanelProps) {
  const [connections, setConnections] = useState<ConnectionStatus[]>(DEFAULT_PLATFORMS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/v1/connectors/status', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch connector status');
      const data = await res.json();
      const statuses: ConnectionStatus[] = Array.isArray(data) ? data : data.connectors ?? data.platforms ?? data.data ?? [];
      if (statuses.length > 0) {
        setConnections(statuses);
      }
      setError(null);
    } catch {
      // Keep defaults, no error displayed in compact mode
      if (!compact) setError('Could not load status');
    } finally {
      setLoading(false);
    }
  }, [compact]);

  useEffect(() => {
    fetchStatus();
    // Poll every 30s
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  if (compact) {
    return (
      <div className="px-3 py-2 border-t border-zinc-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-600">
            Connections
          </span>
          {loading && <Loader2 className="h-3 w-3 animate-spin text-zinc-600" />}
        </div>
        <div className="space-y-1">
          {connections.map((conn) => {
            const meta = PLATFORM_META[conn.platform] ?? {
              label: conn.platform,
              color: 'text-zinc-400',
              icon: conn.platform.charAt(0).toUpperCase(),
            };
            const status = normalizeStatus(conn);
            const badge = STATUS_BADGES[status];
            return (
              <div
                key={conn.platform}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-zinc-400"
              >
                <div className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', badge.dotClass)} />
                <span className="text-xs truncate flex-1">{meta.label}</span>
                {conn.last_sync && (
                  <span className="text-[10px] text-zinc-600 flex-shrink-0">
                    {relativeTime(conn.last_sync)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Full view
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">Platform Connections</h3>
        <button
          onClick={fetchStatus}
          disabled={loading}
          className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors disabled:opacity-50"
          aria-label="Refresh status"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-400 mb-3">{error}</p>
      )}

      <div className="space-y-2">
        {connections.map((conn) => {
          const meta = PLATFORM_META[conn.platform] ?? {
            label: conn.platform,
            color: 'text-zinc-400',
            icon: conn.platform.charAt(0).toUpperCase(),
          };
          const status = normalizeStatus(conn);
          const badge = STATUS_BADGES[status];
          const isConnected = status === 'connected' || status === 'syncing';

          return (
            <div
              key={conn.platform}
              className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2.5"
            >
              {/* Platform icon */}
              <div className={cn('flex h-8 w-8 items-center justify-center rounded-md bg-zinc-800 text-sm font-bold flex-shrink-0', meta.color)}>
                {meta.icon}
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground">{meta.label}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className={cn('h-1.5 w-1.5 rounded-full', badge.dotClass)} />
                  <span className="text-xs text-zinc-500">{badge.label}</span>
                  {conn.last_sync && (
                    <>
                      <span className="text-zinc-700">&middot;</span>
                      <span className="text-xs text-zinc-600">{relativeTime(conn.last_sync)}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Action */}
              {!isConnected && (
                <button className="flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-700 hover:text-foreground transition-colors flex-shrink-0">
                  <Wifi className="h-3 w-3" />
                  Connect
                </button>
              )}

              {status === 'syncing' && (
                <div className="flex items-center gap-1 text-xs text-blue-400 flex-shrink-0">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Syncing
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
