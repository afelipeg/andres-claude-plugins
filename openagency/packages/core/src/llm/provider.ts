// ─── LLM Provider ───────────────────────────────────────────────────
// Lightweight multi-provider LLM client. No heavy deps — uses native fetch.
// Supports: Anthropic (Claude), DeepSeek, OpenAI-compatible, Ollama (local).
// v2: Failover chain, response cache, model tiers.

import { createHash } from 'node:crypto';
import type { LLMConfig, LLMMessage } from '@openagency/types';

export interface LLMResponse {
  content: string;
  model: string;
  usage?: { input_tokens: number; output_tokens: number };
}

// ─── Model Tiers ────────────────────────────────────────────────────

export type ModelTier = 'fast' | 'standard' | 'advanced';

const ANTHROPIC_MODELS: Record<ModelTier, string> = {
  fast: 'claude-haiku-4-5-20251001',
  standard: 'claude-sonnet-4-20250514',
  advanced: 'claude-sonnet-4-20250514',
};

const DEEPSEEK_MODELS: Record<ModelTier, string> = {
  fast: 'deepseek-chat',
  standard: 'deepseek-chat',
  advanced: 'deepseek-chat',
};

const TIER_MAX_TOKENS: Record<ModelTier, number> = {
  fast: 2048,
  standard: 2048,
  advanced: 4096,
};

/**
 * Resolve a model name and maxTokens for a given provider + tier.
 * Returns a partial config that can be spread into an LLMConfig.
 */
export function resolveModelTier(
  provider: LLMConfig['provider'],
  tier: ModelTier,
): { model: string; maxTokens: number } {
  const models = provider === 'anthropic' ? ANTHROPIC_MODELS
    : provider === 'deepseek' ? DEEPSEEK_MODELS
    : null;

  return {
    model: models?.[tier] ?? (provider === 'anthropic' ? ANTHROPIC_MODELS.standard : 'deepseek-chat'),
    maxTokens: TIER_MAX_TOKENS[tier],
  };
}

// ─── Response Cache (TTL-based, per prompt hash) ────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  response: LLMResponse;
  expires: number;
}

const responseCache = new Map<string, CacheEntry>();

function hashMessages(messages: LLMMessage[]): string {
  return createHash('sha256')
    .update(JSON.stringify(messages))
    .digest('hex');
}

function getCached(key: string): LLMResponse | null {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    responseCache.delete(key);
    return null;
  }
  return entry.response;
}

function setCache(key: string, response: LLMResponse): void {
  // Evict expired entries periodically (keep cache bounded)
  if (responseCache.size > 500) {
    const now = Date.now();
    for (const [k, v] of responseCache) {
      if (now > v.expires) responseCache.delete(k);
    }
  }
  responseCache.set(key, { response, expires: Date.now() + CACHE_TTL_MS });
}

// ─── Core callLLM ───────────────────────────────────────────────────

export async function callLLM(
  config: LLMConfig,
  messages: LLMMessage[],
): Promise<LLMResponse> {
  let response: LLMResponse;
  switch (config.provider) {
    case 'anthropic':
      response = await callAnthropic(config, messages);
      break;
    case 'deepseek':
      response = await callDeepSeek(config, messages);
      break;
    case 'openai':
      response = await callOpenAI(config, messages);
      break;
    case 'ollama':
      response = await callOllama(config, messages);
      break;
    default:
      throw new Error(`Unknown LLM provider: ${config.provider}. Use: anthropic, deepseek, openai, ollama`);
  }

  // Cache successful response
  const cacheKey = hashMessages(messages);
  setCache(cacheKey, response);

  return response;
}

// ─── Failover: try multiple providers in order ──────────────────────

/**
 * Try each config in order. If all providers fail, attempt to return a
 * cached response for the same prompt. If no cache hit, throws.
 */
export async function callLLMWithFallback(
  configs: LLMConfig[],
  messages: LLMMessage[],
): Promise<LLMResponse> {
  const errors: string[] = [];

  for (const config of configs) {
    try {
      return await callLLM(config, messages);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[LLM] ${config.provider} failed, trying next...`, msg);
      errors.push(`${config.provider}: ${msg}`);
      continue;
    }
  }

  // All providers failed — check cache
  const cacheKey = hashMessages(messages);
  const cached = getCached(cacheKey);
  if (cached) {
    console.warn('[LLM] All providers failed — returning cached response');
    return cached;
  }

  throw new Error(`All LLM providers failed: ${errors.join(' | ')}`);
}

// ─── Retry with exponential backoff ─────────────────────────────────
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, init);
    if (res.ok || attempt === MAX_RETRIES) return res;

    // Only retry on 429 (rate limit) and 5xx (server errors)
    if (res.status !== 429 && res.status < 500) return res;

    const retryAfter = res.headers.get('retry-after');
    const delayMs = retryAfter
      ? Math.min(parseInt(retryAfter, 10) * 1000, 30000)
      : BASE_DELAY_MS * Math.pow(2, attempt);

    console.warn(`[LLM] Retry ${attempt + 1}/${MAX_RETRIES} after ${delayMs}ms (status: ${res.status})`);
    await new Promise((r) => setTimeout(r, delayMs));
  }
  // Unreachable but satisfies TS
  throw new Error('fetchWithRetry: exhausted retries');
}

async function callAnthropic(config: LLMConfig, messages: LLMMessage[]): Promise<LLMResponse> {
  const apiKey = config.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Anthropic API key required. Set ANTHROPIC_API_KEY or configure via openagency init.');

  const systemMsg = messages.find((m) => m.role === 'system');
  const userMsgs = messages.filter((m) => m.role !== 'system');

  const res = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: config.model ?? 'claude-sonnet-4-20250514',
      max_tokens: config.maxTokens ?? 2048,
      temperature: config.temperature ?? 0.3,
      system: systemMsg?.content,
      messages: userMsgs.map((m) => ({ role: m.role, content: m.content })),
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error (${res.status}): ${err}`);
  }

  const data = await res.json() as {
    content: Array<{ text: string }>;
    model: string;
    usage: { input_tokens: number; output_tokens: number };
  };

  return {
    content: data.content[0]?.text ?? '',
    model: data.model,
    usage: data.usage,
  };
}

