// ─── Usage Meter ───────────────────────────────────────────────────
// Tracks per-run usage for future pricing.

import type { UsageMeter } from './types.js';

export function createUsageMeter(runId: string, clientId?: string): UsageMeter {
  return {
    run_id: runId,
    agent_client_id: clientId,
    stages_executed: 0,
    total_duration_ms: 0,
    llm_tokens_used: { prompt: 0, completion: 0 },
    actions_executed: 0,
    outcomes: {},
  };
}

export function recordStageUsage(
  meter: UsageMeter,
  durationMs: number,
  orientation?: { llm_usage?: { prompt_tokens: number; completion_tokens: number } } | null,
  actionsExecuted = 0,
): void {
  meter.stages_executed += 1;
  meter.total_duration_ms += durationMs;
  meter.actions_executed += actionsExecuted;

  if (orientation?.llm_usage) {
    meter.llm_tokens_used.prompt += orientation.llm_usage.prompt_tokens;
    meter.llm_tokens_used.completion += orientation.llm_usage.completion_tokens;
  }
}

export function recordOutcome(meter: UsageMeter, key: string, value: unknown): void {
  meter.outcomes[key] = value;
}
