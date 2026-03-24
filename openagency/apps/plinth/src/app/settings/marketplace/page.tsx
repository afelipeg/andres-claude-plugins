'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  Search,
  Package,
  Check,
  Download,
  Loader2,
  AlertCircle,
  Wrench,
  Filter,
} from 'lucide-react';

interface MCPServer {
  id: string;
  name: string;
  description: string;
  tool_count: number;
  category: string;
  installed: boolean;
  version?: string;
  author?: string;
}

const CATEGORIES = [
  'All',
  'Advertising',
  'Analytics',
  'Data',
  'Creative',
  'Reporting',
  'Automation',
] as const;

function MCPCard({
  server,
  onInstall,
  installing,
}: {
  server: MCPServer;
  onInstall: (id: string) => void;
  installing: string | null;
}) {
  const isInstalling = installing === server.id;

  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Package className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {server.name}
            </p>
            {server.author && (
              <p className="text-xs text-muted-foreground truncate">
                by {server.author}
              </p>
            )}
          </div>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full px-2.5 py-1 text-xs font-medium',
            server.installed
              ? 'bg-emerald-500/15 text-emerald-400'
              : 'bg-muted text-muted-foreground'
          )}
        >
          {server.installed ? 'Installed' : server.category}
        </span>
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground line-clamp-2 flex-1">
        {server.description}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 mt-auto">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Wrench className="h-3 w-3" />
          <span>{server.tool_count} tool{server.tool_count !== 1 ? 's' : ''}</span>
          {server.version && (
            <>
              <span className="text-zinc-600 mx-1">|</span>
              <span>v{server.version}</span>
            </>
          )}
        </div>

        {server.installed ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400">
            <Check className="h-3.5 w-3.5" />
            Installed
          </span>
        ) : (
          <button
            onClick={() => onInstall(server.id)}
            disabled={isInstalling}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {isInstalling ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Install
          </button>
        )}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-3 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-muted" />
        <div className="space-y-1.5 flex-1">
          <div className="h-4 w-32 rounded bg-muted" />
          <div className="h-3 w-20 rounded bg-muted" />
        </div>
      </div>
      <div className="h-8 w-full rounded bg-muted" />
      <div className="h-7 w-16 rounded bg-muted" />
    </div>
  );
}

export default function MarketplacePage() {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('All');
  const [installing, setInstalling] = useState<string | null>(null);

  const getToken = useCallback(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('plinth_token') || '';
    }
    return '';
  }, []);

  useEffect(() => {
    async function fetchMarketplace() {
      try {
        const res = await fetch('/api/v1/mcp-marketplace', {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (!res.ok) throw new Error('Failed to load marketplace');
        const json = await res.json();
        setServers(Array.isArray(json) ? json : json.servers || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load marketplace');
      } finally {
        setLoading(false);
      }
    }
    fetchMarketplace();
  }, [getToken]);

  async function handleInstall(id: string) {
    setInstalling(id);
    try {
      const res = await fetch(`/api/v1/mcp-marketplace/${id}/install`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Install failed');
      // Update local state
      setServers((prev) =>
        prev.map((s) => (s.id === id ? { ...s, installed: true } : s))
      );
    } catch {
      // Silently fail for now
    } finally {
      setInstalling(null);
    }
  }

  const filtered = useMemo(() => {
    let result = servers;
    if (category !== 'All') {
      result = result.filter((s) => s.category === category);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q)
      );
    }
    return result;
  }, [servers, category, search]);

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-foreground">MCP Marketplace</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Browse and install MCP servers to extend Plinth with new tools and capabilities.
        </p>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search servers..."
            className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex items-center gap-1 overflow-x-auto">
          <Filter className="h-4 w-4 text-muted-foreground mr-1 shrink-0" />
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={cn(
                'whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                category === cat
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-4 flex items-center gap-3 text-sm text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          : filtered.map((server) => (
              <MCPCard
                key={server.id}
                server={server}
                onInstall={handleInstall}
                installing={installing}
              />
            ))}
      </div>

      {!loading && filtered.length === 0 && (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <Package className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {search || category !== 'All'
              ? 'No servers match your filters.'
              : 'No MCP servers available yet.'}
          </p>
        </div>
      )}
    </div>
  );
}