async function callDeepSeek(config: LLMConfig, messages: LLMMessage[]): Promise<LLMResponse> {
  const apiKey = config.apiKey ?? process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('DeepSeek API key required. Set DEEPSEEK_API_KEY or configure via openagency init.');

  const res = await fetchWithRetry('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: config.model ?? 'deepseek-chat',
      temperature: config.temperature ?? 0.3,
      max_tokens: config.maxTokens ?? 2048,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DeepSeek API error (${res.status}): ${err}`);
  }

  const data = await res.json() as {
    choices: Array<{ message: { content: string } }>;
    model: string;
    usage: { prompt_tokens: number; completion_tokens: number };
  };

  return {
    content: data.choices[0]?.message?.content ?? '',
    model: data.model,
    usage: {
      input_tokens: data.usage.prompt_tokens,
      output_tokens: data.usage.completion_tokens,
    },
  };
}

async function callOpenAI(config: LLMConfig, messages: LLMMessage[]): Promise<LLMResponse> {
  const apiKey = config.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OpenAI API key required. Set OPENAI_API_KEY or configure via openagency init.');

  const baseUrl = config.baseUrl ?? 'https://api.openai.com/v1';

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: config.model ?? 'gpt-4o',
      temperature: config.temperature ?? 0.3,
      max_tokens: config.maxTokens ?? 2048,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error (${res.status}): ${err}`);
  }

  const data = await res.json() as {
    choices: Array<{ message: { content: string } }>;
    model: string;
    usage: { prompt_tokens: number; completion_tokens: number };
  };

  return {
    content: data.choices[0]?.message?.content ?? '',
    model: data.model,
    usage: {
      input_tokens: data.usage.prompt_tokens,
      output_tokens: data.usage.completion_tokens,
    },
  };
}

async function callOllama(config: LLMConfig, messages: LLMMessage[]): Promise<LLMResponse> {
  const baseUrl = config.baseUrl ?? 'http://localhost:11434';

  const res = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.model ?? 'llama3',
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: false,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Ollama error (${res.status}): ${err}. Is Ollama running?`);
  }

  const data = await res.json() as {
    message: { content: string };
    model: string;
  };

  return {
    content: data.message?.content ?? '',
    model: data.model,
  };
}

/** Check if LLM is configured (has API key or Ollama) */
export function isLLMConfigured(config: LLMConfig): boolean {
  if (config.provider === 'ollama') return true;
  if (config.provider === 'anthropic')
    return !!(config.apiKey ?? process.env.ANTHROPIC_API_KEY);
  if (config.provider === 'deepseek')
    return !!(config.apiKey ?? process.env.DEEPSEEK_API_KEY);
  if (config.provider === 'openai')
    return !!(config.apiKey ?? process.env.OPENAI_API_KEY);
  return false;
}

/**
 * Auto-detect available LLM provider from environment.
 * Priority: Anthropic (Claude) > DeepSeek > null
 *
 * ARCHITECTURAL RULE: All reasoning must use Anthropic. DeepSeek is an emergency
 * fallback. OpenAI is available only via explicit config, never auto-detected.
 */
export function detectLLMConfig(): LLMConfig | null {
  const configs = detectLLMConfigs();
  return configs.length > 0 ? configs[0] : null;
}

/**
 * Auto-detect ALL available LLM providers from environment, ordered by priority.
 * Returns an array suitable for callLLMWithFallback().
 * Priority: Anthropic (Claude) > DeepSeek
 */
export function detectLLMConfigs(): LLMConfig[] {
  const configs: LLMConfig[] = [];
  if (process.env.ANTHROPIC_API_KEY) {
    configs.push({ provider: 'anthropic', model: 'claude-sonnet-4-20250514' });
  }
  if (process.env.DEEPSEEK_API_KEY) {
    configs.push({ provider: 'deepseek', model: 'deepseek-chat' });
  }
  return configs;
}
