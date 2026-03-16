// @ts-nocheck
// ─── Integrations Page (Perplexity-style) ────────────────────────────
// Platform connectors with OAuth dialog + API credentials + MCP instructions

import { useState, useCallback, useEffect } from 'react';
import type { ConnectorPlatform, SyncInterval } from '@openagency/types';
import { useConnectorStore } from '../stores/connector-store';
import { isApiMode } from '../api/agency';
import {
  listConnectors,
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

// ─── Config ──────────────────────────────────────────────────────────

const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ||
  'https://polanyi-plinth-production.up.railway.app';

const MCP_URL = `${API_URL}/mcp`;

// ─── Platform Logos (inline SVG) ─────────────────────────────────────

function GoogleAdsLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M3.5 18.5l6-10.5 3 5.25-6 10.5z" fill="#FBBC04" />
      <path d="M14.5 3l6 10.5-3 5.25-6-10.5z" fill="#4285F4" />
      <circle cx="6.5" cy="19.5" r="2.5" fill="#34A853" />
    </svg>
  );
}

function DV360Logo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="2" width="20" height="20" rx="4" fill="#00897B" />
      <text x="12" y="16" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold" fontFamily="sans-serif">DV</text>
    </svg>
  );
}

function MetaLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z" fill="#1877F2" />
      <path d="M16.5 8.5c-1.5-1.5-3.5-.5-4.5 1l-1.5 2.5-1.5-2.5c-1-1.5-3-2.5-4.5-1C3 10 3.5 12 5 14l4 5.5c.5.7 1.5.7 2 0L15 14c1.5-2 2-4 1.5-5.5z" fill="white" />
    </svg>
  );
}

function TikTokLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="2" width="20" height="20" rx="4" fill="#010101" />
      <path d="M16.5 7.5c-1-.8-1.7-2-1.8-3.5h-2.5v10.5c0 1.4-1.1 2.5-2.5 2.5s-2.5-1.1-2.5-2.5 1.1-2.5 2.5-2.5c.3 0 .5 0 .8.1V9.5c-.3 0-.5-.1-.8-.1C7 9.4 5 11.4 5 14s2 4.6 4.5 4.6c2.8 0 4.7-2 4.7-4.6V10c1 .7 2.2 1.2 3.5 1.2V8.8c-.5 0-1-.5-1.2-1.3z" fill="white" />
    </svg>
  );
}

function TikTokShopLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="2" width="20" height="20" rx="4" fill="#FF2D55" />
      <path d="M8 8h8l-1 6H9L8 8z" stroke="white" strokeWidth="1.5" fill="none" />
      <circle cx="10" cy="17" r="1" fill="white" />
      <circle cx="15" cy="17" r="1" fill="white" />
      <path d="M10 8V6" stroke="white" strokeWidth="1.5" />
      <path d="M14 8V6" stroke="white" strokeWidth="1.5" />
    </svg>
  );
}

function AmazonAdsLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="2" width="20" height="20" rx="4" fill="#FF9900" />
      <path d="M7 14c2.5 1.5 5.5 1.5 8 0" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <text x="12" y="12" textAnchor="middle" fill="white" fontSize="7" fontWeight="bold" fontFamily="sans-serif">a</text>
    </svg>
  );
}

// ─── Platform Config ─────────────────────────────────────────────────

interface PlatformCardConfig {
  platform: ConnectorPlatform;
  name: string;
  description: string;
  Logo: React.ComponentType<{ className?: string }>;
  scopes: string;
}

const PLATFORMS: PlatformCardConfig[] = [
  {
    platform: 'google_ads',
    name: 'Google Ads',
    description: 'Search, Display, Shopping, and YouTube campaigns',
    Logo: GoogleAdsLogo,
    scopes: 'Campaign performance, ad groups, keywords, and conversion data',
  },
  {
    platform: 'dv360',
    name: 'Display & Video 360',
    description: 'Programmatic display, video, and audio campaigns',
    Logo: DV360Logo,
    scopes: 'Insertion orders, line items, creatives, and audience data',
  },
  {
    platform: 'meta_ads',
    name: 'Meta Ads',
    description: 'Facebook and Instagram campaigns and insights',
    Logo: MetaLogo,
    scopes: 'Ad accounts, campaigns, ad sets, ads, and performance insights',
  },
  {
    platform: 'tiktok_ads',
    name: 'TikTok Ads',
    description: 'In-feed, TopView, and Spark Ads campaigns',
    Logo: TikTokLogo,
    scopes: 'Campaign data, ad groups, creatives, and audience reports',
  },
  {
    platform: 'tiktok_shop',
    name: 'TikTok Shop',
    description: 'Shop orders, product performance, and sales data',
    Logo: TikTokShopLogo,
    scopes: 'Product catalog, orders, GMV, and shop analytics',
  },
  {
    platform: 'amazon_ads',
    name: 'Amazon Ads',
    description: 'Sponsored Products, Brands, and Display campaigns',
    Logo: AmazonAdsLogo,
    scopes: 'Campaign metrics, keyword bids, ACOS, and attribution data',
  },
];

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

