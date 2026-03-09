// @ts-nocheck
// ─── Integrations & API Access Page ─────────────────────────────────
// Stripe-style API credentials + MCP connection instructions + platform connectors

import { useState, useCallback, useEffect } from 'react';
import type { ConnectorPlatform, SyncInterval } from '@openagency/types';
import { useConnectorStore } from '../stores/connector-store';
import { isApiMode } from '../api/agency';
import {
  listConnectors,
  connectPlatform,
  disconnectPlatform,
  syncPlatform,
} from '../api/connectors';
import HowItWorks from '../components/landing/HowItWorks';

// ─── Config ──────────────────────────────────────────────────────────

const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ||
  'https://polanyi-plinth-production.up.railway.app';

const MCP_URL = `${API_URL}/mcp`;

// ─── Platform Connector Config ───────────────────────────────────────

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
    platform: 'meta_ads',
    name: 'Meta Ads',
    description: 'Facebook + Instagram campaigns, ad sets, and insights',
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-100',
    icon: 'M',
    envVars: ['META_APP_ID', 'META_APP_SECRET'],
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
                {generating ? 'Generating…' : 'Generate Key'}
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

        {/* MCP Server URL */}
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

        {/* REST API URL */}
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
  { id: 'claude', label: 'Claude Desktop', icon: '🤖' },
  { id: 'cursor', label: 'Cursor / VS Code', icon: '⌨️' },
  { id: 'http', label: 'HTTP / Custom Agent', icon: '⚡' },
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
      hint: 'Reload your Cursor window after saving. Plinth tools appear in Composer with ⌘K.',
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

      {/* Tabs */}
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
            <span>{tab.icon}</span>
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

// ─── Platform Connector Card ─────────────────────────────────────────

function PlatformCard({ config, apiMode }: { config: PlatformCardConfig; apiMode: boolean }) {
  const platformState = useConnectorStore((s) => s.getPlatform(config.platform));
  const connect = useConnectorStore((s) => s.connect);
  const disconnect = useConnectorStore((s) => s.disconnect);
  const setSyncInterval = useConnectorStore((s) => s.setSyncInterval);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const isConnected = platformState?.status === 'connected';
  const hasError = platformState?.status === 'error';

  const handleConnect = useCallback(async () => {
    setConnecting(true);
    setSyncError(null);
    try {
      if (apiMode) {
        await connectPlatform(config.platform, { access_token: 'mvp_placeholder_token' });
      }
      connect(config.platform);
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setConnecting(false);
    }
  }, [config.platform, connect, apiMode]);

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
    <div className={`rounded-xl border p-5 transition-shadow hover:shadow-md ${
      isConnected ? 'border-green-200 bg-green-50/30' : hasError ? 'border-red-200 bg-red-50/30' : 'border-gray-200 bg-white'
    }`}>
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold ${config.bgColor} ${config.color}`}>
          {config.icon}
        </span>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-gray-900">{config.name}</h3>
          <p className="text-xs text-gray-500">{config.description}</p>
        </div>
        {isConnected && (
          <div className="h-2 w-2 rounded-full bg-green-500" title="Connected" />
        )}
      </div>

      {platformState?.lastSync && (
        <p className="mt-2 text-xs text-gray-400">
          Last sync: {new Date(platformState.lastSync.synced_at).toLocaleString()} ({platformState.lastSync.row_count} rows)
        </p>
      )}
      {syncError && <p className="mt-2 text-xs text-red-600">{syncError}</p>}

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

      <div className="mt-4 flex gap-2">
        {isConnected ? (
          <>
            <button
              onClick={() => void handleSync()}
              disabled={syncing}
              className="flex-1 rounded-lg bg-brand-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
            >
              {syncing ? 'Syncing...' : 'Sync Now'}
            </button>
            <button
              onClick={() => void handleDisconnect()}
              className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              Disconnect
            </button>
          </>
        ) : (
          <button
            onClick={() => void handleConnect()}
            disabled={connecting}
            className="flex-1 rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
          >
            {connecting ? 'Connecting...' : 'Connect'}
          </button>
        )}
      </div>
    </div>
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Integrations & API Access</h2>
        <p className="mt-1 text-sm text-gray-500">
          Your API credentials, MCP connection details, and ad platform connectors.
        </p>
      </div>

      {/* Credentials */}
      <CredentialsSection />

      {/* MCP connection instructions */}
      <McpInstructionsSection />

      {/* Ad Platform Connectors */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">Ad Platform Connectors</h3>
        <p className="text-sm text-gray-500 mb-4">
          Connect your advertising platforms to pull live campaign data into the engines.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PLATFORMS.map((config) => (
            <PlatformCard key={config.platform} config={config} apiMode={apiMode} />
          ))}
        </div>
        <p className="mt-3 text-xs text-gray-400">
          Connections use OAuth 2.0. Tokens are encrypted and stored server-side. See docs for required environment variables per platform.
        </p>
      </div>

      {/* How It Works — dark section wrapper */}
      <div className="rounded-2xl overflow-hidden bg-[#09090B]">
        <HowItWorks />
      </div>
    </div>
  );
}
