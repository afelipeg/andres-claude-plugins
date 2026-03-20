// ─── Voyage AI Embedder ──────────────────────────────────────────────
// Embeds text using Voyage AI voyage-3 (1024 dimensions).
// Graceful degradation: returns empty arrays when VOYAGE_API_KEY is unset.

/// <reference types="node" />

const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings';
const VOYAGE_MODEL = 'voyage-3';
const BATCH_SIZE = 128;
export const EMBEDDING_DIMS = 1024;

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

// ─── Env helper (works with or without @types/node) ──────────────────

function getEnv(key: string): string | undefined {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  return (globalThis as Record<string, unknown>)['process']
    ? ((globalThis as Record<string, unknown>)['process'] as Record<string, Record<string, string>>)['env']?.[key]
    : undefined;
}

// ─── Retry helper ────────────────────────────────────────────────────

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retries: number = MAX_RETRIES,
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(url, init);

    if (res.ok) return res;

    // Retry on 429 (rate limit) and 5xx (server errors)
    if (res.status === 429 || res.status >= 500) {
      lastError = new Error(`Voyage API error (${res.status}): ${await res.text()}`);
      const delay = BASE_DELAY_MS * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }

    // Non-retryable error
    const body = await res.text();
    throw new Error(`Voyage API error (${res.status}): ${body}`);
  }

  throw lastError ?? new Error('Voyage API: max retries exceeded');
}

// ─── Core embedding call ─────────────────────────────────────────────

async function callVoyage(
  texts: string[],
  apiKey: string,
  inputType: 'document' | 'query',
): Promise<number[][]> {
  const res = await fetchWithRetry(VOYAGE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: VOYAGE_MODEL,
      input: texts,
      input_type: inputType,
    }),
  });

  const data = (await res.json()) as {
    data: Array<{ embedding: number[]; index: number }>;
  };

  // Return in original order (API may reorder)
  const sorted = data.data.sort((a, b) => a.index - b.index);
  return sorted.map((d) => d.embedding);
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Embed multiple texts (documents). Batches into groups of 128.
 * Returns one 1024-dim vector per input text.
 * If VOYAGE_API_KEY is not set, returns empty arrays (graceful degradation).
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const apiKey = getEnv('VOYAGE_API_KEY');
  if (!apiKey) {
    return texts.map(() => []);
  }

  if (texts.length === 0) return [];

  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const embeddings = await callVoyage(batch, apiKey, 'document');
    results.push(...embeddings);
  }

  return results;
}

/**
 * Embed a single query string for search.
 * Uses input_type='query' for optimal retrieval performance.
 * If VOYAGE_API_KEY is not set, returns an empty array.
 */
export async function embedQuery(query: string): Promise<number[]> {
  const apiKey = getEnv('VOYAGE_API_KEY');
  if (!apiKey) return [];

  const embeddings = await callVoyage([query], apiKey, 'query');
  return embeddings[0] ?? [];
}
