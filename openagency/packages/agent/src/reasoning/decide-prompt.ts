// ─── Decide Phase Prompt Builder ────────────────────────────────────

import type { LLMConfig, LLMMessage, Orientation, ActionType } from '@openagency/types';
import { callLLM } from '@openagency/core';
import { ENGINE_DECIDE_PROMPTS } from './prompt-templates.js';
import { parseDecisionResponse } from './response-parser.js';

export interface DecisionPlan {
  actions: PlannedActionSpec[];
  reasoning: string;
  confidence: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
}

export interface PlannedActionSpec {
  type: ActionType;
  target: { platform?: string; campaign_id?: string; ad_set_id?: string; account_id?: string };
  parameters: Record<string, unknown>;
  estimated_impact: string;
  rollback_plan?: string;
}

export interface DecideContext {
  engine_id: string;
  agent_config: { max_budget_change_pct: number; approval_threshold_usd: number; dry_run: boolean };
  available_platforms: string[];
  active_goals: string[];
}

export async function decide(
  llmConfig: LLMConfig,
  orientation: Orientation,
  context: DecideContext,
): Promise<DecisionPlan> {
  const systemPrompt = ENGINE_DECIDE_PROMPTS[context.engine_id] ?? ENGINE_DECIDE_PROMPTS['campaign-ops']!;

  const userPrompt = buildDecideUserPrompt(orientation, context);

  const messages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const response = await callLLM(llmConfig, messages);
  return parseDecisionResponse(response.content);
}

function buildDecideUserPrompt(orientation: Orientation, context: DecideContext): string {
  const parts: string[] = [];

  parts.push('## Orientation Analysis');
  parts.push(`Reasoning: ${orientation.reasoning}`);

  if (orientation.anomalies.length > 0) {
    parts.push('\n### Anomalies');
    for (const a of orientation.anomalies) {
      parts.push(`- ${a.metric}: expected ${a.expected}, actual ${a.actual} (${a.deviation_pct.toFixed(1)}% deviation, ${a.severity})`);
    }
  }

  if (orientation.opportunities.length > 0) {
    parts.push('\n### Opportunities');
    for (const o of orientation.opportunities) {
      parts.push(`- ${o.description} (impact: $${o.potential_impact}, confidence: ${(o.confidence * 100).toFixed(0)}%)`);
    }
  }

  if (orientation.risks.length > 0) {
    parts.push('\n### Risks');
    for (const r of orientation.risks) {
      parts.push(`- ${r.description} (${r.severity}, probability: ${(r.probability * 100).toFixed(0)}%)`);
    }
  }

  parts.push('\n## Safety Constraints');
  parts.push(`- Max budget change: ${context.agent_config.max_budget_change_pct}%`);
  parts.push(`- Approval threshold: $${context.agent_config.approval_threshold_usd}`);
  parts.push(`- Dry run: ${context.agent_config.dry_run}`);
  parts.push(`- Available platforms: ${context.available_platforms.join(', ') || 'none'}`);

  if (context.active_goals.length > 0) {
    parts.push('\n## Active Goals');
    for (const g of context.active_goals) {
      parts.push(`- ${g}`);
    }
  }

  parts.push(`\n## Available Action Types
- budget_update: Change campaign daily/lifetime budget
- campaign_pause: Pause an underperforming campaign
- campaign_enable: Re-enable a paused campaign
- bid_adjustment: Adjust ad set bid amount
- skill_execution: Run an engine skill for deeper analysis
- notification: Emit a domain signal event`);

  parts.push(`\n## Instructions
Based on the analysis, return a JSON object with:
{
  "actions": [{
    "type": "budget_update"|"campaign_pause"|"campaign_enable"|"bid_adjustment"|"skill_execution"|"notification",
    "target": { "platform?": string, "campaign_id?": string, "ad_set_id?": string },
    "parameters": { /* action-specific params */ },
    "estimated_impact": "description of expected outcome",
    "rollback_plan?": "how to undo if needed"
  }],
  "reasoning": "why these actions were chosen",
  "confidence": 0.0-1.0,
  "risk_level": "low"|"medium"|"high"|"critical"
}

Return an empty actions array if no action is warranted.`);

  return parts.join('\n');
}
