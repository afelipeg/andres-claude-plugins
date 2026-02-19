// ─── Configuration Types ────────────────────────────────────────────

import type { LLMConfig } from './llm.js';

export interface OpenAgencyConfig {
  llm?: LLMConfig;
  defaultIndustry?: string;
  currency?: string;
  locale?: string;
}
