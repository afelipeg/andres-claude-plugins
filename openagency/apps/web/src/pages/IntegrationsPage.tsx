// @ts-nocheck
// ─── Apps & MCP Page (Perplexity-style grid) ─────────────────────────
// 3-column grid of platform connectors + MCP/API credentials below

import { useState, useCallback, useEffect } from 'react';
import type { ConnectorPlatform, SyncInterval } from '@openagency/types';
import { useConnectorStore } from '../stores/connector-store';
import { isApiMode } from '../api/agency';
import {
  listConnectors,
  connectPlatform,
  disconnectPlatform,
  syncPlatform,
  getAuthUrl,
  exchangeOAuthCode,
  openOAuthPopup,
} from '../api/connectors';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../components/ui/dialog';
import { PLATFORMS, type PlatformConfig } from '../components/platform-logos';

// ─── Config ──────────────────────────────────────────────────────────

const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ||
  'https://polanyi-plinth-production.up.railway.app';

const MCP_URL = `${API_URL}/mcp`;

const SYNC_INTERVALS: { value: SyncInterval; label: string }[] = [
  { value: '15m', label: 'Every 15 min' },
  { value: '1h', label: 'Hourly' },
  { value: '6h', label: 'Every 6 hours' },
  { value: '24h', label: 'Daily' },
  { value: 'manual', label: 'Manual only' },
];

// ─── Copy Button ──────────────────────────────────────────────────────

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={() => void handleCopy()}
      className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
    >
      {copied ? (
        <>
          <svg className="h-3.5 w-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          {label}
        </>
      )}
    </button>
  );
}

// ─── Connection Dialog (OAuth-first + API key fallback) ──────────────

function ConnectDialog({
  config,
  open,
  onOpenChange,
  onConnected,
  apiMode,
}: {
  config: PlatformConfig;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected: () => void;
  apiMode: boolean;
}) {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKey, setApiKey] = useState('');

  const handleOAuth = async () => {
    setConnecting(true);
    setError(null);
    try {
      const redirectUri = `${window.location.origin}/auth/callback`;
      const { auth_url } = await getAuthUrl(config.platform, redirectUri, config.platform);
      const { code } = await openOAuthPopup(auth_url);
      await exchangeOAuthCode(config.platform, code, redirectUri);
      onConnected();
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      // If OAuth isn't configured on server, fallback to API key input
      if (msg.includes('401') || msg.includes('not configured') || msg.includes('not found')) {
        setShowApiKey(true);
        setError('OAuth not configured for this platform yet. Use an API key instead.');
      } else {
        setError(msg);
      }
    } finally {
      setConnecting(false);
    }
  };

  const handleApiKey = async () => {
    if (!apiKey.trim()) return;
    setConnecting(true);
    setError(null);
    try {
      if (apiMode) {
        await connectPlatform(config.platform, { access_token: apiKey.trim() });
      }
      onConnected();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setConnecting(false);
    }
  };

  const supportsOAuth = config.authMethod === 'oauth' || config.authMethod === 'both';
  const supportsApiKey = config.authMethod === 'api_key' || config.authMethod === 'both';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-50 border border-gray-100">
              <config.Logo className="h-8 w-8" />
            </div>
            <div>
              <DialogTitle>Connect {config.name}</DialogTitle>
              <DialogDescription>{config.description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Data access info */}
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-xs font-semibold text-gray-700 mb-1">Data access</p>
            <p className="text-xs text-gray-500">{config.scopes}</p>
          </div>

          {/* OAuth option */}
          {supportsOAuth && (
            <button
              onClick={() => void handleOAuth()}
              disabled={connecting}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-3 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              {connecting && !showApiKey ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Connecting...
                </>
              ) : (
                <>
                  <config.Logo className="h-5 w-5" />
                  Connect with {config.name}
                </>
              )}
            </button>
          )}

          {/* API key fallback */}
          {supportsApiKey && supportsOAuth && (
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs">
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="bg-white px-3 text-gray-500 hover:text-gray-700 transition-colors"
                >
                  {showApiKey ? 'Hide API key option' : 'Or use API key'}
                </button>
              </div>
            </div>
          )}

          {(showApiKey || (supportsApiKey && !supportsOAuth)) && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  API Key
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={`Enter your ${config.name} API key`}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
                <p className="mt-1 text-[10px] text-gray-400">
                  Your API key is encrypted and stored securely on our servers.
                </p>
              </div>
              <button
                onClick={() => void handleApiKey()}
                disabled={connecting || !apiKey.trim()}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {connecting && showApiKey ? 'Saving...' : 'Save API Key'}
              </button>
            </div>
          )}

          {/* Security note */}
          <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
            <p className="text-[11px] text-blue-700 leading-relaxed">
              {supportsOAuth
                ? `You'll be redirected to ${config.name}'s authorization page. Plinth requests read-only access. Tokens are encrypted server-side.`
                : 'Your credentials are encrypted and stored securely. Plinth requests read-only access to your campaign data.'}
            </p>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-100 p-3">
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Platform Card (Perplexity grid style) ───────────────────────────

