'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ChevronDown, Search, Check, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BrandPlatform {
  platform: string;
  advertiser_id: string;
  advertiser_name: string;
}

interface Brand {
  id: string;
  name: string;
  platforms?: string[];
  /** Full platform data for engine context */
  _rawPlatforms?: BrandPlatform[];
}

interface FullBrand {
  id: string;
  name: string;
  platforms?: BrandPlatform[];
}

interface BrandSelectorProps {
  currentBrand?: { id: string; name: string };
  onSelect: (brand: FullBrand) => void;
}

const PLATFORM_COLORS: Record<string, string> = {
  google_ads: 'bg-blue-500',
  meta_ads: 'bg-indigo-500',
  dv360: 'bg-green-500',
  tiktok_ads: 'bg-pink-500',
  google: 'bg-blue-500',
  meta: 'bg-indigo-500',
  facebook: 'bg-indigo-500',
  tiktok: 'bg-pink-500',
  linkedin: 'bg-sky-600',
  twitter: 'bg-zinc-400',
  snapchat: 'bg-yellow-400',
};

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  const lsToken = localStorage.getItem('plinth_token');
  if (lsToken) return lsToken;
  const match = document.cookie.match(/(?:^|;\s*)plinth_token=([^;]*)/);
  return match ? match[1] : null;
}

export function BrandSelector({ currentBrand, onSelect }: BrandSelectorProps) {
  const [open, setOpen] = useState(false);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Fetch brands
  const fetchBrands = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/v1/agency/brands', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch brands');
      const data = await res.json();
      const raw = Array.isArray(data) ? data : data.brands ?? data.data ?? [];
      const brandList: Brand[] = raw.map((b: { id: string; name: string; platforms?: BrandPlatform[] }) => ({
        id: b.id,
        name: b.name,
        platforms: b.platforms?.map((p) => p.platform),
        _rawPlatforms: b.platforms,
      }));
      setBrands(brandList);
    } catch {
      // Fallback: empty list
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBrands();
  }, [fetchBrands]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Focus search on open
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open]);

  const filtered = useMemo(() => {
    if (!search.trim()) return brands;
    const q = search.toLowerCase();
    return brands.filter((b) => b.name.toLowerCase().includes(q));
  }, [brands, search]);

  const handleSelect = (brand: Brand) => {
    onSelect({ id: brand.id, name: brand.name, platforms: brand._rawPlatforms });
    setOpen(false);
    setSearch('');
  };

  return (
    <div ref={popoverRef} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-left transition-colors hover:bg-zinc-800',
          open && 'border-zinc-600 bg-zinc-800'
        )}
      >
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-violet-500 to-pink-500 text-[10px] font-bold text-white flex-shrink-0">
          {currentBrand ? currentBrand.name.charAt(0).toUpperCase() : '?'}
        </div>
        <span className="flex-1 truncate text-sm text-foreground">
          {currentBrand?.name ?? 'Select brand'}
        </span>
        <ChevronDown className={cn('h-4 w-4 text-zinc-500 transition-transform', open && 'rotate-180')} />
      </button>

      {/* Popover */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl shadow-black/30 overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-zinc-800">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search brands..."
                className="w-full rounded-md border border-zinc-700 bg-zinc-950 pl-8 pr-3 py-1.5 text-sm text-foreground placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600"
              />
            </div>
          </div>

          {/* Brand list */}
          <div className="max-h-64 overflow-y-auto py-1">
            {loading && (
              <div className="px-3 py-4 text-center text-sm text-zinc-500">Loading brands...</div>
            )}

            {!loading && filtered.length === 0 && (
              <div className="px-3 py-4 text-center">
                <Building2 className="mx-auto h-6 w-6 text-zinc-700 mb-1" />
                <p className="text-sm text-zinc-500">
                  {search ? 'No matching brands' : 'No brands found'}
                </p>
              </div>
            )}

            {!loading &&
              filtered.map((brand) => {
                const isActive = currentBrand?.id === brand.id;
                return (
                  <button
                    key={brand.id}
                    onClick={() => handleSelect(brand)}
                    className={cn(
                      'flex w-full items-center gap-3 px-3 py-2 text-left transition-colors',
                      isActive ? 'bg-zinc-800 text-foreground' : 'text-zinc-300 hover:bg-zinc-800/50'
                    )}
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-800 border border-zinc-700 text-xs font-semibold text-foreground flex-shrink-0">
                      {brand.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{brand.name}</div>
                      {brand.platforms && brand.platforms.length > 0 && (
                        <div className="flex items-center gap-1 mt-0.5">
                          {brand.platforms.map((platform) => (
                            <div
                              key={platform}
                              className={cn(
                                'h-1.5 w-1.5 rounded-full',
                                PLATFORM_COLORS[platform.toLowerCase()] ?? 'bg-zinc-500'
                              )}
                              title={platform}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                    {isActive && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
                  </button>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
