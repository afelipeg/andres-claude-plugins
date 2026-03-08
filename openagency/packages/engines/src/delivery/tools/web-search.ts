// ─── Web Search Tool ─────────────────────────────────────────────────
// Wrapper over Brave Search API.
// Optional env var: BRAVE_SEARCH_API_KEY
// If not set, returns empty results with a note (graceful — skill decides
// whether to treat this as a hard failure or continue without web data).
// Results cached 24h via search-cache.ts (Map → Redis).

import type { WebSearchQuery, WebSearchResponse, WebSearchResult } from '@openagency/types';
import { buildCacheKey, cacheGet, cacheSet } from './search-cache.js';

const BRAVE_BASE = 'https://api.search.brave.com/res/v1/web/search';
const MAX_RESULTS = 20; // Brave Search API maximum per request

const FRESHNESS_MAP: Record<NonNullable<WebSearchQuery['freshness']>, string> = {
  day: 'pd',
  week: 'pw',
  month: 'pm',
};

// ─── Raw Brave API types ──────────────────────────────────────────────

interface BraveWebResult {
  title: string;
  url: string;
  description?: string;
  page_age?: string; // ISO date string
}

interface BraveResponse {
  web?: { results?: BraveWebResult[] };
  error?: { code: string; message: string };
}

// ─── Main export ──────────────────────────────────────────────────────

export async function webSearch(query: WebSearchQuery): Promise<WebSearchResponse> {
  const cacheKey = buildCacheKey('web', query);
  const cached = await cacheGet<WebSearchResponse>(cacheKey);
  if (cached) return { ...cached, cached: true };

  const apiKey = process.env['BRAVE_SEARCH_API_KEY'];
  if (!apiKey) {
    return {
      query: query.query,
      results: [],
      cached: false,
      fetched_at: new Date().toISOString(),
      // @ts-expect-error extended diagnostic field
      note: 'BRAVE_SEARCH_API_KEY not set — web search skipped',
    };
  }

  const params = new URLSearchParams({
    q: query.query,
    count: String(Math.min(query.num_results ?? 10, MAX_RESULTS)),
    safesearch: 'moderate',
    search_lang: 'en',
  });

  if (query.freshness) {
    params.set('freshness', FRESHNESS_MAP[query.freshness]);
  }

  const resp = await fetch(`${BRAVE_BASE}?${params}`, {
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': apiKey,
    },
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`Brave Search API HTTP ${resp.status}: ${body}`);
  }

  const raw = (await resp.json()) as BraveResponse;

  if (raw.error) {
    throw new Error(`Brave Search API error ${raw.error.code}: ${raw.error.message}`);
  }

  const results: WebSearchResult[] = (raw.web?.results ?? []).map(r => ({
    title: r.title,
    url: r.url,
    snippet: r.description ?? '',
    published_at: r.page_age ?? undefined,
  }));

  const response: WebSearchResponse = {
    query: query.query,
    results,
    cached: false,
    fetched_at: new Date().toISOString(),
  };

  await cacheSet(cacheKey, response);
  return response;
}
