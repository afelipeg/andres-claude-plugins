// ─── Exponential Backoff with Jitter ────────────────────────────────

export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs?: number;
  /** Called before each retry — return false to abort */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30_000,
};

/**
 * Execute a function with exponential backoff + jitter on failure.
 * Retries on transient errors (5xx, rate limits, network errors).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: Partial<RetryOptions> = {},
): Promise<T> {
  const config = { ...DEFAULT_OPTIONS, ...opts };
  let lastError: unknown;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === config.maxRetries) break;

      if (config.shouldRetry && !config.shouldRetry(error, attempt)) break;

      // Default: retry on network errors and 429/5xx
      if (!config.shouldRetry && !isRetryable(error)) break;

      const delay = computeDelay(attempt, config.baseDelayMs, config.maxDelayMs ?? 30_000);
      await sleep(delay);
    }
  }

  throw lastError;
}

function isRetryable(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message;
    // Rate limited
    if (msg.includes('429') || msg.includes('rate limit')) return true;
    // Server errors
    if (/\b5\d{2}\b/.test(msg)) return true;
    // Network errors
    if (msg.includes('ECONNRESET') || msg.includes('ETIMEDOUT') || msg.includes('fetch failed')) return true;
  }
  return false;
}

function computeDelay(attempt: number, baseMs: number, maxMs: number): number {
  const exponential = baseMs * Math.pow(2, attempt);
  const jitter = Math.random() * baseMs;
  return Math.min(exponential + jitter, maxMs);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
