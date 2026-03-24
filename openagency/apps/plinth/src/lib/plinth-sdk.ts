// Claude Agent SDK Configuration
// Connects to the embedded Plinth MCP server with 63 tools

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// System prompt from PLINTH.md
let cachedSystemPrompt: string | null = null;

export function getSystemPrompt(brandContext?: string): string {
  if (!cachedSystemPrompt) {
    try {
      cachedSystemPrompt = readFileSync(join(process.cwd(), 'PLINTH.md'), 'utf-8');
    } catch {
      cachedSystemPrompt = 'You are Plinth, an AI advertising intelligence assistant.';
    }
  }

  let prompt = cachedSystemPrompt;
  if (brandContext) {
    prompt += `\n\n## Current Brand Context\n${brandContext}`;
  }
  return prompt;
}

// Subagent definitions — mapped to 5 engines
export const PLINTH_SUBAGENTS = {
  'leak-detector': {
    description: 'Waste detection, supply chain audit, media quality scoring',
    toolFilter: (name: string) => name.startsWith('leak_detector_'),
  },
  'media-architect': {
    description: 'Bayesian MMM, channel optimization, benchmarks, media plans',
    toolFilter: (name: string) => name.startsWith('media_architect_'),
  },
  'campaign-ops': {
    description: 'Campaign state machine, optimization alerts, reallocation',
    toolFilter: (name: string) => name.startsWith('campaign_ops_'),
  },
  'executive-bridge': {
    description: 'Shapley attribution, revenue translation, reconciliation, incrementality',
    toolFilter: (name: string) => name.startsWith('executive_bridge_'),
  },
  'delivery': {
    description: 'Reports, exports: PPTX, PDF, XLSX, competitive analysis',
    toolFilter: (name: string) => name.startsWith('delivery_'),
  },
} as const;

// SDK query options
export function getSdkOptions(tenantBudget?: number) {
  return {
    maxTurns: 30,
    maxBudgetUsd: tenantBudget ?? 2.0,
    model: 'claude-sonnet-4-20250514' as const,
  };
}
