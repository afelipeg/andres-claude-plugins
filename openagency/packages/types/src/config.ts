// ─── Configuration Types ────────────────────────────────────────────

import type { LLMConfig } from './llm.js';
import type { ConnectorConfig } from './connector.js';

export interface OpenAgencyConfig {
  llm?: LLMConfig;
  defaultIndustry?: string;
  currency?: string;
  locale?: string;
  connectors?: ConnectorConfig[];
}
