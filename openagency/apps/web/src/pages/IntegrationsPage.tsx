// @ts-nocheck
// ─── Apps & MCP Page (Perplexity-style grid) ─────────────────────────
// 3-column grid of platform connectors + MCP/API credentials below

import { useState, useCallback, useEffect } from 'react';
import { RefreshCw, Database, Clock, Calendar } from 'lucide-react';
import type { ConnectorPlatform, SyncInterval } from '@openagency/types';
import { useConnectorStore } from '../stores/connector-store';
import { isApiMode } from '../api/agency';
import {
  listConnectors,
  connectPlatform,
  disconnectPlatform,
  syncPlatform,
  getSyncStatus,
  getAuthUrl,
  exchangeOAuthCode,
  openOAuthPopup,
} from '../api/connectors';
import type { SyncStatusResponse } from '../api/connectors';
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

// ─── Helpers ─────────────────────────────────────────────────────────

/** Human-readable time-ago string */
function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Never';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  if (diffMs < 0) return 'Just now';
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

/** Human-readable time-until string for next sync */
function timeUntil(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Not scheduled';
  const now = Date.now();
  const target = new Date(dateStr).getTime();
  const diffMs = target - now;
  if (diffMs <= 0) return 'Due now';
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `in ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `in ${hours}h`;
  const days = Math.floor(hours / 24);
  return `in ${days}d`;
}

/** Calculate next weekly sync from last sync date */
function getNextWeeklySync(lastSyncAt: string | null | undefined): string | null {
  if (!lastSyncAt) return null;
  const last = new Date(lastSyncAt);
  const next = new Date(last.getTime() + 7 * 24 * 60 * 60 * 1000);
  return next.toISOString();
}

/** Format sync interval to human-readable schedule label */
function scheduleLabel(interval: SyncInterval | undefined): string {
  switch (interval) {
    case '15m': return 'Every 15 min';
    case '1h': return 'Hourly';
    case '6h': return 'Every 6 hours';
    case '24h': return 'Daily';
    case 'manual': return 'Manual';
    default: return 'Weekly';
  }
}

/** Determine if a connection is stale (updated >24h ago or backend says so) */
function isStaleStatus(status: string | undefined, updatedAt: string | null | undefined): boolean {
  if (!status) return false;
  if (status === 'stale' || status === 'expired' || status === 'error') return true;
  if (status === 'connected' && updatedAt) {
    const hoursSince = (Date.now() - new Date(updatedAt).getTime()) / 3_600_000;
    return hoursSince > 24;
  }
  return false;
}

/** Status badge config */
function getStatusBadge(status: string | undefined, updatedAt: string | null | undefined): {
  label: string;
  dotColor: string;
  bgColor: string;
  textColor: string;
} {
  if (!status || status === 'disconnected') {
    return { label: 'Not connected', dotColor: 'bg-white/30', bgColor: 'bg-white/10', textColor: 'text-white/50' };
  }
  if (status === 'error') {
    return { label: 'Error', dotColor: 'bg-red-400', bgColor: 'bg-red-500/20', textColor: 'text-red-300' };
  }
  if (status === 'stale' || status === 'expired') {
    return { label: 'Stale', dotColor: 'bg-amber-400', bgColor: 'bg-amber-500/20', textColor: 'text-amber-300' };
  }
  if (status === 'connected' && updatedAt) {
    const hoursSince = (Date.now() - new Date(updatedAt).getTime()) / 3_600_000;
    if (hoursSince > 24) {
      return { label: 'Stale', dotColor: 'bg-amber-400', bgColor: 'bg-amber-500/20', textColor: 'text-amber-300' };
    }
  }
  return { label: 'Connected', dotColor: 'bg-emerald-400', bgColor: 'bg-emerald-500/20', textColor: 'text-emerald-300' };
}

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

// ─── Agency Connection Dialog (2-step: credentials -> advertiser selection) ─

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
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/5 border border-white/5">
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
            <div className={`h-1 flex-1 rounded-full ${step === 'credentials' ? 'bg-[#00F5FF]/20' : 'bg-emerald-400'}`} />
            <div className={`h-1 flex-1 rounded-full ${step === 'advertisers' ? 'bg-[#00F5FF]/20' : 'bg-gray-200'}`} />
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {step === 'credentials' && (
            <>
              {/* Connection type selector */}
              {types.length > 1 && (
                <div>
                  <label className="block text-xs font-medium text-white/70 mb-1.5">Connection Type</label>
                  <select
                    value={connectionType}
                    onChange={(e) => { setConnectionType(e.target.value); setFieldValues({}); setFieldErrors([]); }}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/95 focus:border-[#00F5FF]/50 focus:outline-none focus:ring-1 focus:ring-[#00F5FF]/30"
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
                  <label className="block text-xs font-medium text-white/70 mb-1.5">
                    {field.label}
                    {field.required && <span className="text-red-400 ml-0.5">*</span>}
                  </label>
                  {field.type === 'select' && field.options ? (
                    <select value={fieldValues[field.key] ?? ''} onChange={(e) => setField(field.key, e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/95 focus:border-[#00F5FF]/50 focus:outline-none focus:ring-1 focus:ring-[#00F5FF]/30">
                      <option value="">Select...</option>
                      {field.options.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                    </select>
                  ) : field.type === 'textarea' ? (
                    <textarea value={fieldValues[field.key] ?? ''} onChange={(e) => setField(field.key, e.target.value)}
                      placeholder={field.help} rows={4}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/95 placeholder:text-white/40 focus:border-[#00F5FF]/50 focus:outline-none focus:ring-1 focus:ring-[#00F5FF]/30 font-mono text-xs" />
                  ) : (
                    <input type={field.type === 'password' ? 'password' : 'text'} value={fieldValues[field.key] ?? ''}
                      onChange={(e) => setField(field.key, e.target.value)} placeholder={field.help}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white/95 placeholder:text-white/40 focus:border-[#00F5FF]/50 focus:outline-none focus:ring-1 focus:ring-[#00F5FF]/30" />
                  )}
                  {field.help && (
                    <p className="mt-1 text-[10px] text-white/40">
                      {field.help}
                      {field.link && <> <a href={field.link} target="_blank" rel="noopener noreferrer" className="text-[#00F5FF] hover:underline">Open</a></>}
                    </p>
                  )}
                </div>
              ))}

              {fieldErrors.length > 0 && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
                  <p className="text-xs text-red-400">Missing: {fieldErrors.join(', ')}</p>
                </div>
              )}

              <button onClick={() => void handleSaveCredentials()} disabled={saving || !hasRequiredFilled}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#00F5FF]/20 px-4 py-3 text-sm font-medium text-white hover:bg-[#00F5FF]/30 disabled:opacity-50 transition-colors">
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
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-gray-900" />
                  <span className="ml-2 text-sm text-white/50">Loading accounts...</span>
                </div>
              ) : subAccounts.length === 0 ? (
                <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-4 text-center">
                  <p className="text-sm text-yellow-300">No sub-accounts found.</p>
                  <p className="text-xs text-yellow-300 mt-1">Check your credentials or try a different connection type.</p>
                  <button onClick={() => setStep('credentials')} className="mt-3 text-xs text-[#00F5FF] hover:underline">Back to credentials</button>
                </div>
              ) : (
                <>
                  <p className="text-xs text-white/50">{subAccounts.length} accounts found. Select the advertisers to monitor:</p>
                  <div className="max-h-64 overflow-y-auto space-y-1 rounded-lg border border-white/10 p-2">
                    {subAccounts.map((acc) => (
                      <label key={acc.id} className={`flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer transition-colors ${selectedIds.has(acc.id) ? 'bg-green-50 border border-emerald-500/30' : 'hover:bg-white/5 border border-transparent'}`}>
                        <input type="checkbox" checked={selectedIds.has(acc.id)} onChange={() => toggleAccount(acc.id)}
                          className="h-4 w-4 rounded border-white/15 text-emerald-300 focus:ring-green-500" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white/95 truncate">{acc.name || acc.id}</p>
                          <p className="text-[10px] text-white/40">{acc.id}</p>
                        </div>
                        {acc.status && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${acc.status === 'active' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-white/50'}`}>
                            {acc.status}
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                  <p className="text-[10px] text-white/40">{selectedIds.size} selected</p>

                  <button onClick={() => void handleSaveAdvertisers()} disabled={saving || selectedIds.size === 0}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#00F5FF]/20 px-4 py-3 text-sm font-medium text-white hover:bg-[#00F5FF]/30 disabled:opacity-50 transition-colors">
                    {saving ? 'Saving...' : `Save ${selectedIds.size} Advertiser${selectedIds.size !== 1 ? 's' : ''}`}
                  </button>
                </>
              )}
            </>
          )}

          {/* Security note */}
          <div className="rounded-lg bg-[#00F5FF]/10 border border-[#00F5FF]/20 p-3">
            <p className="text-[11px] text-[#00F5FF] leading-relaxed">
              Credentials are encrypted with AES-256-GCM. Plinth reads campaign data for selected advertisers only.
            </p>
          </div>

          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          {step === 'advertisers' && (
            <button onClick={() => setStep('credentials')}
              className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/5 transition-colors">
              Back
            </button>
          )}
          <button onClick={() => onOpenChange(false)}
            className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/5 transition-colors">
            Cancel
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Platform Card (Perplexity grid style) ───────────────────────────

