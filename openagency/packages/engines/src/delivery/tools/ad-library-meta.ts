// ─── Meta Ad Library Tool ────────────────────────────────────────────
// Fetches active ads from Facebook Graph API: ads_archive endpoint.
// Required env var: META_ACCESS_TOKEN
//   (Facebook user or app token with `ads_read` permission)
// Results cached 24h via search-cache.ts.
//
// API docs: https://developers.facebook.com/docs/marketing-api/reference/ad-archive/
// Rate limits: 200 req/hour per user token at Development tier.

import type { AdLibraryQuery, AdLibraryResponse, AdLibraryAd } from '@openagency/types';
import { buildCacheKey, cacheGet, cacheSet } from './search-cache.js';

const META_API_VERSION = 'v21.0';
const META_BASE = `https://graph.facebook.com/${META_API_VERSION}/ads_archive`;

const META_FIELDS = [
  'id',
  'ad_creative_bodies',
  'ad_creative_link_titles',
  'impressions',
  'spend',
  'currency',
  'ad_delivery_start_time',
  'ad_delivery_stop_time',
  'publisher_platforms',
].join(',');

// ─── Raw API types ────────────────────────────────────────────────────

interface MetaAdRaw {
  id: string;
  ad_creative_bodies?: string[];
  ad_creative_link_titles?: string[];
  impressions?: { lower_bound?: number; upper_bound?: number };
  spend?: { lower_bound?: number; upper_bound?: number };
  currency?: string;
  ad_delivery_start_time?: string;
  ad_delivery_stop_time?: string;
  publisher_platforms?: string[];
}

interface MetaApiResponse {
  data?: MetaAdRaw[];
  paging?: { cursors?: { after?: string }; next?: string };
  error?: { message: string; code: number };
}

// ─── Helpers ─────────────────────────────────────────────────────────

function mapRange(r?: { lower_bound?: number; upper_bound?: number }): string | undefined {
  if (!r || r.lower_bound == null) return undefined;
  return r.upper_bound != null
    ? `${r.lower_bound}–${r.upper_bound}`
    : `${r.lower_bound}+`;
}

function emptyResponse(advertiserName: string, reason: string): AdLibraryResponse {
  return {
    platform: 'meta',
    advertiser_name: advertiserName,
    ads: [],
    total_count: 0,
    fetched_at: new Date().toISOString(),
    cached: false,
    // @ts-expect-error extended field for diagnostics
    note: reason,
  };
}

// ─── Main export ──────────────────────────────────────────────────────

export async function fetchMetaAds(query: AdLibraryQuery): Promise<AdLibraryResponse> {
  const cacheKey = buildCacheKey('meta-ads', query);
  const cached = await cacheGet<AdLibraryResponse>(cacheKey);
  if (cached) return { ...cached, cached: true };

  const token = process.env['META_ACCESS_TOKEN'];
  if (!token) {
    return emptyResponse(
      query.advertiser_name,
      'META_ACCESS_TOKEN not set — skipping Meta Ad Library lookup',
    );
  }

  const adType = query.ad_type
    ? query.ad_type === 'all' ? 'ALL' : query.ad_type.toUpperCase()
    : 'ALL';

  const params = new URLSearchParams({
    access_token: token,
    search_type: 'KEYWORD_UNORDERED',
    search_terms: query.advertiser_name,
    ad_type: adType,
    ad_reached_countries: JSON.stringify([query.country?.toUpperCase() ?? 'US']),
    fields: META_FIELDS,
    limit: String(Math.min(query.limit ?? 25, 100)),
  });

  const resp = await fetch(`${META_BASE}?${params}`);

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    // Auth errors → return empty rather than throw (missing token is expected in dev)
    if (resp.status === 401 || resp.status === 403) {
      return emptyResponse(query.advertiser_name, `Auth error (${resp.status}): ${body}`);
    }
    throw new Error(`Meta Ad Library API HTTP ${resp.status}: ${body}`);
  }

  const raw = (await resp.json()) as MetaApiResponse;

  if (raw.error) {
    return emptyResponse(
      query.advertiser_name,
      `Meta API error ${raw.error.code}: ${raw.error.message}`,
    );
  }

  const ads: AdLibraryAd[] = (raw.data ?? []).map(ad => ({
    id: ad.id,
    advertiser_name: query.advertiser_name,
    ad_creative_body: ad.ad_creative_bodies?.[0],
    ad_creative_link_title: ad.ad_creative_link_titles?.[0],
    impressions: mapRange(ad.impressions),
    spend: mapRange(ad.spend),
    currency: ad.currency,
    ad_delivery_start_time: ad.ad_delivery_start_time,
    ad_delivery_stop_time: ad.ad_delivery_stop_time,
    platforms: ad.publisher_platforms,
  }));

  const response: AdLibraryResponse = {
    platform: 'meta',
    advertiser_name: query.advertiser_name,
    ads,
    total_count: ads.length,
    fetched_at: new Date().toISOString(),
    cached: false,
  };

  await cacheSet(cacheKey, response);
  return response;
}
