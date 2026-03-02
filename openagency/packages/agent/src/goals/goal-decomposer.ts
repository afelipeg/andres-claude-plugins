// ─── Goal Decomposer ────────────────────────────────────────────────
// LLM-powered decomposition of high-level goals into sub-tasks.

import { ulid } from 'ulid';
import type { Goal, SubTask, LLMConfig, LLMMessage } from '@openagency/types';
import type { SkillSchemaEntry } from '@openagency/schemas';
import { callLLM } from '@openagency/core';

export class GoalDecomposer {
  constructor(
    private llmConfig: LLMConfig,
    private skillRegistry: SkillSchemaEntry[],
  ) {}

  async decompose(goal: Goal): Promise<SubTask[]> {
    const messages: LLMMessage[] = [
      { role: 'system', content: this.buildSystemPrompt() },
      { role: 'user', content: this.buildUserPrompt(goal) },
    ];

    const response = await callLLM(this.llmConfig, messages);

    try {
      const json = extractJson(response.content);
      const parsed = JSON.parse(json) as { tasks?: SubTaskSpec[] };
      if (!Array.isArray(parsed.tasks)) return [];

      return parsed.tasks.map((t, i) => ({
        id: ulid(),
        description: t.description ?? `Task ${i + 1}`,
        assigned_agent: t.assigned_agent ?? 'campaign-ops',
        skill_to_run: t.skill_to_run,
        status: 'pending' as const,
        depends_on: Array.isArray(t.depends_on) ? t.depends_on.map(String) : [],
      }));
    } catch {
      return [];
    }
  }

  private buildSystemPrompt(): string {
    const skillList = this.skillRegistry
      .map((s) => `- ${s.engineId}:${s.skillId} — ${s.description}`)
      .join('\n');

    return `You are a goal decomposition engine for an ad-tech intelligence platform.
Given a high-level goal, break it down into ordered sub-tasks that can be executed by autonomous agents.

Available agents (one per engine):
- leak-detector: Detects wasted ad spend across 6 categories
- media-architect: Optimizes budget allocation across channels
- campaign-ops: Manages real-time campaign operations (pause, enable, bid adjust)
- executive-bridge: Translates metrics to business outcomes

Available skills:
${skillList}

Return a JSON object with a "tasks" array. Each task should have:
- description: what the task accomplishes
- assigned_agent: which engine agent should run it
- skill_to_run: optional "engine:skill" identifier
- depends_on: array of task indices (0-based) that must complete first`;
  }

  private buildUserPrompt(goal: Goal): string {
    const parts = [
      `## Goal: ${goal.name}`,
      `Description: ${goal.description}`,
      `Type: ${goal.type}`,
      `Target: ${goal.target_metric} → ${goal.target_value}`,
    ];

    if (goal.deadline) parts.push(`Deadline: ${goal.deadline}`);

    if (goal.constraints.allowed_platforms?.length) {
      parts.push(`Platforms: ${goal.constraints.allowed_platforms.join(', ')}`);
    }
    if (goal.constraints.max_budget !== undefined) {
      parts.push(`Max budget: $${goal.constraints.max_budget}`);
    }
    if (goal.constraints.max_cpa !== undefined) {
      parts.push(`Max CPA: $${goal.constraints.max_cpa}`);
    }
    if (goal.constraints.min_roas !== undefined) {
      parts.push(`Min ROAS: ${goal.constraints.min_roas}x`);
    }

    parts.push('\nDecompose this goal into ordered sub-tasks.');

    return parts.join('\n');
  }
}

interface SubTaskSpec {
  description?: string;
  assigned_agent?: string;
  skill_to_run?: string;
  depends_on?: number[];
}

function extractJson(text: string): string {
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch?.[1]) return codeBlockMatch[1].trim();
  const jsonMatch = text.match(/(\{[\s\S]*\})/);
  if (jsonMatch?.[1]) return jsonMatch[1].trim();
  return text.trim();
}
