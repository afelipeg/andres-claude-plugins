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
import { PLATFORMS, STORAGE_PROVIDERS, type PlatformConfig, type StorageConfig } from '../components/platform-logos';

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

// ─── Agency Multi-Advertiser Auth Fields ─────────────────────────────

interface AuthField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'select' | 'textarea';
  required: boolean;
  help?: string;
  link?: string;
  options?: { value: string; label: string }[];
}

interface ConnectionTypeConfig {
  value: string;
  label: string;
  fields: AuthField[];
}

const AGENCY_AUTH_CONFIG: Record<string, { types: ConnectionTypeConfig[] }> = {
  google_ads: {
    types: [
      { value: 'mcc', label: 'MCC (Manager Account)', fields: [
        { key: 'developer_token', label: 'Developer Token', type: 'password', required: true, help: 'Google Ads > Admin > API Center' },
        { key: 'client_id', label: 'OAuth Client ID', type: 'text', required: true, help: 'Google Cloud Console > Credentials' },
        { key: 'client_secret', label: 'OAuth Client Secret', type: 'password', required: true, help: 'Google Cloud Console > Credentials' },
        { key: 'refresh_token', label: 'Refresh Token', type: 'password', required: true, help: 'OAuth Playground', link: 'https://developers.google.com/oauthplayground' },
        { key: 'login_customer_id', label: 'MCC ID', type: 'text', required: true, help: 'MCC ID without dashes (login-customer-id header)' },
      ]},
      { value: 'direct', label: 'Direct Account', fields: [
        { key: 'developer_token', label: 'Developer Token', type: 'password', required: true, help: 'Google Ads > Admin > API Center' },
        { key: 'client_id', label: 'OAuth Client ID', type: 'text', required: true, help: 'Google Cloud Console > Credentials' },
        { key: 'client_secret', label: 'OAuth Client Secret', type: 'password', required: true, help: 'Google Cloud Console > Credentials' },
        { key: 'refresh_token', label: 'Refresh Token', type: 'password', required: true, help: 'OAuth Playground' },
      ]},
    ],
  },
  meta_ads: {
    types: [
      { value: 'system_user', label: 'System User (recommended)', fields: [
        { key: 'business_manager_id', label: 'Business Manager ID', type: 'text', required: true, help: 'Meta Business Suite > Settings > Business Info' },
        { key: 'app_id', label: 'App ID', type: 'text', required: true, help: 'Meta Developers > App Settings' },
        { key: 'app_secret', label: 'App Secret', type: 'password', required: true, help: 'Meta Developers > App Settings' },
        { key: 'system_user_token', label: 'System User Token', type: 'password', required: true, help: 'BM > System Users > Generate Token (never expires)' },
      ]},
      { value: 'oauth_user', label: 'OAuth User Token', fields: [
        { key: 'business_manager_id', label: 'Business Manager ID', type: 'text', required: true, help: 'Meta Business Suite > Settings > Business Info' },
        { key: 'app_id', label: 'App ID', type: 'text', required: true, help: 'Meta Developers > App Settings' },
        { key: 'app_secret', label: 'App Secret', type: 'password', required: true, help: 'Meta Developers > App Settings' },
        { key: 'access_token', label: 'User Access Token', type: 'password', required: true, help: 'Graph API Explorer (60-day expiry)' },
      ]},
    ],
  },
  dv360: {
    types: [
      { value: 'oauth2', label: 'OAuth2 Credentials', fields: [
        { key: 'client_id', label: 'OAuth Client ID', type: 'text', required: true, help: 'Google Cloud Console > Credentials' },
        { key: 'client_secret', label: 'OAuth Client Secret', type: 'password', required: true, help: 'Google Cloud Console > Credentials' },
        { key: 'refresh_token', label: 'Refresh Token', type: 'password', required: true, help: 'OAuth Playground' },
        { key: 'partner_id', label: 'Partner ID (Seat)', type: 'text', required: true, help: 'DV360 URL: /partner/XXXXXXXXX' },
      ]},
      { value: 'service_account', label: 'Service Account', fields: [
        { key: 'service_account_json', label: 'Service Account JSON', type: 'textarea', required: true, help: 'Google Cloud > IAM > Service Accounts > Keys' },
        { key: 'partner_id', label: 'Partner ID (Seat)', type: 'text', required: true, help: 'DV360 URL: /partner/XXXXXXXXX' },
      ]},
    ],
  },
  tiktok_ads: {
    types: [
      { value: 'business_center', label: 'Business Center', fields: [
        { key: 'bc_id', label: 'Business Center ID', type: 'text', required: true, help: 'TikTok Business Center > Settings > BC ID' },
        { key: 'app_id', label: 'App ID', type: 'text', required: true, help: 'TikTok Marketing API > My Apps' },
        { key: 'app_secret', label: 'App Secret', type: 'password', required: true, help: 'TikTok Marketing API > My Apps' },
        { key: 'access_token', label: 'Access Token', type: 'password', required: true, help: 'Long-lived token from TikTok Business' },
      ]},
      { value: 'direct', label: 'Direct Advertiser', fields: [
        { key: 'app_id', label: 'App ID', type: 'text', required: true, help: 'TikTok Marketing API > My Apps' },
        { key: 'app_secret', label: 'App Secret', type: 'password', required: true, help: 'TikTok Marketing API > My Apps' },
        { key: 'access_token', label: 'Access Token', type: 'password', required: true, help: 'Long-lived token from TikTok Business' },
      ]},
    ],
  },
  tiktok_shop: {
    types: [
      { value: 'direct', label: 'Direct', fields: [
        { key: 'app_key', label: 'App Key', type: 'text', required: true, help: 'TikTok Partner Center > My Apps' },
        { key: 'app_secret', label: 'App Secret', type: 'password', required: true, help: 'TikTok Partner Center > My Apps' },
        { key: 'access_token', label: 'Access Token', type: 'password', required: true, help: 'Via Partner Center OAuth' },
        { key: 'shop_id', label: 'Shop ID', type: 'text', required: true, help: 'TikTok Seller Center > Settings' },
      ]},
    ],
  },
  amazon_ads: {
    types: [
      { value: 'agency', label: 'Agency Account', fields: [
        { key: 'client_id', label: 'LwA Client ID', type: 'text', required: true, help: 'Amazon Developer Console' },
        { key: 'client_secret', label: 'LwA Client Secret', type: 'password', required: true, help: 'Amazon Developer Console' },
        { key: 'refresh_token', label: 'Refresh Token', type: 'password', required: true, help: 'Initial OAuth authorization' },
        { key: 'region', label: 'Region', type: 'select', required: true, options: [
          { value: 'na', label: 'North America (NA)' },
          { value: 'eu', label: 'Europe (EU)' },
          { value: 'fe', label: 'Far East (FE)' },
        ]},
      ]},
      { value: 'direct', label: 'Direct Account', fields: [
        { key: 'client_id', label: 'LwA Client ID', type: 'text', required: true, help: 'Amazon Developer Console' },
        { key: 'client_secret', label: 'LwA Client Secret', type: 'password', required: true, help: 'Amazon Developer Console' },
        { key: 'refresh_token', label: 'Refresh Token', type: 'password', required: true, help: 'Initial OAuth authorization' },
        { key: 'region', label: 'Region', type: 'select', required: true, options: [
          { value: 'na', label: 'North America (NA)' },
          { value: 'eu', label: 'Europe (EU)' },
          { value: 'fe', label: 'Far East (FE)' },
        ]},
      ]},
    ],
  },
};

