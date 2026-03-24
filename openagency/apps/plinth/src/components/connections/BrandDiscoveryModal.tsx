'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Search, X, Loader2, Building2, CheckSquare, Square, Check } from 'lucide-react';
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

interface DiscoveredAccount {
  id: string;
  name: string;
  status?: string;
  currency?: string;
  timezone?: string;
}

interface BrandDiscoveryModalProps {
  platform: PlatformConfig;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

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
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

export function BrandDiscoveryModal({
  platform,
  open,
  onOpenChange,
  onSaved,
}: BrandDiscoveryModalProps) {
  const [accounts, setAccounts] = useState<DiscoveredAccount[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [preExistingIds, setPreExistingIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  /* ---------------------------------------------------------------------- */
  /*  Fetch accounts + existing advertisers when modal opens                 */
  /* ---------------------------------------------------------------------- */

  const fetchData = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setError('Authentication token not found. Please log in again.');
      return;
    }

    setLoading(true);
    setError(null);
    setAccounts([]);
    setSelectedIds(new Set());
    setPreExistingIds(new Set());
    setSearch('');

    try {
      const headers = { Authorization: `Bearer ${token}` };

      const [subAccountsRes, advertisersRes] = await Promise.all([
        fetch(`/api/v1/agency/connections/${platform.id}/sub-accounts`, { headers }),
        fetch(`/api/v1/agency/connections/${platform.id}/advertisers`, { headers }),
      ]);

      if (!subAccountsRes.ok) {
        throw new Error(
          `Failed to discover accounts (${subAccountsRes.status})`
        );
      }

      const subAccountsJson = await subAccountsRes.json();
      const accountList: DiscoveredAccount[] = Array.isArray(subAccountsJson)
        ? subAccountsJson
        : subAccountsJson.accounts ??
          subAccountsJson.data ??
          subAccountsJson.sub_accounts ??
          [];

      setAccounts(accountList);

      // Parse already-selected advertisers
      let existingIds = new Set<string>();
      if (advertisersRes.ok) {
        const advertisersJson = await advertisersRes.json();
        const existingList: Array<{ id: string } | string> = Array.isArray(advertisersJson)
          ? advertisersJson
          : advertisersJson.advertisers ??
            advertisersJson.data ??
            [];

        existingIds = new Set(
          existingList.map((item) =>
            typeof item === 'string' ? item : item.id
          )
        );
      }

      setPreExistingIds(existingIds);
      setSelectedIds(new Set(existingIds));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to discover accounts'
      );
    } finally {
      setLoading(false);
    }
  }, [platform.id]);

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open, fetchData]);

  // Focus search input after loading completes
  useEffect(() => {
    if (open && !loading && !error && accounts.length > 0) {
      setTimeout(() => searchRef.current?.focus(), 80);
    }
  }, [open, loading, error, accounts.length]);

  /* ---------------------------------------------------------------------- */
  /*  Filtering                                                              */
  /* ---------------------------------------------------------------------- */

  const filtered = useMemo(() => {
    if (!search.trim()) return accounts;
    const q = search.toLowerCase();
    return accounts.filter(
      (a) =>
        a.name.toLowerCase().includes(q) || a.id.toLowerCase().includes(q)
    );
  }, [accounts, search]);

  /* ---------------------------------------------------------------------- */
  /*  Selection helpers                                                      */
  /* ---------------------------------------------------------------------- */

  const toggleAccount = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAllVisible = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const a of filtered) {
        next.add(a.id);
      }
      return next;
    });
  }, [filtered]);

  const deselectAllVisible = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const filteredIds = new Set(filtered.map((a) => a.id));
      for (const id of filteredIds) {
        next.delete(id);
      }
      return next;
    });
  }, [filtered]);

  const allVisibleSelected = useMemo(
    () => filtered.length > 0 && filtered.every((a) => selectedIds.has(a.id)),
    [filtered, selectedIds]
  );

  /* ---------------------------------------------------------------------- */
  /*  Save logic                                                             */
  /* ---------------------------------------------------------------------- */

  const handleSave = useCallback(async () => {
    const token = getAuthToken();
    if (!token) return;

    setSaving(true);
    setError(null);

    try {
      const headers: HeadersInit = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      // Newly selected accounts (not previously saved)
      const toAdd = [...selectedIds].filter((id) => !preExistingIds.has(id));
      // Previously saved accounts that have been deselected
      const toRemove = [...preExistingIds].filter(
        (id) => !selectedIds.has(id)
      );

      const promises: Promise<Response>[] = [];

      // POST new advertisers
      if (toAdd.length > 0) {
        promises.push(
          fetch(`/api/v1/agency/connections/${platform.id}/advertisers`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ advertisers: toAdd }),
          })
        );
      }

      // DELETE removed advertisers
      for (const advertiserId of toRemove) {
        promises.push(
          fetch(
            `/api/v1/agency/connections/${platform.id}/advertisers/${advertiserId}`,
            { method: 'DELETE', headers }
          )
        );
      }

      const results = await Promise.all(promises);

      // Check for any failures
      const failed = results.filter((r) => !r.ok);
      if (failed.length > 0) {
        throw new Error(
          `${failed.length} operation(s) failed. Please try again.`
        );
      }

      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to save brand selections'
      );
    } finally {
      setSaving(false);
    }
  }, [selectedIds, preExistingIds, platform.id, onSaved, onOpenChange]);

  /* ---------------------------------------------------------------------- */
  /*  Render                                                                 */
  /* ---------------------------------------------------------------------- */

  const PlatformIcon = platform.icon;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl shadow-black/30 p-0 focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
          {/* ---- Header ---- */}
          <div className="p-5 border-b border-zinc-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-lg',
                    platform.color
                  )}
                >
                  <PlatformIcon className="h-4.5 w-4.5" />
                </div>
                <div>
                  <Dialog.Title className="text-base font-semibold text-zinc-100">
                    Discover Brands
                  </Dialog.Title>
                  <Dialog.Description className="text-xs text-zinc-400 mt-0.5">
                    {platform.name}
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

            {/* Counter */}
            {!loading && !error && accounts.length > 0 && (
              <p className="text-xs text-zinc-500 mt-3">
                <span className="text-zinc-300 font-medium">
                  {selectedIds.size}
                </span>{' '}
                of{' '}
                <span className="text-zinc-300 font-medium">
                  {accounts.length}
                </span>{' '}
                selected
              </p>
            )}
          </div>

          {/* ---- Loading state ---- */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="h-6 w-6 text-zinc-500 animate-spin" />
              <p className="text-sm text-zinc-500">
                Discovering accounts...
              </p>
            </div>
          )}

          {/* ---- Error state ---- */}
          {!loading && error && (
            <div className="p-6">
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-center">
                <p className="text-sm text-red-400">{error}</p>
                <button
                  onClick={fetchData}
                  className="mt-3 text-xs text-zinc-400 hover:text-zinc-200 underline underline-offset-2 transition-colors"
                >
                  Try again
                </button>
              </div>
            </div>
          )}

          {/* ---- Empty state ---- */}
          {!loading && !error && accounts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <Building2 className="h-8 w-8 text-zinc-700" />
              <p className="text-sm text-zinc-500">
                No advertisers found for this platform
              </p>
            </div>
          )}

          {/* ---- Content: search + list ---- */}
          {!loading && !error && accounts.length > 0 && (
            <>
              {/* Search */}
              <div className="p-3 border-b border-zinc-800">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
                  <input
                    ref={searchRef}
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search accounts..."
                    className="w-full rounded-md border border-zinc-700 bg-zinc-950 pl-8 pr-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Select All / Deselect All */}
                <div className="flex items-center gap-3 mt-2">
                  <button
                    onClick={selectAllVisible}
                    disabled={allVisibleSelected}
                    className={cn(
                      'text-xs transition-colors',
                      allVisibleSelected
                        ? 'text-zinc-600 cursor-default'
                        : 'text-zinc-400 hover:text-zinc-200'
                    )}
                  >
                    Select All
                    {search && filtered.length !== accounts.length && (
                      <span className="text-zinc-600 ml-1">
                        ({filtered.length})
                      </span>
                    )}
                  </button>
                  <span className="text-zinc-700">|</span>
                  <button
                    onClick={deselectAllVisible}
                    className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                  >
                    Deselect All
                    {search && filtered.length !== accounts.length && (
                      <span className="text-zinc-600 ml-1">
                        ({filtered.length})
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Account list */}
              <div className="max-h-[400px] overflow-y-auto">
                {filtered.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-10 gap-2">
                    <Search className="h-5 w-5 text-zinc-700" />
                    <p className="text-sm text-zinc-500">
                      No accounts match &ldquo;{search}&rdquo;
                    </p>
                  </div>
                )}

                {filtered.map((account) => {
                  const isChecked = selectedIds.has(account.id);
                  const isInactive =
                    account.status &&
                    account.status.toLowerCase() !== 'active' &&
                    account.status.toLowerCase() !== 'enabled';

                  return (
                    <button
                      key={account.id}
                      type="button"
                      onClick={() => toggleAccount(account.id)}
                      className="w-full px-4 py-2.5 hover:bg-zinc-800/50 cursor-pointer flex items-center gap-3 text-left transition-colors group"
                    >
                      {/* Checkbox */}
                      <div
                        className={cn(
                          'h-4 w-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors',
                          isChecked
                            ? 'bg-emerald-500 border-emerald-500'
                            : 'border-zinc-600 group-hover:border-zinc-500'
                        )}
                      >
                        {isChecked && (
                          <Check className="h-3 w-3 text-white" />
                        )}
                      </div>

                      {/* Account info */}
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            'text-sm font-medium truncate',
                            isChecked ? 'text-zinc-100' : 'text-zinc-300'
                          )}
                        >
                          {account.name}
                        </p>
                        <p className="text-xs text-zinc-500 truncate mt-0.5">
                          {account.id}
                          {account.currency && (
                            <span className="ml-2">{account.currency}</span>
                          )}
                          {account.timezone && (
                            <span className="ml-2">{account.timezone}</span>
                          )}
                        </p>
                      </div>

                      {/* Status badge for inactive accounts */}
                      {isInactive && (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium bg-amber-500/15 text-amber-400 flex-shrink-0">
                          {account.status}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* ---- Footer ---- */}
          {!loading && !error && accounts.length > 0 && (
            <div className="p-4 border-t border-zinc-800 flex items-center justify-between">
              <Dialog.Close asChild>
                <button className="text-zinc-400 hover:text-zinc-200 text-sm transition-colors">
                  Cancel
                </button>
              </Dialog.Close>

              <button
                onClick={handleSave}
                disabled={saving}
                className={cn(
                  'bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors inline-flex items-center gap-2',
                  saving && 'opacity-70 cursor-not-allowed'
                )}
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save {selectedIds.size} brand{selectedIds.size !== 1 ? 's' : ''}
              </button>
            </div>
          )}

          {/* Footer for error/empty states - just a close button */}
          {!loading && (error || accounts.length === 0) && (
            <div className="p-4 border-t border-zinc-800 flex items-center justify-end">
              <Dialog.Close asChild>
                <button className="text-zinc-400 hover:text-zinc-200 text-sm transition-colors">
                  Close
                </button>
              </Dialog.Close>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
