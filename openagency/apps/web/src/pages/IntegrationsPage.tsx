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

const SYNC_INTERVALS: { value: SyncInterval; label: string }[] = [
  { value: '15m', label: 'Every 15 min' },
  { value: '1h', label: 'Hourly' },
  { value: '6h', label: 'Every 6 hours' },
  { value: '24h', label: 'Daily' },
  { value: 'manual', label: 'Manual only' },
];

// ─── Platform-specific auth field definitions ───────────────────────

interface AuthField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'select' | 'textarea';
  required: boolean;
  help?: string;
  link?: string;
  options?: { value: string; label: string }[];
}

const PLATFORM_AUTH_FIELDS: Record<string, AuthField[]> = {
  google_ads: [
    { key: 'developer_token', label: 'Developer Token', type: 'password', required: true,
      help: 'Google Ads > Admin > API Center' },
    { key: 'client_id', label: 'OAuth Client ID', type: 'text', required: true,
      help: 'Google Cloud Console > Credentials > OAuth 2.0' },
    { key: 'client_secret', label: 'OAuth Client Secret', type: 'password', required: true,
      help: 'Google Cloud Console > Credentials > OAuth 2.0' },
    { key: 'refresh_token', label: 'Refresh Token', type: 'password', required: true,
      help: 'Generate at OAuth Playground',
      link: 'https://developers.google.com/oauthplayground' },
    { key: 'manager_id', label: 'Manager Account ID (MCC)', type: 'text', required: false,
      help: 'Your MCC ID without dashes (optional)' },
  ],
  meta_ads: [
    { key: 'access_token', label: 'Access Token', type: 'password', required: true,
      help: 'Meta Business Suite > Settings > API Access > Graph API Explorer' },
    { key: 'account_id', label: 'Ad Account ID', type: 'text', required: true,
      help: 'From your Ads Manager URL: act_XXXXXXXXX' },
    { key: 'app_id', label: 'App ID', type: 'text', required: true,
      help: 'Meta Developers > App Settings > Basic' },
    { key: 'app_secret', label: 'App Secret', type: 'password', required: true,
      help: 'Meta Developers > App Settings > Basic' },
  ],
  dv360: [
    { key: 'client_id', label: 'OAuth Client ID', type: 'text', required: true,
      help: 'Google Cloud Console > Credentials > OAuth 2.0' },
    { key: 'client_secret', label: 'OAuth Client Secret', type: 'password', required: true,
      help: 'Google Cloud Console > Credentials > OAuth 2.0' },
    { key: 'refresh_token', label: 'Refresh Token', type: 'password', required: true,
      help: 'Generate at OAuth Playground',
      link: 'https://developers.google.com/oauthplayground' },
    { key: 'partner_id', label: 'Partner ID', type: 'text', required: true,
      help: 'DV360 URL contains /partner/XXXXXXXXX' },
  ],
  tiktok_ads: [
    { key: 'access_token', label: 'Access Token', type: 'password', required: true,
      help: 'TikTok for Business > My Apps > Access Token (long-lived)' },
    { key: 'advertiser_id', label: 'Advertiser ID', type: 'text', required: true,
      help: 'TikTok Ads Manager > Account > Advertiser ID' },
    { key: 'app_id', label: 'App ID', type: 'text', required: true,
      help: 'TikTok Marketing API > My Apps' },
    { key: 'app_secret', label: 'App Secret', type: 'password', required: true,
      help: 'TikTok Marketing API > My Apps' },
  ],
  tiktok_shop: [
    { key: 'app_key', label: 'App Key', type: 'text', required: true,
      help: 'TikTok Partner Center > My Apps > App Key' },
    { key: 'app_secret', label: 'App Secret', type: 'password', required: true,
      help: 'TikTok Partner Center > My Apps > App Secret' },
    { key: 'access_token', label: 'Access Token', type: 'password', required: true,
      help: 'Generated via Partner Center OAuth seller authorization' },
    { key: 'shop_id', label: 'Shop ID', type: 'text', required: true,
      help: 'TikTok Seller Center > Settings > Shop ID' },
  ],
  amazon_ads: [
    { key: 'client_id', label: 'LwA Client ID', type: 'text', required: true,
      help: 'Amazon Developer Console > Login with Amazon' },
    { key: 'client_secret', label: 'LwA Client Secret', type: 'password', required: true,
      help: 'Amazon Developer Console > Login with Amazon' },
    { key: 'refresh_token', label: 'Refresh Token', type: 'password', required: true,
      help: 'Generated during initial OAuth authorization' },
    { key: 'profile_id', label: 'Profile ID', type: 'text', required: true,
      help: 'Amazon Ads Console > Settings > Profile ID' },
    { key: 'region', label: 'Region', type: 'select', required: true,
      options: [
        { value: 'na', label: 'North America (NA)' },
        { value: 'eu', label: 'Europe (EU)' },
        { value: 'fe', label: 'Far East (FE)' },
      ] },
  ],
};

