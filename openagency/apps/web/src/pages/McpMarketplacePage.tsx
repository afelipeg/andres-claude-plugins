// ─── MCP Marketplace Page ────────────────────────────────────────────
// Catalog grid + custom MCP connection + connected list

import { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw, Trash2, Plus, ExternalLink, Server, Zap, Cable, Info } from 'lucide-react';
import {
  getCatalog,
  listConnections,
  createConnection,
  testConnection,
  deleteConnection,
  type CatalogEntry,
  type McpConnection,
  type AuthField,
} from '../api/mcp-marketplace';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../components/ui/dialog';
import {
  GoogleAdsLogo,
  MetaLogo,
  TikTokLogo,
  AmazonAdsLogo,
  DV360Logo,
} from '../components/platform-logos';

// ─── Logo Mapping ────────────────────────────────────────────────────

const LOGO_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  google_ads: GoogleAdsLogo,
  meta_ads: MetaLogo,
  tiktok_ads: TikTokLogo,
  amazon_ads: AmazonAdsLogo,
  dv360: DV360Logo,
};

function PlatformLogo({ logo, className }: { logo: string; className?: string }) {
  const Logo = LOGO_MAP[logo];
  if (Logo) return <Logo className={className} />;
  return (
    <div className={`flex items-center justify-center rounded-lg bg-white/10 text-white/50 text-xs font-bold ${className}`}>
      MCP
    </div>
  );
}

// ─── Badge Component ─────────────────────────────────────────────────

