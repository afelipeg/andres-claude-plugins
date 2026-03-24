'use client';

import { useState, useCallback, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Loader2, Upload, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

interface PlatformConfig {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

interface ConnectDialogProps {
  platform: PlatformConfig;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected: () => void;
}

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

/* -------------------------------------------------------------------------- */
/*  Auth config — all 6 platforms                                             */
/* -------------------------------------------------------------------------- */

const AGENCY_AUTH_CONFIG: Record<string, { types: ConnectionTypeConfig[] }> = {
  google_ads: {
    types: [
      {
        value: 'mcc',
        label: 'MCC (Manager)',
        fields: [
          { key: 'developer_token', label: 'Developer Token', type: 'password', required: true, help: 'Google Ads > Admin > API Center' },
          { key: 'client_id', label: 'OAuth Client ID', type: 'text', required: true, help: 'Google Cloud Console > Credentials' },
          { key: 'client_secret', label: 'OAuth Client Secret', type: 'password', required: true, help: 'Google Cloud Console > Credentials' },
          { key: 'refresh_token', label: 'Refresh Token', type: 'password', required: true, help: 'OAuth Playground', link: 'https://developers.google.com/oauthplayground' },
          { key: 'login_customer_id', label: 'MCC ID', type: 'text', required: true, help: 'MCC ID without dashes (login-customer-id header)' },
        ],
      },
      {
        value: 'direct',
        label: 'Direct Account',
        fields: [
          { key: 'developer_token', label: 'Developer Token', type: 'password', required: true, help: 'Google Ads > Admin > API Center' },
          { key: 'client_id', label: 'OAuth Client ID', type: 'text', required: true, help: 'Google Cloud Console > Credentials' },
          { key: 'client_secret', label: 'OAuth Client Secret', type: 'password', required: true, help: 'Google Cloud Console > Credentials' },
          { key: 'refresh_token', label: 'Refresh Token', type: 'password', required: true, help: 'OAuth Playground' },
        ],
      },
    ],
  },
  meta_ads: {
    types: [
      {
        value: 'system_user',
        label: 'System User',
        fields: [
          { key: 'business_manager_id', label: 'Business Manager ID', type: 'text', required: true, help: 'Meta Business Suite > Settings > Business Info' },
          { key: 'app_id', label: 'App ID', type: 'text', required: true, help: 'Meta Developers > App Settings' },
          { key: 'app_secret', label: 'App Secret', type: 'password', required: true, help: 'Meta Developers > App Settings' },
          { key: 'system_user_token', label: 'System User Token', type: 'password', required: true, help: 'BM > System Users > Generate Token (never expires)' },
        ],
      },
      {
        value: 'oauth_user',
        label: 'OAuth User',
        fields: [
          { key: 'business_manager_id', label: 'Business Manager ID', type: 'text', required: true, help: 'Meta Business Suite > Settings > Business Info' },
          { key: 'app_id', label: 'App ID', type: 'text', required: true, help: 'Meta Developers > App Settings' },
          { key: 'app_secret', label: 'App Secret', type: 'password', required: true, help: 'Meta Developers > App Settings' },
          { key: 'access_token', label: 'User Access Token', type: 'password', required: true, help: 'Graph API Explorer (60-day expiry)' },
        ],
      },
    ],
  },
  dv360: {
    types: [
      {
        value: 'oauth2',
        label: 'OAuth2',
        fields: [
          { key: 'client_id', label: 'OAuth Client ID', type: 'text', required: true, help: 'Google Cloud Console > Credentials' },
          { key: 'client_secret', label: 'OAuth Client Secret', type: 'password', required: true, help: 'Google Cloud Console > Credentials' },
          { key: 'refresh_token', label: 'Refresh Token', type: 'password', required: true, help: 'OAuth Playground' },
          { key: 'partner_id', label: 'Partner ID (Seat)', type: 'text', required: true, help: 'DV360 URL: /partner/XXXXXXXXX' },
        ],
      },
      {
        value: 'service_account',
        label: 'Service Account',
        fields: [
          { key: 'service_account_json', label: 'Service Account JSON', type: 'textarea', required: true, help: 'Google Cloud > IAM > Service Accounts > Keys' },
          { key: 'partner_id', label: 'Partner ID (Seat)', type: 'text', required: true, help: 'DV360 URL: /partner/XXXXXXXXX' },
        ],
      },
    ],
  },
  tiktok_ads: {
    types: [
      {
        value: 'business_center',
        label: 'Business Center',
        fields: [
          { key: 'bc_id', label: 'Business Center ID', type: 'text', required: true, help: 'TikTok Business Center > Settings > BC ID' },
          { key: 'app_id', label: 'App ID', type: 'text', required: true, help: 'TikTok Marketing API > My Apps' },
          { key: 'app_secret', label: 'App Secret', type: 'password', required: true, help: 'TikTok Marketing API > My Apps' },
          { key: 'access_token', label: 'Access Token', type: 'password', required: true, help: 'Long-lived token from TikTok Business' },
        ],
      },
      {
        value: 'direct',
        label: 'Direct Advertiser',
        fields: [
          { key: 'app_id', label: 'App ID', type: 'text', required: true, help: 'TikTok Marketing API > My Apps' },
          { key: 'app_secret', label: 'App Secret', type: 'password', required: true, help: 'TikTok Marketing API > My Apps' },
          { key: 'access_token', label: 'Access Token', type: 'password', required: true, help: 'Long-lived token from TikTok Business' },
        ],
      },
    ],
  },
  tiktok_shop: {
    types: [
      {
        value: 'direct',
        label: 'Direct',
        fields: [
          { key: 'app_key', label: 'App Key', type: 'text', required: true, help: 'TikTok Partner Center > My Apps' },
          { key: 'app_secret', label: 'App Secret', type: 'password', required: true, help: 'TikTok Partner Center > My Apps' },
          { key: 'access_token', label: 'Access Token', type: 'password', required: true, help: 'Via Partner Center OAuth' },
          { key: 'shop_id', label: 'Shop ID', type: 'text', required: true, help: 'TikTok Seller Center > Settings' },
        ],
      },
    ],
  },
  amazon_ads: {
    types: [
      {
        value: 'agency',
        label: 'Agency Account',
        fields: [
          { key: 'client_id', label: 'LwA Client ID', type: 'text', required: true, help: 'Amazon Developer Console' },
          { key: 'client_secret', label: 'LwA Client Secret', type: 'password', required: true, help: 'Amazon Developer Console' },
          { key: 'refresh_token', label: 'Refresh Token', type: 'password', required: true, help: 'Initial OAuth authorization' },
          {
            key: 'region', label: 'Region', type: 'select', required: true, options: [
              { value: 'na', label: 'North America (NA)' },
              { value: 'eu', label: 'Europe (EU)' },
              { value: 'fe', label: 'Far East (FE)' },
            ],
          },
        ],
      },
      {
        value: 'direct',
        label: 'Direct Account',
        fields: [
          { key: 'client_id', label: 'LwA Client ID', type: 'text', required: true, help: 'Amazon Developer Console' },
          { key: 'client_secret', label: 'LwA Client Secret', type: 'password', required: true, help: 'Amazon Developer Console' },
          { key: 'refresh_token', label: 'Refresh Token', type: 'password', required: true, help: 'Initial OAuth authorization' },
          {
            key: 'region', label: 'Region', type: 'select', required: true, options: [
              { value: 'na', label: 'North America (NA)' },
              { value: 'eu', label: 'Europe (EU)' },
              { value: 'fe', label: 'Far East (FE)' },
            ],
          },
        ],
      },
    ],
  },
};

/* -------------------------------------------------------------------------- */
/*  Auth helper                                                               */
/* -------------------------------------------------------------------------- */

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  const lsToken = localStorage.getItem('plinth_token');
  if (lsToken) return lsToken;
  const match = document.cookie.match(/(?:^|;\s*)plinth_token=([^;]*)/);
  return match ? match[1] : null;
}

/* -------------------------------------------------------------------------- */
/*  PasswordInput — toggle visibility                                         */
/* -------------------------------------------------------------------------- */

function PasswordInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 pr-9 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
        aria-label={visible ? 'Hide value' : 'Show value'}
      >
        {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  ConnectDialog                                                             */
/* -------------------------------------------------------------------------- */

export function ConnectDialog({
  platform,
  open,
  onOpenChange,
  onConnected,
}: ConnectDialogProps) {
  const agencyCfg = AGENCY_AUTH_CONFIG[platform.id];
  const types = agencyCfg?.types ?? [];

  const [connectionType, setConnectionType] = useState(types[0]?.value ?? '');
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeType = types.find((t) => t.value === connectionType);
  const fields = activeType?.fields ?? [];

  /* ------ Reset state when dialog opens or connection type changes ------ */
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        setConnectionType(types[0]?.value ?? '');
        setFieldValues({});
        setFieldErrors([]);
        setError(null);
        setSaving(false);
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange, types],
  );

  const handleConnectionTypeChange = useCallback((value: string) => {
    setConnectionType(value);
    setFieldValues({});
    setFieldErrors([]);
    setError(null);
  }, []);

  const setField = useCallback((key: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [key]: value }));
    setFieldErrors([]);
    setError(null);
  }, []);

  /* ------ JSON file upload for service_account_json ------ */
  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        // Validate it's valid JSON
        try {
          JSON.parse(text);
          setField('service_account_json', text);
        } catch {
          setError('Invalid JSON file. Please upload a valid service account JSON.');
        }
      };
      reader.readAsText(file);
      // Reset file input so the same file can be re-selected
      e.target.value = '';
    },
    [setField],
  );

  /* ------ Submit ------ */
  const handleSubmit = useCallback(async () => {
    // Validate required fields
    const missing = fields
      .filter((f) => f.required && !fieldValues[f.key]?.trim())
      .map((f) => f.label);

    if (missing.length > 0) {
      setFieldErrors(missing);
      return;
    }

    const token = getAuthToken();
    if (!token) {
      setError('Authentication token not found. Please log in again.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const credentials: Record<string, string> = {};
      for (const f of fields) {
        const val = fieldValues[f.key]?.trim();
        if (val) credentials[f.key] = val;
      }

      const res = await fetch('/api/v1/agency/connections', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          platform: platform.id,
          connection_type: connectionType,
          credentials,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string; error?: string };
        throw new Error(body.message || body.error || `Connection failed (HTTP ${res.status})`);
      }

      onConnected();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save credentials');
    } finally {
      setSaving(false);
    }
  }, [fields, fieldValues, platform.id, connectionType, onConnected]);

  /* ------ Derived state ------ */
  const allRequiredFilled = fields
    .filter((f) => f.required)
    .every((f) => fieldValues[f.key]?.trim());

  const PlatformIcon = platform.icon;

  /* ------ Render ------ */
  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl shadow-black/30 p-0 focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
          {/* ---- Header ---- */}
          <div className="p-5 border-b border-zinc-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-lg',
                    platform.color,
                  )}
                >
                  <PlatformIcon className="h-4.5 w-4.5" />
                </div>
                <div>
                  <Dialog.Title className="text-base font-semibold text-zinc-100">
                    Connect {platform.name}
                  </Dialog.Title>
                  <Dialog.Description className="text-xs text-zinc-400 mt-0.5">
                    Enter your API credentials to connect
                  </Dialog.Description>
                </div>
              </div>
              <Dialog.Close asChild>
                <button
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>
          </div>

          {/* ---- Body ---- */}
          <div className="p-5 space-y-4">
            {/* Connection type selector */}
            {types.length > 1 && (
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">
                  Connection Type
                </label>
                <div className="flex gap-2">
                  {types.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => handleConnectionTypeChange(t.value)}
                      className={cn(
                        'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                        connectionType === t.value
                          ? 'bg-zinc-800 text-zinc-100 border border-zinc-600'
                          : 'text-zinc-500 hover:text-zinc-300 border border-transparent hover:border-zinc-700',
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Dynamic fields */}
            {fields.map((field) => (
              <div key={field.key}>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  {field.label}
                  {field.required && <span className="text-red-400 ml-0.5">*</span>}
                </label>

                {field.type === 'select' && field.options ? (
                  <select
                    value={fieldValues[field.key] ?? ''}
                    onChange={(e) => setField(field.key, e.target.value)}
                    className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500 transition-colors"
                  >
                    <option value="">Select...</option>
                    {field.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                ) : field.type === 'textarea' ? (
                  <div className="space-y-2">
                    <textarea
                      value={fieldValues[field.key] ?? ''}
                      onChange={(e) => setField(field.key, e.target.value)}
                      placeholder={field.help}
                      rows={5}
                      className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors font-mono text-xs min-h-[120px] resize-y"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors"
                    >
                      <Upload className="h-3 w-3" />
                      Upload JSON file
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json,application/json"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>
                ) : field.type === 'password' ? (
                  <PasswordInput
                    value={fieldValues[field.key] ?? ''}
                    onChange={(v) => setField(field.key, v)}
                    placeholder={field.help}
                  />
                ) : (
                  <input
                    type="text"
                    value={fieldValues[field.key] ?? ''}
                    onChange={(e) => setField(field.key, e.target.value)}
                    placeholder={field.help}
                    className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
                  />
                )}

                {field.help && (
                  <p className="mt-1 text-[10px] text-zinc-500">
                    {field.help}
                    {field.link && (
                      <>
                        {' '}
                        <a
                          href={field.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-400 hover:underline"
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
              <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2">
                <p className="text-xs text-red-400">
                  Missing required fields: {fieldErrors.join(', ')}
                </p>
              </div>
            )}

            {/* API error */}
            {error && (
              <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2">
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            {/* Security note */}
            <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 flex items-start gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-emerald-400/80 leading-relaxed">
                Credentials are encrypted with AES-256-GCM and stored securely. Plinth only reads campaign data for selected advertisers.
              </p>
            </div>
          </div>

          {/* ---- Footer ---- */}
          <div className="p-4 border-t border-zinc-800 flex items-center justify-between">
            <Dialog.Close asChild>
              <button className="text-zinc-400 hover:text-zinc-200 text-sm transition-colors">
                Cancel
              </button>
            </Dialog.Close>

            <button
              onClick={() => void handleSubmit()}
              disabled={saving || !allRequiredFilled}
              className={cn(
                'bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors inline-flex items-center gap-2',
                (saving || !allRequiredFilled) && 'opacity-60 cursor-not-allowed',
              )}
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {saving ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