// ─── API Credentials Section ─────────────────────────────────────────

interface ApiKey {
  id: string;
  key: string;
  name?: string;
  created_at?: string;
}

function CredentialsSection() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showKey, setShowKey] = useState<string | null>(null);

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
    } catch {
      // API not available
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadKeys(); }, [loadKeys]);

  const handleGenerate = async () => {
    const token = localStorage.getItem('plinth_token');
    if (!token) return;
    setGenerating(true);
    try {
      const res = await fetch(`${API_URL}/v1/auth/api-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: 'Default key' }),
      });
      if (res.ok) {
        await loadKeys();
      }
    } catch {
      // ignore
    } finally {
      setGenerating(false);
    }
  };

  const firstKey = apiKeys[0];
  const maskedKey = firstKey
    ? `${firstKey.key.slice(0, 8)}${'•'.repeat(24)}${firstKey.key.slice(-6)}`
    : null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-6 py-4">
        <h3 className="text-sm font-semibold text-gray-900">API Credentials</h3>
        <p className="mt-0.5 text-xs text-gray-500">Use these to authenticate requests to the Plinth API and MCP server.</p>
      </div>
      <div className="divide-y divide-gray-50 p-6 space-y-4">
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
                  {showKey === firstKey.id ? firstKey.key : maskedKey}
                </code>
                <button
                  onClick={() => setShowKey(showKey === firstKey.id ? null : firstKey.id)}
                  className="text-xs text-gray-400 hover:text-gray-600 shrink-0"
                >
                  {showKey === firstKey.id ? 'Hide' : 'Reveal'}
                </button>
              </div>
              <CopyButton text={firstKey.key} />
            </div>
          ) : (
            <p className="text-xs text-gray-400 italic">No API key yet. Generate one above.</p>
          )}
        </div>

        <div className="pt-4">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">MCP Server URL</label>
          <div className="flex items-center gap-2">
            <div className="flex flex-1 items-center rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <code className="flex-1 font-mono text-xs text-gray-700">{MCP_URL}</code>
            </div>
            <CopyButton text={MCP_URL} />
          </div>
          <p className="mt-1 text-xs text-gray-400">Streamable HTTP transport — compatible with Claude Desktop, Cursor, and any MCP client.</p>
        </div>

        <div className="pt-4">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">REST API Base URL</label>
          <div className="flex items-center gap-2">
            <div className="flex flex-1 items-center rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <code className="flex-1 font-mono text-xs text-gray-700">{API_URL}</code>
            </div>
            <CopyButton text={API_URL} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MCP Connection Instructions ────────────────────────────────────

type McpTab = 'claude' | 'cursor' | 'http';

const MCP_TABS: { id: McpTab; label: string; icon: string }[] = [
  { id: 'claude', label: 'Claude Desktop', icon: '>' },
  { id: 'cursor', label: 'Cursor / VS Code', icon: '#' },
  { id: 'http', label: 'HTTP / Custom Agent', icon: '$' },
];

function McpInstructionsSection() {
  const [activeTab, setActiveTab] = useState<McpTab>('claude');

  const claudeConfig = `{
  "mcpServers": {
    "plinth": {
      "url": "${MCP_URL}",
      "headers": {
        "X-API-Key": "YOUR_API_KEY"
      }
    }
  }
}`;

  const cursorConfig = `{
  "mcpServers": {
    "plinth": {
      "url": "${MCP_URL}",
      "headers": {
        "X-API-Key": "YOUR_API_KEY"
      }
    }
  }
}`;

  const httpExample = `# List all available MCP tools (29 skills + agents)
curl -X POST ${MCP_URL} \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'

# Run waste waterfall analysis
curl -X POST ${MCP_URL} \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -d '{
    "jsonrpc":"2.0","method":"tools/call","id":2,
    "params":{
      "name":"leak-detector__waste-waterfall",
      "arguments":{
        "gross_spend":1000000,
        "channels":[
          {"name":"Search","spend":400000},
          {"name":"Social","spend":350000},
          {"name":"Display","spend":250000}
        ]
      }
    }
  }'`;

  const content: Record<McpTab, { title: string; file?: string; code: string; hint: string }> = {
    claude: {
      title: 'Claude Desktop config',
      file: '~/.config/claude/claude_desktop_config.json',
      code: claudeConfig,
      hint: 'Restart Claude Desktop after saving. All 63 Plinth tools will appear in the tool picker.',
    },
    cursor: {
      title: 'Cursor / VS Code MCP config',
      file: '.cursor/mcp.json  (project root) or ~/.cursor/mcp.json (global)',
      code: cursorConfig,
      hint: 'Reload your Cursor window after saving. Plinth tools appear in Composer with CMD+K.',
    },
    http: {
      title: 'Direct HTTP calls',
      code: httpExample,
      hint: 'No SDK needed. The MCP server speaks JSON-RPC 2.0 over HTTP POST. Tools are namespaced as engine__skill.',
    },
  };

  const c = content[activeTab];

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-6 py-4">
        <h3 className="text-sm font-semibold text-gray-900">Connect your MCP client</h3>
        <p className="mt-0.5 text-xs text-gray-500">
          Plinth exposes 63 tools via the Model Context Protocol — 29 skills + agent controls + connectors.
        </p>
      </div>

      <div className="flex gap-1 border-b border-gray-100 px-4 pt-3 pb-0">
        {MCP_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 rounded-t-lg px-4 py-2 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-white border border-b-white border-gray-200 text-gray-900 -mb-px'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="font-mono text-[10px]">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-gray-700">{c.title}</span>
          {c.file && (
            <code className="rounded bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500">{c.file}</code>
          )}
        </div>
        <div className="relative rounded-xl bg-gray-900 p-4">
          <pre className="overflow-x-auto text-[11px] leading-relaxed text-green-300 font-mono whitespace-pre">
            {c.code}
          </pre>
          <div className="absolute right-3 top-3">
            <CopyButton text={c.code} label="Copy" />
          </div>
        </div>
        <p className="mt-3 text-xs text-gray-500">{c.hint}</p>
      </div>
    </div>
  );
}

// ─── Connection Dialog ───────────────────────────────────────────────

function ConnectDialog({
  config,
  open,
  onOpenChange,
  onConnected,
}: {
  config: PlatformCardConfig;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected: () => void;
}) {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
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
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setConnecting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <config.Logo className="h-10 w-10" />
            <div>
              <DialogTitle>Connect {config.name}</DialogTitle>
              <DialogDescription>{config.description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-xs font-semibold text-gray-700 mb-2">Data access</p>
            <p className="text-xs text-gray-500">{config.scopes}</p>
          </div>

          <div className="rounded-lg bg-blue-50 border border-blue-100 p-4">
            <p className="text-xs text-blue-700">
              You will be redirected to {config.name}'s authorization page.
              Plinth will only request read access to your campaign data. Tokens are encrypted and stored server-side.
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
          <button
            onClick={() => void handleConnect()}
            disabled={connecting}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {connecting ? 'Connecting...' : `Connect with ${config.name}`}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Platform Connector Card (Perplexity-style) ──────────────────────

function PlatformCard({ config, apiMode }: { config: PlatformCardConfig; apiMode: boolean }) {
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
      } else {
        await new Promise((r) => setTimeout(r, 2000));
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
        className={`flex items-center gap-4 rounded-xl border p-4 transition-all hover:shadow-md cursor-pointer ${
          isConnected
            ? 'border-green-200 bg-green-50/30'
            : hasError
              ? 'border-red-200 bg-red-50/30'
              : 'border-gray-200 bg-white hover:border-gray-300'
        }`}
        onClick={() => !isConnected && setDialogOpen(true)}
      >
        {/* Logo */}
        <config.Logo className="h-10 w-10 shrink-0" />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900">{config.name}</h3>
            {isConnected && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                Connected
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{config.description}</p>

          {platformState?.lastSync && (
            <p className="text-[10px] text-gray-400 mt-1">
              Last sync: {new Date(platformState.lastSync.synced_at).toLocaleString()} ({platformState.lastSync.row_count} rows)
            </p>
          )}
          {syncError && <p className="text-[10px] text-red-500 mt-1">{syncError}</p>}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          {isConnected ? (
            <>
              <select
                value={platformState?.syncInterval ?? '1h'}
                onChange={(e) => setSyncInterval(config.platform, e.target.value as SyncInterval)}
                className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-[11px] text-gray-600"
              >
                {SYNC_INTERVALS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <button
                onClick={() => void handleSync()}
                disabled={syncing}
                className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {syncing ? 'Syncing...' : 'Sync'}
              </button>
              <button
                onClick={() => void handleDisconnect()}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-red-500 hover:border-red-200 transition-colors"
              >
                Disconnect
              </button>
            </>
          ) : (
            <button
              onClick={() => setDialogOpen(true)}
              className="rounded-lg bg-gray-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-gray-800 transition-colors"
            >
              Connect
            </button>
          )}
        </div>
      </div>

      <ConnectDialog
        config={config}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onConnected={handleConnected}
      />
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────

export function IntegrationsPage() {
  const setStatus = useConnectorStore((s) => s.setStatus);
  const apiMode = isApiMode();

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
        <h2 className="text-2xl font-bold text-gray-900">Integrations</h2>
        <p className="mt-1 text-sm text-gray-500">
          Connect your advertising platforms, configure API access, and set up MCP clients.
        </p>
      </div>

      {/* Ad Platform Connectors — now first */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Platform Connectors</h3>
          {connectedCount > 0 && (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
              {connectedCount} connected
            </span>
          )}
        </div>
        <div className="space-y-3">
          {PLATFORMS.map((config) => (
            <PlatformCard key={config.platform} config={config} apiMode={apiMode} />
          ))}
        </div>
        <p className="mt-3 text-xs text-gray-400">
          Connections use OAuth 2.0. Tokens are encrypted and stored server-side.
        </p>
      </div>

      {/* Credentials */}
      <CredentialsSection />

      {/* MCP connection instructions */}
      <McpInstructionsSection />
    </div>
  );
}