interface AgencyConnState {
  connection_type: string;
  advertiser_count: number;
  status: string;
  updated_at: string | null;
  connected_at: string | null;
}

function PlatformCard({ config, apiMode }: { config: PlatformConfig; apiMode: boolean }) {
  const platformState = useConnectorStore((s) => s.getPlatform(config.platform));
  const connect = useConnectorStore((s) => s.connect);
  const disconnect = useConnectorStore((s) => s.disconnect);
  const setSyncInterval = useConnectorStore((s) => s.setSyncInterval);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Agency connection state — now includes status, timestamps
  const [agencyConn, setAgencyConn] = useState<AgencyConnState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Sync status state — row count, last sync timestamp
  const [syncStatus, setSyncStatusState] = useState<SyncStatusResponse | null>(null);

  const isConnected = platformState?.status === 'connected' || (agencyConn && agencyConn.advertiser_count > 0);
  const hasError = platformState?.status === 'error' || agencyConn?.status === 'error';
  const stale = isStaleStatus(agencyConn?.status, agencyConn?.updated_at);
  const badge = getStatusBadge(
    agencyConn?.status ?? (platformState?.status === 'connected' ? 'connected' : undefined),
    agencyConn?.updated_at,
  );

  // Load agency connection on mount
  const loadAgencyConn = useCallback(async () => {
    if (!apiMode) return;
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = localStorage.getItem('plinth_token');
    if (token) h['Authorization'] = `Bearer ${token}`;
    const apiKey = import.meta.env.VITE_API_KEY as string | undefined;
    if (apiKey) h['X-API-Key'] = apiKey;

    try {
      const r = await fetch(`${API_URL}/v1/agency/connections`, { headers: h });
      if (!r.ok) {
        if (r.status >= 500) setLoadError(`Server error (${r.status})`);
        return;
      }
      const data = (await r.json()) as {
        connections: Array<{
          platform: string;
          connection_type: string;
          advertiser_count: number;
          status: string;
          updated_at: string;
          connected_at: string;
        }>;
      };
      const conn = data?.connections?.find((c) => c.platform === config.platform);
      if (conn) {
        setAgencyConn({
          connection_type: conn.connection_type,
          advertiser_count: conn.advertiser_count,
          status: conn.status ?? 'connected',
          updated_at: conn.updated_at ?? null,
          connected_at: conn.connected_at ?? null,
        });
        if (conn.advertiser_count > 0) connect(config.platform);
        setLoadError(null);
      }
    } catch {
      setLoadError('Failed to load connection status');
    }
  }, [config.platform, apiMode, connect]);

  // Load sync status on mount (for connected platforms)
  const loadSyncStatus = useCallback(async () => {
    if (!apiMode) return;
    try {
      const status = await getSyncStatus(config.platform);
      setSyncStatusState(status);
    } catch {
      // Sync status not available — that is fine
    }
  }, [config.platform, apiMode]);

  useEffect(() => {
    void loadAgencyConn();
    void loadSyncStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.platform, apiMode]);

  const handleConnected = () => {
    connect(config.platform);
    setAgencyConn((prev) => prev
      ? { ...prev, advertiser_count: (prev.advertiser_count || 0) + 1, status: 'connected', updated_at: new Date().toISOString() }
      : { connection_type: '', advertiser_count: 1, status: 'connected', updated_at: new Date().toISOString(), connected_at: new Date().toISOString() },
    );
  };

  const handleDisconnect = useCallback(async () => {
    try {
      if (apiMode) {
        const h: Record<string, string> = { 'Content-Type': 'application/json' };
        const token = localStorage.getItem('plinth_token');
        if (token) h['Authorization'] = `Bearer ${token}`;
        await fetch(`${API_URL}/v1/agency/connections/${config.platform}`, { method: 'DELETE', headers: h });
      }
      disconnect(config.platform);
      setAgencyConn(null);
      setSyncStatusState(null);
    } catch {
      disconnect(config.platform);
      setAgencyConn(null);
      setSyncStatusState(null);
    }
  }, [config.platform, disconnect, apiMode]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      if (apiMode) {
        const result = await syncPlatform(config.platform);
        if (result.error) {
          setSyncError(result.error);
        } else {
          // Update local state to reflect successful sync
          const now = new Date().toISOString();
          setAgencyConn((prev) => prev
            ? { ...prev, status: 'connected', updated_at: now }
            : prev,
          );
          // Update sync status with new data
          setSyncStatusState({
            platform: config.platform,
            has_synced: true,
            last_sync: result,
            row_count: result.row_count ?? 0,
            synced_at: result.synced_at ?? now,
          });
        }
      }
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }, [config.platform, apiMode]);

  const handleRetry = useCallback(async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      // Re-check credentials by re-loading, then trigger sync
      await loadAgencyConn();
      if (apiMode) {
        const result = await syncPlatform(config.platform);
        if (result.error) {
          setSyncError(result.error);
        } else {
          const now = new Date().toISOString();
          setAgencyConn((prev) => prev
            ? { ...prev, status: 'connected', updated_at: now }
            : prev,
          );
          setSyncStatusState({
            platform: config.platform,
            has_synced: true,
            last_sync: result,
            row_count: result.row_count ?? 0,
            synced_at: result.synced_at ?? now,
          });
        }
      }
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Retry failed');
    } finally {
      setSyncing(false);
    }
  }, [config.platform, apiMode, loadAgencyConn]);

  // Derived sync info
  const lastSyncAt = syncStatus?.synced_at ?? platformState?.lastSync?.synced_at ?? agencyConn?.updated_at ?? null;
  const nextSyncAt = getNextWeeklySync(lastSyncAt);
  const rowCount = syncStatus?.row_count ?? 0;
  const currentInterval = platformState?.syncInterval;

  // Card border/bg color based on state
  const cardClasses = stale || hasError
    ? 'border-amber-500/30 bg-amber-500/5 hover:shadow-lg hover:shadow-amber-500/5'
    : isConnected
      ? 'border-emerald-500/30 bg-emerald-500/10 hover:shadow-lg hover:shadow-[#00F5FF]/5'
      : 'border-white/10 bg-white/5 hover:border-white/15 hover:shadow-lg hover:shadow-[#00F5FF]/5';

  return (
    <>
      <div
        className={`group rounded-xl border p-5 transition-all cursor-pointer ${cardClasses}`}
        onClick={() => !isConnected && !stale && setDialogOpen(true)}
      >
        {/* Logo + status badge */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 border border-white/5 group-hover:border-white/10 transition-colors">
            <config.Logo className="h-7 w-7" />
          </div>
          <div className="flex items-center gap-1.5">
            {agencyConn && (
              <span className="inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/50">
                {agencyConn.connection_type}
              </span>
            )}
            {(isConnected || stale || hasError) && (
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.bgColor} ${badge.textColor}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${badge.dotColor} ${stale ? 'animate-pulse' : ''}`} />
                {badge.label}
                {agencyConn?.advertiser_count && badge.label === 'Connected'
                  ? ` (${agencyConn.advertiser_count})`
                  : ''}
              </span>
            )}
          </div>
        </div>

        {/* Name + description */}
        <h3 className="text-sm font-semibold text-white/95 mb-1">{config.name}</h3>
        <p className="text-xs text-white/50 leading-relaxed mb-3">{config.description}</p>

        {/* Stale/Error state: warning banner + retry */}
        {(stale || hasError) && isConnected ? (
          <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
            {/* Warning banner */}
            <div className={`rounded-lg p-2.5 ${hasError ? 'bg-red-500/10 border border-red-500/20' : 'bg-amber-500/10 border border-amber-500/20'}`}>
              <div className="flex items-start gap-2">
                <svg className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${hasError ? 'text-red-400' : 'text-amber-400'}`} viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.345 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className={`text-[11px] font-medium ${hasError ? 'text-red-300' : 'text-amber-300'}`}>
                    {hasError ? 'Connection Error' : 'Data is Stale'}
                  </p>
                  <p className="text-[10px] text-white/40 mt-0.5">
                    {syncError
                      ? syncError
                      : loadError
                        ? loadError
                        : agencyConn?.status === 'expired'
                          ? 'Credentials have expired. Please reconnect or refresh tokens.'
                          : agencyConn?.status === 'error'
                            ? 'The platform API returned an error. Try re-syncing.'
                            : `Last updated ${timeAgo(agencyConn?.updated_at)}. Data may be outdated.`
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* Sync scheduling & freshness panel */}
            <div className="bg-white/5 rounded-lg p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3 text-white/30 shrink-0" />
                  <div>
                    <p className="text-[9px] text-white/40 uppercase tracking-wider">Last sync</p>
                    <p className="text-[11px] text-white/70 font-medium">{timeAgo(lastSyncAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3 w-3 text-white/30 shrink-0" />
                  <div>
                    <p className="text-[9px] text-white/40 uppercase tracking-wider">Next sync</p>
                    <p className="text-[11px] text-white/70 font-medium">{timeUntil(nextSyncAt)}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-[#00F5FF]/10 px-1.5 py-0.5 text-[9px] font-medium text-[#00F5FF]">
                    {scheduleLabel(currentInterval)}
                  </span>
                  {rowCount > 0 && (
                    <span className="flex items-center gap-1 text-[10px] text-white/50">
                      <Database className="h-2.5 w-2.5" />
                      {rowCount.toLocaleString()} rows
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Timestamps */}
            <div className="flex items-center gap-3 text-[10px] text-white/40">
              {agencyConn?.connected_at && (
                <span>Connected {timeAgo(agencyConn.connected_at)}</span>
              )}
              {agencyConn?.updated_at && (
                <span>Updated {timeAgo(agencyConn.updated_at)}</span>
              )}
            </div>

            {platformState?.lastSync && (
              <p className="text-[10px] text-white/40">
                Last sync: {new Date(platformState.lastSync.synced_at).toLocaleString()}
              </p>
            )}

            {/* Action buttons for stale state */}
            <div className="flex gap-2">
              <button
                onClick={() => void handleRetry()}
                disabled={syncing}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-[#00F5FF]/20 px-3 py-2 text-[11px] font-medium text-white hover:bg-[#00F5FF]/30 disabled:opacity-50 transition-colors"
              >
                {syncing ? (
                  <><div className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" /> Re-syncing...</>
                ) : (
                  <><svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.442 2.007l-1.564 1.564a.75.75 0 01-1.06-1.06l2.5-2.5a.75.75 0 011.06 0l2.5 2.5a.75.75 0 11-1.06 1.06l-1.09-1.09a4 4 0 006.85-1.461.75.75 0 011.306.72zM4.688 8.576a5.5 5.5 0 019.442-2.007l1.564-1.564a.75.75 0 011.06 1.06l-2.5 2.5a.75.75 0 01-1.06 0l-2.5-2.5a.75.75 0 011.06-1.06l1.09 1.09a4 4 0 00-6.85 1.461.75.75 0 01-1.306-.72z" clipRule="evenodd" /></svg> Re-sync</>
                )}
              </button>
              <button
                onClick={() => setDialogOpen(true)}
                className="rounded-lg border border-white/10 px-3 py-2 text-[11px] font-medium text-white/60 hover:border-white/15 transition-colors"
              >
                Reconnect
              </button>
            </div>
            <button
              onClick={() => void handleDisconnect()}
              className="w-full rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-medium text-white/40 hover:text-red-400 hover:border-red-500/30 transition-colors"
            >
              Disconnect
            </button>
          </div>
        ) : isConnected ? (
          /* Connected healthy state: sync info + actions */
          <div className="space-y-2" onClick={(e) => e.stopPropagation()}>

            {/* ── Sync scheduling & data freshness panel ── */}
            <div className="bg-white/5 rounded-lg p-3 space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3 text-white/30 shrink-0" />
                  <div>
                    <p className="text-[9px] text-white/40 uppercase tracking-wider">Last sync</p>
                    <p className="text-[11px] text-white/70 font-medium">{timeAgo(lastSyncAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3 w-3 text-white/30 shrink-0" />
                  <div>
                    <p className="text-[9px] text-white/40 uppercase tracking-wider">Next sync</p>
                    <p className="text-[11px] text-white/70 font-medium">{timeUntil(nextSyncAt)}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-[#00F5FF]/10 px-1.5 py-0.5 text-[9px] font-medium text-[#00F5FF]">
                    {scheduleLabel(currentInterval)}
                  </span>
                  {rowCount > 0 && (
                    <span className="flex items-center gap-1 text-[10px] text-white/50">
                      <Database className="h-2.5 w-2.5" />
                      {rowCount.toLocaleString()} rows
                    </span>
                  )}
                </div>
                {agencyConn?.advertiser_count ? (
                  <span className="text-[10px] text-white/40">
                    {agencyConn.advertiser_count} advertiser{agencyConn.advertiser_count !== 1 ? 's' : ''}
                  </span>
                ) : null}
              </div>
            </div>

            {syncError && (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2">
                <p className="text-[10px] text-amber-400">{syncError}</p>
              </div>
            )}

            {/* Sync interval selector + Sync Now button */}
            <div className="flex items-center gap-2">
              <select
                value={platformState?.syncInterval ?? '1h'}
                onChange={(e) => setSyncInterval(config.platform, e.target.value as SyncInterval)}
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] text-white/60"
              >
                {SYNC_INTERVALS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <button
                onClick={() => void handleSync()}
                disabled={syncing}
                className="flex items-center gap-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 text-[11px] font-medium text-white/80 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Sync Now'}
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setDialogOpen(true)}
                className="flex-1 rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-medium text-white/60 hover:border-white/15 transition-colors"
              >
                Manage
              </button>
              <button
                onClick={() => void handleDisconnect()}
                className="flex-1 rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-medium text-white/50 hover:text-red-400 hover:border-red-500/30 transition-colors"
              >
                Disconnect
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); setDialogOpen(true); }}
            className="w-full rounded-lg bg-[#00F5FF]/20 px-3 py-2 text-xs font-medium text-white hover:bg-[#00F5FF]/30 transition-colors"
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


// ─── Storage Card (OAuth redirect -- no manual fields) ─────────────────

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
      setError('Not authenticated -- please log in first');
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

  // OneDrive placeholder -- disabled for now
  const isDisabled = config.id === 'onedrive';

  return (
    <div
      className={`group rounded-xl border p-5 transition-all ${
        isDisabled
          ? 'border-white/5 bg-white/5/50 opacity-60'
          : connected
            ? 'border-emerald-500/30 bg-emerald-500/10 hover:shadow-lg hover:shadow-[#00F5FF]/5'
            : 'border-white/10 bg-white/5 hover:border-white/15 hover:shadow-lg hover:shadow-[#00F5FF]/5 cursor-pointer'
      }`}
      onClick={() => !connected && !isDisabled && handleConnect()}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 border border-white/5 group-hover:border-white/10 transition-colors">
          <config.Logo className="h-7 w-7" />
        </div>
        {connected && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Connected
          </span>
        )}
        {isDisabled && !connected && (
          <span className="inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/40">
            Coming soon
          </span>
        )}
      </div>

      <h3 className="text-sm font-semibold text-white/95 mb-1">{config.name}</h3>
      <p className="text-xs text-white/50 leading-relaxed mb-1">{config.description}</p>
      <p className="text-[10px] text-white/40 mb-3">{config.scopes}</p>

      {connected && (
        <div className="space-y-2">
          {email && (
            <p className="text-[10px] text-white/50">
              <span className="font-medium text-white/70">{email}</span>
            </p>
          )}
          {connectedAt && (
            <p className="text-[10px] text-white/40">
              Connected {new Date(connectedAt).toLocaleDateString()}
            </p>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); void handleDisconnect(); }}
            disabled={disconnecting}
            className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-medium text-white/50 hover:text-red-400 hover:border-red-500/30 disabled:opacity-50 transition-colors"
          >
            {disconnecting ? 'Disconnecting...' : 'Disconnect'}
          </button>
        </div>
      )}

      {!connected && !isDisabled && (
        <button
          onClick={(e) => { e.stopPropagation(); handleConnect(); }}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#00F5FF]/20 px-3 py-2 text-xs font-medium text-white hover:bg-[#00F5FF]/30 transition-colors"
        >
          <config.Logo className="h-4 w-4" />
          Connect {config.name}
        </button>
      )}

      {error && (
        <div className="mt-2 rounded-lg bg-red-500/10 border border-red-500/20 p-2">
          <p className="text-[10px] text-red-400">{error}</p>
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
        <h2 className="text-2xl font-bold text-white">Apps & MCP</h2>
        <p className="mt-1 text-sm text-white/50">
          Connect your advertising platforms and configure API access for MCP clients.
        </p>
      </div>

      {/* Platform Connectors Grid (Perplexity-style) */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-sm font-semibold text-white/95">Platform Connectors</h3>
          {connectedCount > 0 && (
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
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

      {/* Cloud Storage (OAuth redirect -- like Claude.ai / Perplexity) */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-sm font-semibold text-white/95">Cloud Storage</h3>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-white/50">
            OAuth
          </span>
        </div>
        <p className="text-xs text-white/50 mb-4">
          Connect cloud storage to import files directly into Plinth. One click -- no credentials needed.
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
