// ─── MCP Marketplace Page ────────────────────────────────────────────
// Catalog grid + custom MCP connection + connected list

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Trash2, Plus, ExternalLink, Server, Zap } from 'lucide-react';
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
    <div className={`flex items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 text-xs font-bold ${className}`}>
      MCP
    </div>
  );
}

// ─── Badge Component ─────────────────────────────────────────────────

function Badge({ text, variant }: { text: string; variant: 'official' | 'tools' | 'ready' | 'stale' }) {
  const styles = {
    official: 'bg-blue-100 text-blue-700',
    tools: 'bg-purple-100 text-purple-700',
    ready: 'bg-green-100 text-green-700',
    stale: 'bg-amber-100 text-amber-700',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${styles[variant]}`}>
      {text}
    </span>
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
  const baseClass = 'w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400';

  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1.5">
        {field.label}
        {field.required === false && <span className="text-gray-400 ml-1">(optional)</span>}
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
      <p className="mt-1 text-[10px] text-gray-400">{field.help}</p>
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
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-50 border border-gray-100">
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
            <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-center">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                <Zap className="h-5 w-5 text-green-600" />
              </div>
              <p className="text-sm font-medium text-green-800">Connected successfully!</p>
              <p className="text-xs text-green-600 mt-1">{result.tools_discovered} tools discovered</p>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Managed badge */}
            {!entry.hosted && (
              <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-3 flex items-center gap-2">
                <Server className="h-4 w-4 text-zinc-500 shrink-0" />
                <p className="text-[11px] text-zinc-600">Plinth manages the server for you. Just enter your credentials.</p>
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

            {/* Tools preview */}
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                {entry.tools_count} tools available
              </p>
              <div className="flex flex-wrap gap-1">
                {entry.tools_preview.map((t) => (
                  <span key={t} className="rounded bg-white border border-gray-200 px-1.5 py-0.5 text-[10px] font-mono text-gray-600">{t}</span>
                ))}
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-100 p-3">
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}

            <DialogFooter>
              <button
                onClick={() => onOpenChange(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleConnect()}
                disabled={connecting || !hasRequiredFields}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 flex items-center gap-2"
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
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Custom MCP"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">MCP Server URL</label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-mcp-server.com/mcp"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-mono focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Auth Token (optional)</label>
            <input
              type="password"
              value={authToken}
              onChange={(e) => setAuthToken(e.target.value)}
              placeholder="Bearer token or API key"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-100 p-3">
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <button onClick={() => onOpenChange(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => void handleConnect()}
            disabled={connecting || !url.trim()}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
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
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-gray-100 px-6 py-4">
        <h3 className="text-sm font-semibold text-gray-900">Connected MCPs</h3>
        <p className="text-xs text-gray-500 mt-0.5">{connections.length} active connection{connections.length !== 1 ? 's' : ''}</p>
      </div>
      <div className="divide-y divide-gray-50">
        {connections.map((conn) => (
          <div key={conn.id} className="flex items-center gap-4 px-6 py-3 hover:bg-gray-50/50">
            <PlatformLogo logo={conn.catalog_id?.replace('_mcp', '') ?? ''} className="h-8 w-8 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-900 truncate">{conn.name}</p>
                {conn.status === 'connected' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    Connected
                  </span>
                )}
                {conn.status === 'stale' && <Badge text="Reconnect needed" variant="stale" />}
                {conn.status === 'failed' && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">Failed</span>
                )}
              </div>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {conn.tools.length} tools &middot; {conn.url}
                {conn.error && <span className="text-red-400 ml-2">{conn.error}</span>}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => onRefresh(conn.id)}
                className="rounded-lg p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                title={conn.status === 'stale' ? 'Reconnect' : 'Refresh tools'}
              >
                <RefreshCw className="h-4 w-4" />
              </button>
              <button
                onClick={() => onDelete(conn.id)}
                className="rounded-lg p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
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
        <h2 className="text-2xl font-bold text-gray-900">MCP Marketplace</h2>
        <p className="mt-1 text-sm text-gray-500">
          Connect advertising platforms via MCP. Plinth manages the servers — you just provide your credentials.
        </p>
      </div>

      {/* Catalog Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Available Platforms</h3>
          <button
            onClick={() => setCustomOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Custom MCP
          </button>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="rounded-xl border border-gray-200 p-5 animate-pulse">
                <div className="h-10 w-10 rounded-xl bg-gray-100 mb-3" />
                <div className="h-4 w-24 bg-gray-100 rounded mb-2" />
                <div className="h-3 w-full bg-gray-50 rounded mb-1" />
                <div className="h-3 w-2/3 bg-gray-50 rounded" />
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
                      ? 'border-green-200 bg-green-50/40'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
                  }`}
                  onClick={() => !isConnected && setSelectedEntry(entry)}
                >
                  {/* Logo + badges */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-50 border border-gray-100">
                      <PlatformLogo logo={entry.logo} className="h-7 w-7" />
                    </div>
                    <div className="flex gap-1">
                      {entry.badge === 'Official' && <Badge text="Official" variant="official" />}
                      {entry.badge === 'Most Tools' && <Badge text="Most Tools" variant="tools" />}
                      {entry.badge === 'Ready Now' && <Badge text="Ready Now" variant="ready" />}
                      {isConnected && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                          Connected
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Info */}
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">{entry.name}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed mb-3">{entry.description}</p>

                  {/* Tools count + source */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-400">{entry.tools_count} tools</span>
                    <div className="flex items-center gap-1">
                      {entry.repo && (
                        <a
                          href={entry.repo}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                          title="View source"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      <span className="text-[10px] text-gray-400 capitalize">{entry.source}</span>
                    </div>
                  </div>

                  {/* Connect button */}
                  {!isConnected && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedEntry(entry); }}
                      className="mt-3 w-full rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white hover:bg-gray-800 transition-colors"
                    >
                      Connect
                    </button>
                  )}
                </div>
              );
            })}

            {/* Add Custom MCP card */}
            <div
              className="group rounded-xl border-2 border-dashed border-gray-200 p-5 flex flex-col items-center justify-center text-center cursor-pointer hover:border-gray-300 hover:bg-gray-50/50 transition-all min-h-[200px]"
              onClick={() => setCustomOpen(true)}
            >
              <Plus className="h-8 w-8 text-gray-300 mb-2 group-hover:text-gray-400 transition-colors" />
              <p className="text-sm font-medium text-gray-500">Add Custom MCP</p>
              <p className="text-xs text-gray-400 mt-1">Connect any MCP server by URL</p>
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