// ─── Connection Dialog (OAuth-first + platform-specific fallback) ────

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
  const [showManual, setShowManual] = useState(false);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);

  const fields = PLATFORM_AUTH_FIELDS[config.platform] ?? [];

  const setField = (key: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [key]: value }));
    setFieldErrors([]);
  };

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
    } catch {
      setShowManual(true);
      setError('Direct connection unavailable. Enter your credentials below.');
    } finally {
      setConnecting(false);
    }
  };

  const handleManualConnect = async () => {
    // Validate required fields
    const missing = fields
      .filter((f) => f.required && !fieldValues[f.key]?.trim())
      .map((f) => f.label);
    if (missing.length > 0) {
      setFieldErrors(missing);
      return;
    }

    setConnecting(true);
    setError(null);
    try {
      if (apiMode) {
        // Build tokens object — access_token comes from field or a synthetic one
        const accessToken = fieldValues['access_token'] || fieldValues['refresh_token'] || 'manual_credentials';
        const tokens = {
          access_token: accessToken,
          refresh_token: fieldValues['refresh_token'],
          expires_at: fieldValues['access_token'] ? undefined : undefined,
        };

        // Build credentials object with all platform-specific fields
        const credentials: Record<string, string | undefined> = {};
        for (const f of fields) {
          if (fieldValues[f.key]?.trim()) {
            credentials[f.key] = fieldValues[f.key].trim();
          }
        }

        await connectPlatform(config.platform, tokens, credentials);
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
  const supportsManual = config.authMethod === 'api_key' || config.authMethod === 'both';
  const hasRequiredFilled = fields.filter((f) => f.required).every((f) => fieldValues[f.key]?.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
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
              {connecting && !showManual ? (
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

          {/* Manual credentials toggle */}
          {supportsManual && supportsOAuth && (
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs">
                <button
                  onClick={() => setShowManual(!showManual)}
                  className="bg-white px-3 text-gray-500 hover:text-gray-700 transition-colors"
                >
                  {showManual ? 'Hide manual setup' : 'Or enter credentials manually'}
                </button>
              </div>
            </div>
          )}

          {/* Platform-specific credential fields */}
          {(showManual || (supportsManual && !supportsOAuth)) && fields.length > 0 && (
            <div className="space-y-3">
              {fields.map((field) => (
                <div key={field.key}>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    {field.label}
                    {field.required && <span className="text-red-400 ml-0.5">*</span>}
                  </label>

                  {field.type === 'select' && field.options ? (
                    <select
                      value={fieldValues[field.key] ?? ''}
                      onChange={(e) => setField(field.key, e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
                    >
                      <option value="">Select...</option>
                      {field.options.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : field.type === 'textarea' ? (
                    <textarea
                      value={fieldValues[field.key] ?? ''}
                      onChange={(e) => setField(field.key, e.target.value)}
                      placeholder={field.help}
                      rows={4}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 font-mono text-xs"
                    />
                  ) : (
                    <input
                      type={field.type === 'password' ? 'password' : 'text'}
                      value={fieldValues[field.key] ?? ''}
                      onChange={(e) => setField(field.key, e.target.value)}
                      placeholder={field.help}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
                    />
                  )}

                  {field.help && (
                    <p className="mt-1 text-[10px] text-gray-400">
                      {field.help}
                      {field.link && (
                        <>
                          {' '}
                          <a
                            href={field.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:underline"
                          >
                            Open
                          </a>
                        </>
                      )}
                    </p>
                  )}
                </div>
              ))}

              {/* Validation errors */}
              {fieldErrors.length > 0 && (
                <div className="rounded-lg bg-red-50 border border-red-100 p-3">
                  <p className="text-xs text-red-700">
                    Missing required fields: {fieldErrors.join(', ')}
                  </p>
                </div>
              )}

              <button
                onClick={() => void handleManualConnect()}
                disabled={connecting || !hasRequiredFilled}
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {connecting && showManual ? 'Saving...' : 'Save Credentials'}
              </button>
            </div>
          )}

          {/* Security note */}
          <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
            <p className="text-[11px] text-blue-700 leading-relaxed">
              {supportsOAuth
                ? `You'll be redirected to ${config.name}'s authorization page. Plinth requests read-only access. Tokens are encrypted server-side with AES-256-GCM.`
                : 'Your credentials are encrypted with AES-256-GCM and stored securely. Plinth requests read-only access to your campaign data.'}
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

    </div>
  );
}
