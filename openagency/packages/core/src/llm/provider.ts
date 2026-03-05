// ─── LLM Provider ───────────────────────────────────────────────────
// Lightweight multi-provider LLM client. No heavy deps — uses native fetch.
// Supports: Anthropic (Claude), DeepSeek, OpenAI-compatible, Ollama (local).

import type { LLMConfig, LLMMessage } from '@openagency/types';

export interface LLMResponse {
  content: string;
  model: string;
  usage?: { input_tokens: number; output_tokens: number };
}

export async function callLLM(
  config: LLMConfig,
  messages: LLMMessage[],
): Promise<LLMResponse> {
  switch (config.provider) {
    case 'anthropic':
      return callAnthropic(config, messages);
    case 'deepseek':
      return callDeepSeek(config, messages);
    case 'openai':
      return callOpenAI(config, messages);
    case 'ollama':
      return callOllama(config, messages);
    default:
      throw new Error(`Unknown LLM provider: ${config.provider}. Use: anthropic, deepseek, openai, ollama`);
  }
}

async function callAnthropic(config: LLMConfig, messages: LLMMessage[]): Promise<LLMResponse> {
  const apiKey = config.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('Anthropic API key required. Set ANTHROPIC_API_KEY or configure via openagency init.');

  const systemMsg = messages.find((m) => m.role === 'system');
  const userMsgs = messages.filter((m) => m.role !== 'system');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
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

  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
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
 * Priority: Anthropic (Claude) > DeepSeek > OpenAI > null
 */
export function detectLLMConfig(): LLMConfig | null {
  if (process.env.ANTHROPIC_API_KEY) {
    return { provider: 'anthropic', model: 'claude-sonnet-4-20250514' };
  }
  if (process.env.DEEPSEEK_API_KEY) {
    return { provider: 'deepseek', model: 'deepseek-chat' };
  }
  if (process.env.OPENAI_API_KEY) {
    return { provider: 'openai', model: 'gpt-4o' };
  }
  return null;
}
