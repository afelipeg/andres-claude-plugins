// ─── Agent & Goal API Schemas ───────────────────────────────────────

import { z } from 'zod';

export const GoalCreateInputSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  type: z.enum(['maximize', 'minimize', 'maintain', 'achieve']),
  target_metric: z.string().min(1).max(100),
  target_value: z.number(),
  deadline: z.string().datetime().optional(),
  priority: z.number().int().min(1).max(10).default(5),
  agent_id: z.string().optional(),
  constraints: z
    .object({
      max_budget: z.number().positive().optional(),
      min_budget: z.number().nonnegative().optional(),
      allowed_platforms: z.array(z.string()).optional(),
      excluded_campaigns: z.array(z.string()).optional(),
      max_cpa: z.number().positive().optional(),
      min_roas: z.number().positive().optional(),
    })
    .default({}),
});

export const GoalUpdateInputSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(2000).optional(),
  target_value: z.number().optional(),
  deadline: z.string().datetime().optional(),
  priority: z.number().int().min(1).max(10).optional(),
  status: z.enum(['active', 'paused', 'cancelled']).optional(),
  constraints: z
    .object({
      max_budget: z.number().positive().optional(),
      min_budget: z.number().nonnegative().optional(),
      allowed_platforms: z.array(z.string()).optional(),
      excluded_campaigns: z.array(z.string()).optional(),
      max_cpa: z.number().positive().optional(),
      min_roas: z.number().positive().optional(),
    })
    .optional(),
});

export const AgentConfigUpdateSchema = z.object({
  cycle_interval_ms: z.number().int().min(10_000).optional(),
  max_budget_change_pct: z.number().min(0).max(100).optional(),
  approval_threshold_usd: z.number().nonnegative().optional(),
  dry_run: z.boolean().optional(),
  writable_platforms: z.array(z.string()).optional(),
  llm_config: z
    .object({
      model: z.string(),
      temperature: z.number().min(0).max(2).optional(),
      max_tokens: z.number().int().positive().optional(),
    })
    .optional(),
});

export type GoalCreateInput = z.infer<typeof GoalCreateInputSchema>;
export type GoalUpdateInput = z.infer<typeof GoalUpdateInputSchema>;
export type AgentConfigUpdate = z.infer<typeof AgentConfigUpdateSchema>;
