// ─── Platform Logos & Config (shared) ────────────────────────────────
// Used by IntegrationsPage and OnboardingPage

import type { ConnectorPlatform } from '@openagency/types';

// ─── Inline SVG Logos ────────────────────────────────────────────────

export function GoogleAdsLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M3.5 18.5l6-10.5 3 5.25-6 10.5z" fill="#FBBC04" />
      <path d="M14.5 3l6 10.5-3 5.25-6-10.5z" fill="#4285F4" />
      <circle cx="6.5" cy="19.5" r="2.5" fill="#34A853" />
    </svg>
  );
}

export function DV360Logo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="2" width="20" height="20" rx="4" fill="#00897B" />
      <text x="12" y="16" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold" fontFamily="sans-serif">DV</text>
    </svg>
  );
}

export function MetaLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z" fill="#1877F2" />
      <path d="M16.5 8.5c-1.5-1.5-3.5-.5-4.5 1l-1.5 2.5-1.5-2.5c-1-1.5-3-2.5-4.5-1C3 10 3.5 12 5 14l4 5.5c.5.7 1.5.7 2 0L15 14c1.5-2 2-4 1.5-5.5z" fill="white" />
    </svg>
  );
}

export function TikTokLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="2" width="20" height="20" rx="4" fill="#010101" />
      <path d="M16.5 7.5c-1-.8-1.7-2-1.8-3.5h-2.5v10.5c0 1.4-1.1 2.5-2.5 2.5s-2.5-1.1-2.5-2.5 1.1-2.5 2.5-2.5c.3 0 .5 0 .8.1V9.5c-.3 0-.5-.1-.8-.1C7 9.4 5 11.4 5 14s2 4.6 4.5 4.6c2.8 0 4.7-2 4.7-4.6V10c1 .7 2.2 1.2 3.5 1.2V8.8c-.5 0-1-.5-1.2-1.3z" fill="white" />
    </svg>
  );
}

export function TikTokShopLogo({ className }: { className?: string }) {
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

export function AmazonAdsLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="2" width="20" height="20" rx="4" fill="#FF9900" />
      <path d="M7 14c2.5 1.5 5.5 1.5 8 0" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <text x="12" y="12" textAnchor="middle" fill="white" fontSize="7" fontWeight="bold" fontFamily="sans-serif">a</text>
    </svg>
  );
}

// ─── Platform Config ─────────────────────────────────────────────────

export interface PlatformConfig {
  platform: ConnectorPlatform;
  name: string;
  description: string;
  Logo: React.ComponentType<{ className?: string }>;
  scopes: string;
  authMethod: 'oauth' | 'api_key' | 'both';
}

export const PLATFORMS: PlatformConfig[] = [
  {
    platform: 'google_ads',
    name: 'Google Ads',
    description: 'Search, Display, Shopping, and YouTube campaigns',
    Logo: GoogleAdsLogo,
    scopes: 'Campaign performance, ad groups, keywords, and conversion data',
    authMethod: 'both',
  },
  {
    platform: 'dv360',
    name: 'Display & Video 360',
    description: 'Programmatic display, video, and audio campaigns',
    Logo: DV360Logo,
    scopes: 'Insertion orders, line items, creatives, and audience data',
    authMethod: 'oauth',
  },
  {
    platform: 'meta_ads',
    name: 'Meta Ads',
    description: 'Facebook and Instagram campaigns and insights',
    Logo: MetaLogo,
    scopes: 'Ad accounts, campaigns, ad sets, ads, and performance insights',
    authMethod: 'both',
  },
  {
    platform: 'tiktok_ads',
    name: 'TikTok Ads',
    description: 'In-feed, TopView, and Spark Ads campaigns',
    Logo: TikTokLogo,
    scopes: 'Campaign data, ad groups, creatives, and audience reports',
    authMethod: 'both',
  },
  {
    platform: 'tiktok_shop',
    name: 'TikTok Shop',
    description: 'Shop orders, product performance, and sales data',
    Logo: TikTokShopLogo,
    scopes: 'Product catalog, orders, GMV, and shop analytics',
    authMethod: 'api_key',
  },
  {
    platform: 'amazon_ads',
    name: 'Amazon Ads',
    description: 'Sponsored Products, Brands, and Display campaigns',
    Logo: AmazonAdsLogo,
    scopes: 'Campaign metrics, keyword bids, ACOS, and attribution data',
    authMethod: 'both',
  },
];
