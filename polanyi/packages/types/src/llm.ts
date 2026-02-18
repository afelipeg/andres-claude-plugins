// ─── LLM Provider Types ─────────────────────────────────────────────

export type LLMProviderType = 'anthropic' | 'openai' | 'ollama';

export interface LLMConfig {
  provider: LLMProviderType;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
