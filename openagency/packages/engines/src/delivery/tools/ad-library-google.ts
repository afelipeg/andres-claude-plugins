// ─── Google Ads Transparency Tool ────────────────────────────────────
// Fetches active ads from the Google Ads Transparency Center via SerpAPI.
//
// Google has no public REST API for ad transparency — the best available
// programmatic option is SerpAPI's Google Ads Transparency engine.
// Required env var: SERPAPI_KEY  (https://serpapi.com/google-ads-transparency-api)
// Results cached 24h via search-cache.ts.
//
// Fallback: if SERPAPI_KEY is not set, returns empty response (never throws).
// This keeps the Delivery Engine functional in dev/staging environments
// where competitive analysis from Google is optional.

import type { AdLibraryQuery, AdLibraryResponse, AdLibraryAd } from '@openagency/types';
import { buildCacheKey, cacheGet, cacheSet } from './search-cache.js';

const SERPAPI_BASE = 'https://serpapi.com/search.json';

// ─── Raw SerpAPI types ────────────────────────────────────────────────

interface SerpAdResult {
  advertiser_name?: string;
  creative_preview?: { headline?: string; description?: string };
  first_shown?: string;
  last_shown?: string;
  impressions?: string;
  ad_id?: string;
}

interface SerpApiResponse {
  ads_results?: SerpAdResult[];
  error?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function emptyResponse(advertiserName: string, reason: string): AdLibraryResponse {
  return {
    platform: 'google',
    advertiser_name: advertiserName,
    ads: [],
    total_count: 0,
    fetched_at: new Date().toISOString(),
    cached: false,
    // @ts-expect-error extended diagnostic field
    note: reason,
  };
}

// ─── Main export ──────────────────────────────────────────────────────

export async function fetchGoogleAds(query: AdLibraryQuery): Promise<AdLibraryResponse> {
  const cacheKey = buildCacheKey('google-ads', query);
  const cached = await cacheGet<AdLibraryResponse>(cacheKey);
  if (cached) return { ...cached, cached: true };

  const serpKey = process.env['SERPAPI_KEY'];
  if (!serpKey) {
    return emptyResponse(
      query.advertiser_name,
      'SERPAPI_KEY not set — skipping Google Ads Transparency lookup',
    );
  }

  const params = new URLSearchParams({
    engine: 'google_ads_transparency',
    api_key: serpKey,
    advertiser_name: query.advertiser_name,
    region: query.country?.toUpperCase() ?? 'US',
    num: String(Math.min(query.limit ?? 25, 100)),
  });

  const resp = await fetch(`${SERPAPI_BASE}?${params}`);

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    if (resp.status === 401 || resp.status === 403) {
      return emptyResponse(query.advertiser_name, `SerpAPI auth error (${resp.status})`);
    }
    throw new Error(`SerpAPI HTTP ${resp.status}: ${body}`);
  }

  const raw = (await resp.json()) as SerpApiResponse;

  if (raw.error) {
    return emptyResponse(query.advertiser_name, `SerpAPI error: ${raw.error}`);
  }

  const ads: AdLibraryAd[] = (raw.ads_results ?? []).map((ad, i) => ({
    id: ad.ad_id ?? `google-${i}`,
    advertiser_name: ad.advertiser_name ?? query.advertiser_name,
    ad_creative_body: ad.creative_preview?.description,
    ad_creative_link_title: ad.creative_preview?.headline,
    impressions: ad.impressions,
    ad_delivery_start_time: ad.first_shown,
    ad_delivery_stop_time: ad.last_shown,
    platforms: ['google'],
  }));

  const response: AdLibraryResponse = {
    platform: 'google',
    advertiser_name: query.advertiser_name,
    ads,
    total_count: ads.length,
    fetched_at: new Date().toISOString(),
    cached: false,
  };

  await cacheSet(cacheKey, response);
  return response;
}
