// ─── Token-Bucket Rate Limiter ──────────────────────────────────────
// Per-platform rate limiting with configurable thresholds.

import type { RateLimitConfig } from '@openagency/types';

export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private minuteTokens: number;
  private minuteStart: number;
  private dailyCount: number;
  private dayStart: number;

  constructor(private config: RateLimitConfig) {
    this.tokens = config.requests_per_second;
    this.lastRefill = Date.now();
    this.minuteTokens = config.requests_per_minute;
    this.minuteStart = Date.now();
    this.dailyCount = 0;
    this.dayStart = Date.now();
  }

  /**
   * Wait until a request slot is available, then consume it.
   */
  async acquire(): Promise<void> {
    // Check daily limit
    if (this.config.daily_limit) {
      const now = Date.now();
      if (now - this.dayStart >= 86_400_000) {
        this.dailyCount = 0;
        this.dayStart = now;
      }
      if (this.dailyCount >= this.config.daily_limit) {
        throw new Error('Daily rate limit exceeded');
      }
    }

    // Refill per-second tokens
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    if (elapsed >= 1000) {
      this.tokens = this.config.requests_per_second;
      this.lastRefill = now;
    }

    // Refill per-minute tokens
    if (now - this.minuteStart >= 60_000) {
      this.minuteTokens = this.config.requests_per_minute;
      this.minuteStart = now;
    }

    // Wait if no tokens available
    if (this.tokens <= 0 || this.minuteTokens <= 0) {
      const waitMs = this.tokens <= 0
        ? 1000 - (now - this.lastRefill)
        : 60_000 - (now - this.minuteStart);
      await sleep(Math.max(waitMs, 100));
      return this.acquire();
    }

    this.tokens--;
    this.minuteTokens--;
    this.dailyCount++;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Default rate limit configs per platform */
export const PLATFORM_RATE_LIMITS: Record<string, RateLimitConfig> = {
  meta_ads: {
    requests_per_second: 4,
    requests_per_minute: 200,
    retry_after_ms: 5000,
    max_retries: 3,
  },
  google_ads: {
    requests_per_second: 10,
    requests_per_minute: 1000,
    retry_after_ms: 1000,
    max_retries: 5,
  },
  dv360: {
    requests_per_second: 5,
    requests_per_minute: 300,
    retry_after_ms: 2000,
    max_retries: 3,
  },
  tiktok_ads: {
    requests_per_second: 5,
    requests_per_minute: 600,
    retry_after_ms: 2000,
    max_retries: 3,
  },
  tiktok_shop: {
    requests_per_second: 5,
    requests_per_minute: 300,
    retry_after_ms: 2000,
    max_retries: 3,
  },
  amazon_ads: {
    requests_per_second: 2,
    requests_per_minute: 100,
    retry_after_ms: 5000,
    max_retries: 3,
  },
};
