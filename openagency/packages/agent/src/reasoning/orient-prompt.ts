// ─── Orient Phase Prompt Builder ────────────────────────────────────

import type { LLMConfig, LLMMessage, Observation, Orientation } from '@openagency/types';
import { callLLM } from '@openagency/core';
import { ENGINE_ORIENT_PROMPTS } from './prompt-templates.js';
import { parseOrientationResponse } from './response-parser.js';

export interface OrientContext {
  engine_id: string;
  active_goals: string[];
  recent_decisions: Array<{ reasoning: string; outcome?: string }>;
  memory_snippets: string[];
}

export async function orient(
  llmConfig: LLMConfig,
  observations: Observation[],
  context: OrientContext,
): Promise<Orientation> {
  const systemPrompt = ENGINE_ORIENT_PROMPTS[context.engine_id] ?? ENGINE_ORIENT_PROMPTS['campaign-ops']!;

  const userPrompt = buildOrientUserPrompt(observations, context);

  const messages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const response = await callLLM(llmConfig, messages);

  const orientation = parseOrientationResponse(response.content, observations.length);
  if (response.usage) {
    orientation.llm_usage = {
      prompt_tokens: response.usage.input_tokens,
      completion_tokens: response.usage.output_tokens,
      model: response.model,
    };
  }

  return orientation;
}

function buildOrientUserPrompt(observations: Observation[], context: OrientContext): string {
  const parts: string[] = [];

  parts.push('## Observations');
  for (const obs of observations.slice(0, 50)) { // limit to prevent token overflow
    parts.push(`- [${obs.type}] ${obs.source}${obs.platform ? ` (${obs.platform})` : ''}: ${JSON.stringify(obs.data).slice(0, 500)}`);
  }

  if (context.active_goals.length > 0) {
    parts.push('\n## Active Goals');
    for (const goal of context.active_goals) {
      parts.push(`- ${goal}`);
    }
  }

  if (context.recent_decisions.length > 0) {
    parts.push('\n## Recent Decisions');
    for (const d of context.recent_decisions.slice(0, 5)) {
      parts.push(`- ${d.reasoning}${d.outcome ? ` → ${d.outcome}` : ''}`);
    }
  }

  if (context.memory_snippets.length > 0) {
    parts.push('\n## Relevant Memory');
    for (const m of context.memory_snippets.slice(0, 5)) {
      parts.push(`- ${m}`);
    }
  }

  parts.push(`\n## Instructions
Analyze these observations and return a JSON object with:
{
  "context": { /* summary of the current situation */ },
  "anomalies": [{ "metric": string, "expected": number, "actual": number, "deviation_pct": number, "severity": "low"|"medium"|"high"|"critical", "platform?": string, "campaign_id?": string }],
  "opportunities": [{ "description": string, "potential_impact": number, "confidence": number, "suggested_action": string }],
  "risks": [{ "description": string, "severity": "low"|"medium"|"high"|"critical", "probability": number, "mitigation": string }],
  "reasoning": "your chain-of-thought reasoning"
}`);

  return parts.join('\n');
}