function PlatformCard({ config, apiMode }: { config: PlatformConfig; apiMode: boolean }) {
  const platformState = useConnectorStore((s) => s.getPlatform(config.platform));
  const connect = useConnectorStore((s) => s.connect);
  const disconnect = useConnectorStore((s) => s.disconnect);
  const setSyncInterval = useConnectorStore((s) => s.setSyncInterval);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const isConnected = platformState?.status === 'connected';
  const hasError = platformState?.status === 'error';

  const handleConnected = () => {
    connect(config.platform);
  };

  const handleDisconnect = useCallback(async () => {
    try {
      if (apiMode) await disconnectPlatform(config.platform);
      disconnect(config.platform);
    } catch {
      disconnect(config.platform);
    }
  }, [config.platform, disconnect, apiMode]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      if (apiMode) {
        const result = await syncPlatform(config.platform);
        if (result.error) setSyncError(result.error);
      }
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }, [config.platform, apiMode]);

  return (
    <>
      <div
        className={`group rounded-xl border p-5 transition-all cursor-pointer ${
          isConnected
            ? 'border-green-200 bg-green-50/40 hover:shadow-md'
            : hasError
              ? 'border-red-200 bg-red-50/30'
              : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
        }`}
        onClick={() => !isConnected && setDialogOpen(true)}
      >
        {/* Logo + status */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-50 border border-gray-100 group-hover:border-gray-200 transition-colors">
            <config.Logo className="h-7 w-7" />
          </div>
          {isConnected && (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              Connected
            </span>
          )}
        </div>

        {/* Name + description */}
        <h3 className="text-sm font-semibold text-gray-900 mb-1">{config.name}</h3>
        <p className="text-xs text-gray-500 leading-relaxed mb-3">{config.description}</p>

        {/* Connected state: sync info + actions */}
        {isConnected ? (
          <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
            {platformState?.lastSync && (
              <p className="text-[10px] text-gray-400">
                Last sync: {new Date(platformState.lastSync.synced_at).toLocaleString()}
              </p>
            )}
            {syncError && <p className="text-[10px] text-red-500">{syncError}</p>}
            <div className="flex items-center gap-2">
              <select
                value={platformState?.syncInterval ?? '1h'}
                onChange={(e) => setSyncInterval(config.platform, e.target.value as SyncInterval)}
                className="flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-[11px] text-gray-600"
              >
                {SYNC_INTERVALS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <button
                onClick={() => void handleSync()}
                disabled={syncing}
                className="rounded-lg bg-gray-900 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {syncing ? 'Syncing...' : 'Sync'}
              </button>
            </div>
            <button
              onClick={() => void handleDisconnect()}
              className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-[11px] font-medium text-gray-500 hover:text-red-500 hover:border-red-200 transition-colors"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); setDialogOpen(true); }}
            className="w-full rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white hover:bg-gray-800 transition-colors"
          >
            Connect
          </button>
        )}
      </div>

      <ConnectDialog
        config={config}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onConnected={handleConnected}
        apiMode={apiMode}
      />
    </>
  );
}

// ─── MCP & API Credentials (collapsible) ─────────────────────────────

interface ApiKey {
  id: string;
  key: string;
  name?: string;
  created_at?: string;
}

function McpApiSection() {
  const [expanded, setExpanded] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showKey, setShowKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'claude' | 'cursor' | 'http'>('claude');

  const loadKeys = useCallback(async () => {
    const token = localStorage.getItem('plinth_token');
    if (!token) { setLoading(false); return; }
    try {
      const res = await fetch(`${API_URL}/v1/auth/api-keys`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setApiKeys(Array.isArray(data) ? data : (data.keys ?? data.api_keys ?? []));
      }
    } catch { /* API not available */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadKeys(); }, [loadKeys]);

  const handleGenerate = async () => {
    const token = localStorage.getItem('plinth_token');
    if (!token) return;
    setGenerating(true);
    try {
      const res = await fetch(`${API_URL}/v1/auth/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: 'Default key' }),
      });
      if (res.ok) await loadKeys();
    } catch { /* ignore */ } finally { setGenerating(false); }
  };

  const firstKey = apiKeys[0];
  const keyStr = firstKey?.key ?? '';
  const maskedKey = keyStr.length >= 14
    ? `${keyStr.slice(0, 8)}${'*'.repeat(24)}${keyStr.slice(-6)}`
    : keyStr || null;

  const mcpConfig = (client: string) => `{
  "mcpServers": {
    "plinth": {
      "url": "${MCP_URL}",
      "headers": {
        "X-API-Key": "YOUR_API_KEY"
      }
    }
  }
}`;

  const httpExample = `curl -X POST ${MCP_URL} \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'`;

  const tabs = [
    { id: 'claude' as const, label: 'Claude Desktop', file: '~/.config/claude/claude_desktop_config.json' },
    { id: 'cursor' as const, label: 'Cursor / VS Code', file: '.cursor/mcp.json' },
    { id: 'http' as const, label: 'HTTP / Agent', file: undefined },
  ];

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-gray-50/50 transition-colors"
      >
        <div>
          <h3 className="text-sm font-semibold text-gray-900">MCP & API Credentials</h3>
          <p className="mt-0.5 text-xs text-gray-500">Configure MCP clients, API keys, and REST endpoints.</p>
        </div>
        <svg
          className={`h-5 w-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 p-6 space-y-6">
          {/* API Key */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">API Key</label>
              {!loading && !firstKey && (
                <button
                  onClick={() => void handleGenerate()}
                  disabled={generating}
                  className="rounded-md bg-gray-900 px-3 py-1 text-xs font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  {generating ? 'Generating...' : 'Generate Key'}
                </button>
              )}
            </div>
            {loading ? (
              <div className="h-9 animate-pulse rounded-lg bg-gray-100" />
            ) : firstKey ? (
              <div className="flex items-center gap-2">
                <div className="flex flex-1 items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                  <code className="flex-1 font-mono text-xs text-gray-700 truncate">
                    {showKey === firstKey.id ? keyStr : maskedKey}
                  </code>
                  <button
                    onClick={() => setShowKey(showKey === firstKey.id ? null : firstKey.id)}
                    className="text-xs text-gray-400 hover:text-gray-600 shrink-0"
                  >
                    {showKey === firstKey.id ? 'Hide' : 'Reveal'}
                  </button>
                </div>
                <CopyButton text={keyStr} />
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">No API key yet. Generate one above.</p>
            )}
          </div>

          {/* URLs */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">MCP Server</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-xs text-gray-700 truncate">{MCP_URL}</code>
                <CopyButton text={MCP_URL} />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-500">REST API</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-xs text-gray-700 truncate">{API_URL}</code>
                <CopyButton text={API_URL} />
              </div>
            </div>
          </div>

          {/* MCP Config Tabs */}
          <div>
            <h4 className="text-xs font-semibold text-gray-700 mb-3">Connect your MCP client</h4>
            <div className="flex gap-1 border-b border-gray-100 pb-0">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-t-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-white border border-b-white border-gray-200 text-gray-900 -mb-px'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="relative mt-3 rounded-xl bg-gray-900 p-4">
              <pre className="overflow-x-auto text-[11px] leading-relaxed text-green-300 font-mono whitespace-pre">
                {activeTab === 'http' ? httpExample : mcpConfig(activeTab)}
              </pre>
              <div className="absolute right-3 top-3">
                <CopyButton text={activeTab === 'http' ? httpExample : mcpConfig(activeTab)} />
              </div>
            </div>
            {tabs.find((t) => t.id === activeTab)?.file && (
              <code className="mt-2 block rounded bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500 w-fit">
                {tabs.find((t) => t.id === activeTab)?.file}
              </code>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────

export function IntegrationsPage() {
  const setStatus = useConnectorStore((s) => s.setStatus);
  const apiMode = isApiMode();

  // Re-hydrate connector state from backend on mount
  useEffect(() => {
    if (!apiMode) return;
    void listConnectors()
      .then((connectors) => {
        for (const conn of connectors) {
          if (conn.connected) setStatus(conn.platform as ConnectorPlatform, 'connected');
        }
      })
      .catch(() => {});
  }, [apiMode, setStatus]);

  const connectedCount = useConnectorStore((s) => {
    let count = 0;
    for (const p of PLATFORMS) {
      if (s.getPlatform(p.platform)?.status === 'connected') count++;
    }
    return count;
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Apps & MCP</h2>
        <p className="mt-1 text-sm text-gray-500">
          Connect your advertising platforms and configure API access for MCP clients.
        </p>
      </div>

      {/* Platform Connectors Grid (Perplexity-style) */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Platform Connectors</h3>
          {connectedCount > 0 && (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
              {connectedCount} connected
            </span>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PLATFORMS.map((config) => (
            <PlatformCard key={config.platform} config={config} apiMode={apiMode} />
          ))}
        </div>
      </div>

      {/* MCP & API Credentials (collapsible) */}
      <McpApiSection />
    </div>
  );
}
