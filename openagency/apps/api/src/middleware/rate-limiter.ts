// ─── Token Bucket Rate Limiter ──────────────────────────────────────

import type { Context, Next } from 'hono';

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, Bucket>();
const MAX_TOKENS = 60;
const REFILL_RATE = 1; // tokens per second
const REFILL_INTERVAL_MS = 1000;

function getClientId(c: Context): string {
  const auth = c.get('auth') as { sub?: string } | undefined;
  if (auth?.sub) return auth.sub;
  const apiKey = c.req.header('X-API-Key');
  if (apiKey) return apiKey.slice(0, 16);
  const ip = c.req.header('X-Forwarded-For') ?? 'unknown';
  return `ip:${ip}`;
}

export function rateLimiter(maxTokens = MAX_TOKENS, refillRate = REFILL_RATE) {
  return async (c: Context, next: Next) => {
    const clientId = getClientId(c);
    const now = Date.now();

    let bucket = buckets.get(clientId);
    if (!bucket) {
      bucket = { tokens: maxTokens, lastRefill: now };
      buckets.set(clientId, bucket);
    }

    // Refill tokens
    const elapsed = now - bucket.lastRefill;
    const tokensToAdd = Math.floor(elapsed / REFILL_INTERVAL_MS) * refillRate;
    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(maxTokens, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }

    if (bucket.tokens < 1) {
      c.header('Retry-After', '1');
      return c.json(
        {
          error: 'rate_limited',
          message: 'Too many requests. Please retry after 1 second.',
          status: 429,
        },
        429,
      );
    }

    bucket.tokens -= 1;
    c.header('X-RateLimit-Remaining', String(Math.floor(bucket.tokens)));
    await next();
  };
}
