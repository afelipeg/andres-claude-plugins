// ─── Search & Ad Library Cache ───────────────────────────────────────
// Transversal requirement: cache query results with 24h TTL.
// Backend: Map in-memory (dev / no Redis) or Redis (prod, via REDIS_URL).

import crypto from 'node:crypto';

const TTL_MS = 24 * 60 * 60 * 1000; // 24h in ms (in-memory)
const TTL_S = 86_400;               // 24h in seconds (Redis SETEX)

// ─── In-memory backend ───────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  expires_at: number; // Date.now() ms
}

const memCache = new Map<string, CacheEntry<unknown>>();

// Hourly cleanup to avoid unbounded growth.
// `.unref()` so this timer never prevents Node from exiting.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memCache) {
    if (entry.expires_at < now) memCache.delete(key);
  }
}, 60 * 60 * 1000).unref();

// ─── Redis backend ────────────────────────────────────────────────────

let _redis: unknown = null;
let _redisResolved = false;

async function getRedis(): Promise<{ get(k: string): Promise<string | null>; setex(k: string, ttl: number, v: string): Promise<unknown> } | null> {
  if (_redisResolved) return _redis as ReturnType<typeof getRedis> extends Promise<infer R> ? R : never;
  _redisResolved = true;
  const url = process.env['REDIS_URL'];
  if (!url) return null;
  try {
    const mod = await import('ioredis');
    const Redis = mod.default ?? mod;
    _redis = new (Redis as unknown as new (url: string) => unknown)(url);
    return _redis as ReturnType<typeof getRedis> extends Promise<infer R> ? R : never;
  } catch {
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────

/**
 * Build a deterministic cache key from a namespace and arbitrary input.
 * Key format: `delivery:{namespace}:{sha256(JSON)}`
 */
export function buildCacheKey(namespace: string, input: unknown): string {
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify(input))
    .digest('hex');
  return `delivery:${namespace}:${hash}`;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = await getRedis();
  if (redis) {
    try {
      const raw = await redis.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      // Redis error → fall through to memory
    }
  }
  const entry = memCache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (entry.expires_at < Date.now()) {
    memCache.delete(key);
    return null;
  }
  return entry.data;
}

export async function cacheSet<T>(key: string, data: T): Promise<void> {
  const redis = await getRedis();
  if (redis) {
    try {
      await redis.setex(key, TTL_S, JSON.stringify(data));
      return;
    } catch {
      // Redis error → fall through to memory
    }
  }
  memCache.set(key, { data, expires_at: Date.now() + TTL_MS });
}

/** Remove a single cache entry (e.g. force refresh). */
export async function cacheDel(key: string): Promise<void> {
  const redis = await getRedis();
  if (redis) {
    try {
      await (redis as unknown as { del(k: string): Promise<unknown> }).del(key);
      return;
    } catch { /* ignore */ }
  }
  memCache.delete(key);
}

/** Returns cache stats — useful for health checks and debugging. */
export function cacheStats(): { backend: 'redis' | 'memory'; entries: number } {
  return {
    backend: _redis ? 'redis' : 'memory',
    entries: memCache.size,
  };
}
