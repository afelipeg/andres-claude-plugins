// ─── Web Search Tool ─────────────────────────────────────────────────
// Wrapper over Serper (Google Search API).
// Optional env var: SERPER_API_KEY
// If not set, returns empty results with a note (graceful — skill decides
// whether to treat this as a hard failure or continue without web data).
// Results cached 24h via search-cache.ts (Map → Redis).

import type { WebSearchQuery, WebSearchResponse, WebSearchResult } from '@openagency/types';
import { buildCacheKey, cacheGet, cacheSet } from './search-cache.js';

const SERPER_BASE = 'https://google.serper.dev/search';
const MAX_RESULTS = 20;

// ─── Raw Serper API types ─────────────────────────────────────────────

interface SerperOrganicResult {
  title: string;
  link: string;
  snippet?: string;
  position: number;
  date?: string;
}

interface SerperResponse {
  organic?: SerperOrganicResult[];
  searchParameters?: { q: string; num: number };
  knowledgeGraph?: unknown;
  error?: string;
}

// ─── Main export ──────────────────────────────────────────────────────

export async function webSearch(query: WebSearchQuery): Promise<WebSearchResponse> {
  const cacheKey = buildCacheKey('web', query);
  const cached = await cacheGet<WebSearchResponse>(cacheKey);
  if (cached) return { ...cached, cached: true };

  const apiKey = process.env['SERPER_API_KEY'];
  if (!apiKey) {
    return {
      query: query.query,
      results: [],
      cached: false,
      fetched_at: new Date().toISOString(),
      // @ts-expect-error extended diagnostic field
      note: 'SERPER_API_KEY not set — web search skipped',
    };
  }

  const resp = await fetch(SERPER_BASE, {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: query.query,
      num: Math.min(query.num_results ?? 10, MAX_RESULTS),
    }),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`Serper API HTTP ${resp.status}: ${body}`);
  }

  const raw = (await resp.json()) as SerperResponse;

  if (raw.error) {
    throw new Error(`Serper API error: ${raw.error}`);
  }

  const results: WebSearchResult[] = (raw.organic ?? []).map(r => ({
    title: r.title,
    url: r.link,
    snippet: r.snippet ?? '',
    published_at: r.date ?? undefined,
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