function Badge({ text, variant }: { text: string; variant: 'official' | 'tools' | 'ready' | 'stale' }) {
  const styles = {
    official: 'bg-[#00F5FF]/20 text-[#00F5FF]',
    tools: 'bg-purple-100 text-purple-300',
    ready: 'bg-emerald-500/100/20 text-emerald-300',
    stale: 'bg-amber-500/100/20 text-amber-300',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${styles[variant]}`}>
      {text}
    </span>
  );
}

// ─── Airbyte Agent Connectors Banner ─────────────────────────────────

const AIRBYTE_PLATFORMS = [
  'Google Ads',
  'Meta',
  'TikTok',
  'Amazon',
  'LinkedIn',
  'Snapchat',
  'Pinterest',
];

function AirbyteBanner({ connections }: { connections: McpConnection[] }) {
  const airbyteConn = useMemo(
    () => connections.find((c) => c.name.toLowerCase().includes('airbyte')),
    [connections],
  );

  const isConnected = airbyteConn && airbyteConn.status === 'connected';
  const toolCount = airbyteConn?.tools.length ?? 0;

  if (isConnected) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 border border-emerald-500/20">
            <Cable className="h-5 w-5 text-emerald-400" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="text-sm font-semibold text-white/95">Airbyte Agent Connectors</h4>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Connected
              </span>
            </div>
            <p className="text-xs text-white/60 mb-2.5">
              {toolCount} tool{toolCount !== 1 ? 's' : ''} available via Airbyte sidecar
            </p>

            {/* Platform badges */}
            <div className="flex flex-wrap gap-1.5">
              {AIRBYTE_PLATFORMS.map((platform) => (
                <span
                  key={platform}
                  className="inline-flex items-center rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-300/80"
                >
                  {platform}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-3 pt-2.5 border-t border-emerald-500/10">
          <p className="text-[10px] text-white/40">Powered by Airbyte</p>
        </div>
      </div>
    );
  }

  // Not connected state
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/5 border border-white/10">
          <Info className="h-5 w-5 text-white/40" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-white/70">Airbyte Agent Connectors available</h4>
          <p className="text-xs text-white/40 mt-0.5">
            Multi-platform data ingestion via Airbyte MCP sidecar — contact admin to enable
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Auth Field Input ────────────────────────────────────────────────

function AuthFieldInput({
  field,
  value,
  onChange,
}: {
  field: AuthField;
  value: string;
  onChange: (value: string) => void;
}) {
  const baseClass = 'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/95 placeholder:text-white/40 focus:border-[#00F5FF]/50 focus:outline-none focus:ring-1 focus:ring-[#00F5FF]/30';

  return (
    <div>
      <label className="block text-xs font-medium text-white/70 mb-1.5">
        {field.label}
        {field.required === false && <span className="text-white/40 ml-1">(optional)</span>}
      </label>
      {field.type === 'textarea' ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.help}
          rows={4}
          className={`${baseClass} resize-none font-mono text-xs`}
        />
      ) : field.type === 'select' ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={baseClass}>
          <option value="">Select...</option>
          {field.options?.map((opt) => (
            <option key={opt} value={opt}>{opt.toUpperCase()}</option>
          ))}
        </select>
      ) : (
        <input
          type={field.type === 'password' ? 'password' : 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.help}
          className={baseClass}
        />
      )}
      <p className="mt-1 text-[10px] text-white/40">{field.help}</p>
    </div>
  );
}

// ─── Catalog Connection Dialog ───────────────────────────────────────

function CatalogConnectDialog({
  entry,
  open,
  onOpenChange,
  onConnected,
}: {
  entry: CatalogEntry;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected: () => void;
}) {
  const [fields, setFields] = useState<Record<string, string>>({});
  const [endpointUrl, setEndpointUrl] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ tools_discovered: number } | null>(null);

  const updateField = (key: string, value: string) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  };

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      const res = await createConnection({
        catalog_id: entry.id,
        auth_fields: fields,
        ...(endpointUrl.trim() ? { endpoint_url: endpointUrl.trim() } : {}),
      });
      setResult({ tools_discovered: res.tools_discovered });
      onConnected();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setConnecting(false);
    }
  };

  const hasRequiredFields = entry.auth_fields
    .filter((f) => f.required !== false)
    .every((f) => (fields[f.key] ?? '').trim().length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 border border-white/5">
              <PlatformLogo logo={entry.logo} className="h-8 w-8" />
            </div>
            <div>
              <DialogTitle>Connect {entry.name}</DialogTitle>
              <DialogDescription>{entry.description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {result ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-emerald-500/100/10 border border-emerald-500/30 p-4 text-center">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/100/20">
                <Zap className="h-5 w-5 text-emerald-300" />
              </div>
              <p className="text-sm font-medium text-emerald-300">Connected successfully!</p>
              <p className="text-xs text-emerald-300 mt-1">{result.tools_discovered} tools discovered</p>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="w-full rounded-lg bg-[#00F5FF]/20 px-4 py-2 text-sm font-medium text-white hover:bg-[#00F5FF]/30"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Info banner */}
            {!entry.hosted && (
              <div className="rounded-lg bg-white/5 border border-white/10 p-3 flex items-center gap-2">
                <Server className="h-4 w-4 text-white/50 shrink-0" />
                <p className="text-[11px] text-white/60">
                  Enter your credentials to connect. Optionally provide a custom MCP endpoint URL.
                </p>
              </div>
            )}

            {/* Auth fields */}
            <div className="space-y-3">
              {entry.auth_fields.map((field) => (
                <AuthFieldInput
                  key={field.key}
                  field={field}
                  value={fields[field.key] ?? ''}
                  onChange={(v) => updateField(field.key, v)}
                />
              ))}
            </div>

            {/* Custom MCP Endpoint — only for non-hosted entries */}
            {!entry.hosted && (
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1.5">
                  Custom MCP Endpoint <span className="text-white/40">(optional)</span>
                </label>
                <input
                  value={endpointUrl}
                  onChange={(e) => setEndpointUrl(e.target.value)}
                  placeholder="https://your-meta-mcp.example.com/mcp"
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-mono text-white/90 placeholder:text-white/30 focus:border-[#00F5FF]/50 focus:outline-none focus:ring-1 focus:ring-[#00F5FF]/30"
                />
                <p className="text-[10px] text-white/40 mt-1">
                  Leave empty to store credentials only. Provide a URL if you have a hosted MCP server.
                </p>
              </div>
            )}

            {/* Tools preview */}
            <div className="rounded-lg bg-white/5 p-3">
              <p className="text-[10px] font-semibold text-white/50 uppercase tracking-wider mb-1">
                {entry.tools_count} tools available
              </p>
              <div className="flex flex-wrap gap-1">
                {entry.tools_preview.map((t) => (
                  <span key={t} className="rounded bg-white/5 border border-white/10 px-1.5 py-0.5 text-[10px] font-mono text-white/60">{t}</span>
                ))}
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            <DialogFooter>
              <button
                onClick={() => onOpenChange(false)}
                className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleConnect()}
                disabled={connecting || !hasRequiredFields}
                className="rounded-lg bg-[#00F5FF]/20 px-4 py-2 text-sm font-medium text-white hover:bg-[#00F5FF]/30 disabled:opacity-50 flex items-center gap-2"
              >
                {connecting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Connecting...
                  </>
                ) : entry.hosted ? 'Connect' : 'Connect & Launch'}
              </button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Custom MCP Dialog ───────────────────────────────────────────────

function CustomMcpDialog({
  open,
  onOpenChange,
  onConnected,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected: () => void;
}) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      await createConnection({ name, url, auth_token: authToken || undefined });
      onConnected();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setConnecting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Custom MCP</DialogTitle>
          <DialogDescription>Connect to any MCP server by entering its URL and authentication.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-white/70 mb-1.5">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Custom MCP"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm focus:border-[#00F5FF]/50 focus:outline-none focus:ring-1 focus:ring-[#00F5FF]/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/70 mb-1.5">MCP Server URL</label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-mcp-server.com/mcp"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-mono focus:border-[#00F5FF]/50 focus:outline-none focus:ring-1 focus:ring-[#00F5FF]/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-white/70 mb-1.5">Auth Token (optional)</label>
            <input
              type="password"
              value={authToken}
              onChange={(e) => setAuthToken(e.target.value)}
              placeholder="Bearer token or API key"
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm focus:border-[#00F5FF]/50 focus:outline-none focus:ring-1 focus:ring-[#00F5FF]/30"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <button onClick={() => onOpenChange(false)} className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/5">Cancel</button>
          <button
            onClick={() => void handleConnect()}
            disabled={connecting || !url.trim()}
            className="rounded-lg bg-[#00F5FF]/20 px-4 py-2 text-sm font-medium text-white hover:bg-[#00F5FF]/30 disabled:opacity-50"
          >
            {connecting ? 'Connecting...' : 'Test & Connect'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Connected MCP List ──────────────────────────────────────────────

function ConnectedList({
  connections,
  onRefresh,
  onDelete,
}: {
  connections: McpConnection[];
  onRefresh: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  if (connections.length === 0) return null;

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 shadow-sm shadow-black/20 overflow-hidden">
      <div className="border-b border-white/5 px-6 py-4">
        <h3 className="text-sm font-semibold text-white/95">Connected MCPs</h3>
        <p className="text-xs text-white/50 mt-0.5">{connections.length} active connection{connections.length !== 1 ? 's' : ''}</p>
      </div>
      <div className="divide-y divide-white/5">
        {connections.map((conn) => (
          <div key={conn.id} className="flex items-center gap-4 px-6 py-3 hover:bg-white/5/50">
            <PlatformLogo logo={conn.catalog_id?.replace('_mcp', '') ?? ''} className="h-8 w-8 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-white/95 truncate">{conn.name}</p>
                {conn.status === 'connected' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/100/20 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/100/100" />
                    Connected
                  </span>
                )}
                {conn.status === 'stale' && <Badge text="Reconnect needed" variant="stale" />}
                {conn.status === 'failed' && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-400">Failed</span>
                )}
              </div>
              <p className="text-[10px] text-white/40 mt-0.5">
                {conn.tools.length} tools &middot; {conn.url}
                {conn.error && <span className="text-red-400 ml-2">{conn.error}</span>}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => onRefresh(conn.id)}
                className="rounded-lg p-2 text-white/40 hover:text-white/70 hover:bg-white/10 transition-colors"
                title={conn.status === 'stale' ? 'Reconnect' : 'Refresh tools'}
              >
                <RefreshCw className="h-4 w-4" />
              </button>
              <button
                onClick={() => onDelete(conn.id)}
                className="rounded-lg p-2 text-white/40 hover:text-red-400 hover:bg-red-500/100/10 transition-colors"
                title="Disconnect"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────

export function McpMarketplacePage() {
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [connections, setConnections] = useState<McpConnection[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<CatalogEntry | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const connectedIds = new Set(connections.filter((c) => c.status === 'connected').map((c) => c.catalog_id));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cat, conns] = await Promise.all([getCatalog(), listConnections()]);
      setCatalog(cat);
      setConnections(conns);
    } catch {
      // API may not be available
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleRefresh = async (id: string) => {
    try {
      await testConnection(id);
      void load();
    } catch {
      // ignore
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteConnection(id);
      setConnections((prev) => prev.filter((c) => c.id !== id));
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white/95">MCP Marketplace</h2>
        <p className="mt-1 text-sm text-white/50">
          Connect advertising platforms via MCP. Plinth manages the servers — you just provide your credentials.
        </p>
      </div>

      {/* Airbyte Agent Connectors Banner */}
      {!loading && <AirbyteBanner connections={connections} />}

      {/* Catalog Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white/95">Available Platforms</h3>
          <button
            onClick={() => setCustomOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/5 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Custom MCP
          </button>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="rounded-xl border border-white/10 p-5 animate-pulse">
                <div className="h-10 w-10 rounded-xl bg-white/10 mb-3" />
                <div className="h-4 w-24 bg-white/10 rounded mb-2" />
                <div className="h-3 w-full bg-white/5 rounded mb-1" />
                <div className="h-3 w-2/3 bg-white/5 rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {catalog.map((entry) => {
              const isConnected = connectedIds.has(entry.id);
              return (
                <div
                  key={entry.id}
                  className={`group rounded-xl border p-5 transition-all cursor-pointer ${
                    isConnected
                      ? 'border-emerald-500/30 bg-emerald-500/100/10'
                      : 'border-white/10 bg-white/5 hover:border-white/15 hover:shadow-md'
                  }`}
                  onClick={() => !isConnected && setSelectedEntry(entry)}
                >
                  {/* Logo + badges */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 border border-white/5">
                      <PlatformLogo logo={entry.logo} className="h-7 w-7" />
                    </div>
                    <div className="flex gap-1">
                      {entry.badge === 'Official' && <Badge text="Official" variant="official" />}
                      {entry.badge === 'Most Tools' && <Badge text="Most Tools" variant="tools" />}
                      {entry.badge === 'Ready Now' && <Badge text="Ready Now" variant="ready" />}
                      {isConnected && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/100/20 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/100/100" />
                          Connected
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Info */}
                  <h3 className="text-sm font-semibold text-white/95 mb-1">{entry.name}</h3>
                  <p className="text-xs text-white/50 leading-relaxed mb-3">{entry.description}</p>

                  {/* Tools count + source */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-white/40">{entry.tools_count} tools</span>
                    <div className="flex items-center gap-1">
                      {entry.repo && (
                        <a
                          href={entry.repo}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-white/40 hover:text-white/60 transition-colors"
                          title="View source"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      <span className="text-[10px] text-white/40 capitalize">{entry.source}</span>
                    </div>
                  </div>

                  {/* Connect button */}
                  {!isConnected && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedEntry(entry); }}
                      className="mt-3 w-full rounded-lg bg-[#00F5FF]/20 px-3 py-2 text-xs font-medium text-white hover:bg-[#00F5FF]/30 transition-colors"
                    >
                      Connect
                    </button>
                  )}
                </div>
              );
            })}

            {/* Add Custom MCP card */}
            <div
              className="group rounded-xl border-2 border-dashed border-white/10 p-5 flex flex-col items-center justify-center text-center cursor-pointer hover:border-white/15 hover:bg-white/5/50 transition-all min-h-[200px]"
              onClick={() => setCustomOpen(true)}
            >
              <Plus className="h-8 w-8 text-white/30 mb-2 group-hover:text-white/40 transition-colors" />
              <p className="text-sm font-medium text-white/50">Add Custom MCP</p>
              <p className="text-xs text-white/40 mt-1">Connect any MCP server by URL</p>
            </div>
          </div>
        )}
      </div>

      {/* Connected list */}
      <ConnectedList
        connections={connections}
        onRefresh={(id) => void handleRefresh(id)}
        onDelete={(id) => void handleDelete(id)}
      />

      {/* Catalog connection dialog */}
      {selectedEntry && (
        <CatalogConnectDialog
          entry={selectedEntry}
          open={!!selectedEntry}
          onOpenChange={(open) => { if (!open) setSelectedEntry(null); }}
          onConnected={() => void load()}
        />
      )}

      {/* Custom MCP dialog */}
      <CustomMcpDialog
        open={customOpen}
        onOpenChange={setCustomOpen}
        onConnected={() => void load()}
      />
    </div>
  );
}