// Backward compat: flat field list for OAuth fallback
const PLATFORM_AUTH_FIELDS: Record<string, AuthField[]> = {};
for (const [platform, cfg] of Object.entries(AGENCY_AUTH_CONFIG)) {
  PLATFORM_AUTH_FIELDS[platform] = cfg.types[0]?.fields ?? [];
}

// ─── Agency Connection Dialog (2-step: credentials → advertiser selection) ─

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
  const agencyCfg = AGENCY_AUTH_CONFIG[config.platform];
  const types = agencyCfg?.types ?? [];

  const [step, setStep] = useState<'credentials' | 'advertisers'>('credentials');
  const [connectionType, setConnectionType] = useState(types[0]?.value ?? '');
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 2 state
  const [subAccounts, setSubAccounts] = useState<Array<{ id: string; name: string; status?: string }>>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  const activeType = types.find((t) => t.value === connectionType);
  const fields = activeType?.fields ?? [];

  const headers = (): HeadersInit => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('plinth_token');
    if (token) h['Authorization'] = `Bearer ${token}`;
    const apiKey = import.meta.env.VITE_API_KEY as string | undefined;
    if (apiKey) h['X-API-Key'] = apiKey;
    return h;
  };

  const setField = (key: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [key]: value }));
    setFieldErrors([]);
  };

  const handleSaveCredentials = async () => {
    const missing = fields.filter((f) => f.required && !fieldValues[f.key]?.trim()).map((f) => f.label);
    if (missing.length > 0) { setFieldErrors(missing); return; }

    setSaving(true);
    setError(null);
    try {
      // Step 1: Save agency credentials
      const creds: Record<string, string> = {};
      for (const f of fields) {
        if (fieldValues[f.key]?.trim()) creds[f.key] = fieldValues[f.key].trim();
      }

      const res = await fetch(`${API_URL}/v1/agency/connections`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ platform: config.platform, connection_type: connectionType, credentials: creds }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(body.message || `HTTP ${res.status}`);
      }

      // Step 2: Fetch sub-accounts
      setLoadingAccounts(true);
      const acctRes = await fetch(`${API_URL}/v1/agency/connections/${config.platform}/sub-accounts`, {
        headers: headers(),
      });
      if (acctRes.ok) {
        const data = (await acctRes.json()) as { accounts: Array<{ id: string; name: string; status?: string }> };
        setSubAccounts(data.accounts ?? []);
      } else {
        const errBody = await acctRes.json().catch(() => ({})) as { message?: string; error?: string };
        const errMsg = errBody.message || errBody.error || `Failed to fetch sub-accounts (HTTP ${acctRes.status})`;
        setError(errMsg);
      }
      setLoadingAccounts(false);
      setStep('advertisers');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save credentials');
    } finally {
      setSaving(false);
    }
  };

  const toggleAccount = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSaveAdvertisers = async () => {
    if (selectedIds.size === 0) { setError('Select at least one advertiser'); return; }
    setSaving(true);
    setError(null);
    try {
      const advertisers = Array.from(selectedIds).map((id) => {
        const acc = subAccounts.find((a) => a.id === id);
        return { id, name: acc?.name ?? id };
      });
      const res = await fetch(`${API_URL}/v1/agency/connections/${config.platform}/advertisers`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ advertisers }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      onConnected();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save advertisers');
    } finally {
      setSaving(false);
    }
  };

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
              <DialogDescription>
                {step === 'credentials' ? 'Step 1: Agency credentials' : 'Step 2: Select advertisers'}
              </DialogDescription>
            </div>
          </div>
          {/* Step indicator */}
          <div className="flex gap-2 mt-2">
            <div className={`h-1 flex-1 rounded-full ${step === 'credentials' ? 'bg-gray-900' : 'bg-green-500'}`} />
            <div className={`h-1 flex-1 rounded-full ${step === 'advertisers' ? 'bg-gray-900' : 'bg-gray-200'}`} />
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {step === 'credentials' && (
            <>
              {/* Connection type selector */}
              {types.length > 1 && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Connection Type</label>
                  <select
                    value={connectionType}
                    onChange={(e) => { setConnectionType(e.target.value); setFieldValues({}); setFieldErrors([]); }}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
                  >
                    {types.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Credential fields */}
              {fields.map((field) => (
                <div key={field.key}>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    {field.label}
                    {field.required && <span className="text-red-400 ml-0.5">*</span>}
                  </label>
                  {field.type === 'select' && field.options ? (
                    <select value={fieldValues[field.key] ?? ''} onChange={(e) => setField(field.key, e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400">
                      <option value="">Select...</option>
                      {field.options.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                    </select>
                  ) : field.type === 'textarea' ? (
                    <textarea value={fieldValues[field.key] ?? ''} onChange={(e) => setField(field.key, e.target.value)}
                      placeholder={field.help} rows={4}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 font-mono text-xs" />
                  ) : (
                    <input type={field.type === 'password' ? 'password' : 'text'} value={fieldValues[field.key] ?? ''}
                      onChange={(e) => setField(field.key, e.target.value)} placeholder={field.help}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400" />
                  )}
                  {field.help && (
                    <p className="mt-1 text-[10px] text-gray-400">
                      {field.help}
                      {field.link && <> <a href={field.link} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Open</a></>}
                    </p>
                  )}
                </div>
              ))}

              {fieldErrors.length > 0 && (
                <div className="rounded-lg bg-red-50 border border-red-100 p-3">
                  <p className="text-xs text-red-700">Missing: {fieldErrors.join(', ')}</p>
                </div>
              )}

              <button onClick={() => void handleSaveCredentials()} disabled={saving || !hasRequiredFilled}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-3 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors">
                {saving ? (
                  <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Saving &amp; fetching accounts...</>
                ) : 'Save & Fetch Accounts'}
              </button>
            </>
          )}

          {step === 'advertisers' && (
            <>
              {loadingAccounts ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900" />
                  <span className="ml-2 text-sm text-gray-500">Loading accounts...</span>
                </div>
              ) : subAccounts.length === 0 ? (
                <div className="rounded-lg bg-yellow-50 border border-yellow-100 p-4 text-center">
                  <p className="text-sm text-yellow-700">No sub-accounts found.</p>
                  <p className="text-xs text-yellow-600 mt-1">Check your credentials or try a different connection type.</p>
                  <button onClick={() => setStep('credentials')} className="mt-3 text-xs text-blue-600 hover:underline">Back to credentials</button>
                </div>
              ) : (
                <>
                  <p className="text-xs text-gray-500">{subAccounts.length} accounts found. Select the advertisers to monitor:</p>
                  <div className="max-h-64 overflow-y-auto space-y-1 rounded-lg border border-gray-200 p-2">
                    {subAccounts.map((acc) => (
                      <label key={acc.id} className={`flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer transition-colors ${selectedIds.has(acc.id) ? 'bg-green-50 border border-green-200' : 'hover:bg-gray-50 border border-transparent'}`}>
                        <input type="checkbox" checked={selectedIds.has(acc.id)} onChange={() => toggleAccount(acc.id)}
                          className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{acc.name || acc.id}</p>
                          <p className="text-[10px] text-gray-400">{acc.id}</p>
                        </div>
                        {acc.status && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${acc.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {acc.status}
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-400">{selectedIds.size} selected</p>

                  <button onClick={() => void handleSaveAdvertisers()} disabled={saving || selectedIds.size === 0}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-3 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors">
                    {saving ? 'Saving...' : `Save ${selectedIds.size} Advertiser${selectedIds.size !== 1 ? 's' : ''}`}
                  </button>
                </>
              )}
            </>
          )}

          {/* Security note */}
          <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
            <p className="text-[11px] text-blue-700 leading-relaxed">
              Credentials are encrypted with AES-256-GCM. Plinth reads campaign data for selected advertisers only.
            </p>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-100 p-3">
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          {step === 'advertisers' && (
            <button onClick={() => setStep('credentials')}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              Back
            </button>
          )}
          <button onClick={() => onOpenChange(false)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
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

  // Agency connection state
  const [agencyConn, setAgencyConn] = useState<{ connection_type: string; advertiser_count: number } | null>(null);

  const isConnected = platformState?.status === 'connected' || (agencyConn && agencyConn.advertiser_count > 0);
  const hasError = platformState?.status === 'error';

  // Load agency connection on mount
  useEffect(() => {
    if (!apiMode) return;
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('plinth_token');
    if (token) h['Authorization'] = `Bearer ${token}`;
    const apiKey = import.meta.env.VITE_API_KEY as string | undefined;
    if (apiKey) h['X-API-Key'] = apiKey;

    void fetch(`${API_URL}/v1/agency/connections`, { headers: h })
      .then((r) => r.ok ? r.json() : null)
      .then((data: { connections: Array<{ platform: string; connection_type: string; advertiser_count: number }> } | null) => {
        const conn = data?.connections?.find((c) => c.platform === config.platform);
        if (conn) {
          setAgencyConn({ connection_type: conn.connection_type, advertiser_count: conn.advertiser_count });
          if (conn.advertiser_count > 0) connect(config.platform);
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.platform, apiMode]);

  const handleConnected = () => {
    connect(config.platform);
    // Refresh agency state
    setAgencyConn((prev) => prev ? { ...prev, advertiser_count: (prev.advertiser_count || 0) + 1 } : { connection_type: '', advertiser_count: 1 });
  };

  const handleDisconnect = useCallback(async () => {
    try {
      if (apiMode) {
        // Disconnect agency connection
        const h: Record<string, string> = { 'Content-Type': 'application/json' };
        const token = localStorage.getItem('plinth_token');
        if (token) h['Authorization'] = `Bearer ${token}`;
        await fetch(`${API_URL}/v1/agency/connections/${config.platform}`, { method: 'DELETE', headers: h });
      }
      disconnect(config.platform);
      setAgencyConn(null);
    } catch {
      disconnect(config.platform);
      setAgencyConn(null);
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
          <div className="flex items-center gap-1.5">
            {agencyConn && (
              <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                {agencyConn.connection_type}
              </span>
            )}
            {isConnected && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                {agencyConn?.advertiser_count ? `${agencyConn.advertiser_count} advertiser${agencyConn.advertiser_count !== 1 ? 's' : ''}` : 'Connected'}
              </span>
            )}
          </div>
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
            <div className="flex gap-2">
              <button
                onClick={() => setDialogOpen(true)}
                className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-[11px] font-medium text-gray-600 hover:border-gray-300 transition-colors"
              >
                Manage
              </button>
              <button
                onClick={() => void handleDisconnect()}
                className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-[11px] font-medium text-gray-500 hover:text-red-500 hover:border-red-200 transition-colors"
              >
                Disconnect
              </button>
            </div>
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


// ─── Storage Card (OAuth redirect — no manual fields) ─────────────────

function StorageCard({ config, apiMode }: { config: StorageConfig; apiMode: boolean }) {
  const [connected, setConnected] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [connectedAt, setConnectedAt] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiBase =
    (import.meta.env.VITE_API_URL as string | undefined) ||
    'https://polanyi-plinth-production.up.railway.app';

  const authHeaders = (): HeadersInit => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('plinth_token');
    if (token) h['Authorization'] = `Bearer ${token}`;
    const apiKey = import.meta.env.VITE_API_KEY as string | undefined;
    if (apiKey) h['X-API-Key'] = apiKey;
    return h;
  };

  // Check status on mount + detect ?connected=provider in URL (post-OAuth redirect)
  useEffect(() => {
    if (!apiMode) return;

    // Post-OAuth detection
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === config.id) {
      setConnected(true);
      const url = new URL(window.location.href);
      url.searchParams.delete('connected');
      window.history.replaceState({}, '', url.toString());
    }

    // Load status from backend
    if (config.id === 'google_drive') {
      void fetch(`${apiBase}/auth/google-drive/status`, { headers: authHeaders() })
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { connected: boolean; email: string | null; connected_at: string | null } | null) => {
          if (data?.connected) {
            setConnected(true);
            setEmail(data.email);
            setConnectedAt(data.connected_at);
          }
        })
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.id, apiMode]);

  const handleConnect = () => {
    if (!apiMode) return;
    const token = localStorage.getItem('plinth_token');
    if (!token) {
      setError('Not authenticated — please log in first');
      return;
    }
    // Direct redirect to backend OAuth init (passes token as query param)
    window.location.href = `${apiBase}/auth/google-drive?token=${encodeURIComponent(token)}`;
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const res = await fetch(`${apiBase}/auth/google-drive/disconnect`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error('Disconnect failed');
      setConnected(false);
      setEmail(null);
      setConnectedAt(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Disconnect failed');
    } finally {
      setDisconnecting(false);
    }
  };

  // OneDrive placeholder — disabled for now
  const isDisabled = config.id === 'onedrive';

  return (
    <div
      className={`group rounded-xl border p-5 transition-all ${
        isDisabled
          ? 'border-gray-100 bg-gray-50/50 opacity-60'
          : connected
            ? 'border-green-200 bg-green-50/40 hover:shadow-md'
            : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md cursor-pointer'
      }`}
      onClick={() => !connected && !isDisabled && handleConnect()}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-50 border border-gray-100 group-hover:border-gray-200 transition-colors">
          <config.Logo className="h-7 w-7" />
        </div>
        {connected && (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            Connected
          </span>
        )}
        {isDisabled && !connected && (
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-400">
            Coming soon
          </span>
        )}
      </div>

      <h3 className="text-sm font-semibold text-gray-900 mb-1">{config.name}</h3>
      <p className="text-xs text-gray-500 leading-relaxed mb-1">{config.description}</p>
      <p className="text-[10px] text-gray-400 mb-3">{config.scopes}</p>

      {connected && (
        <div className="space-y-2">
          {email && (
            <p className="text-[10px] text-gray-500">
              <span className="font-medium text-gray-700">{email}</span>
            </p>
          )}
          {connectedAt && (
            <p className="text-[10px] text-gray-400">
              Connected {new Date(connectedAt).toLocaleDateString()}
            </p>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); void handleDisconnect(); }}
            disabled={disconnecting}
            className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-[11px] font-medium text-gray-500 hover:text-red-500 hover:border-red-200 disabled:opacity-50 transition-colors"
          >
            {disconnecting ? 'Disconnecting...' : 'Disconnect'}
          </button>
        </div>
      )}

      {!connected && !isDisabled && (
        <button
          onClick={(e) => { e.stopPropagation(); handleConnect(); }}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white hover:bg-gray-800 transition-colors"
        >
          <config.Logo className="h-4 w-4" />
          Connect {config.name}
        </button>
      )}

      {error && (
        <div className="mt-2 rounded-lg bg-red-50 border border-red-100 p-2">
          <p className="text-[10px] text-red-600">{error}</p>
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

      {/* Cloud Storage (OAuth redirect — like Claude.ai / Perplexity) */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Cloud Storage</h3>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
            OAuth
          </span>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Connect cloud storage to import files directly into Plinth. One click — no credentials needed.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {STORAGE_PROVIDERS.map((config) => (
            <StorageCard key={config.id} config={config} apiMode={apiMode} />
          ))}
        </div>
      </div>

    </div>
  );
}
