'use client';

import React, { createContext, useContext } from 'react';

export interface BrandPlatform {
  platform: string;
  advertiser_id: string;
  advertiser_name: string;
}

export interface FullBrand {
  id: string;
  name: string;
  platforms?: BrandPlatform[];
}

interface BrandContextValue {
  currentBrand: FullBrand | undefined;
  setCurrentBrand: (brand: FullBrand | undefined) => void;
}

const BrandCtx = createContext<BrandContextValue>({
  currentBrand: undefined,
  setCurrentBrand: () => {},
});

export function BrandProvider({
  currentBrand,
  setCurrentBrand,
  children,
}: {
  currentBrand: FullBrand | undefined;
  setCurrentBrand: (brand: FullBrand | undefined) => void;
  children: React.ReactNode;
}) {
  return (
    <BrandCtx.Provider value={{ currentBrand, setCurrentBrand }}>
      {children}
    </BrandCtx.Provider>
  );
}

export function useBrandContext() {
  return useContext(BrandCtx);
}

/** Serialize brand context for the system prompt */
export function serializeBrandContext(brand: FullBrand): string {
  const lines = [`Brand: ${brand.name}`];
  if (brand.platforms && brand.platforms.length > 0) {
    lines.push('Active platform accounts:');
    for (const p of brand.platforms) {
      lines.push(`- ${p.platform}: advertiser_id=${p.advertiser_id} (${p.advertiser_name})`);
    }
    lines.push('');
    lines.push('Use these advertiser IDs when querying platform data for this brand.');
    lines.push('All engine analysis should be scoped to this brand across the connected platforms.');
  }
  return lines.join('\n');
}
