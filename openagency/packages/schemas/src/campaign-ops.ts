// ─── Campaign Ops Schemas ───────────────────────────────────────────

import { z } from 'zod';
import { SeveritySchema } from './common.js';

// ─── Campaign State ─────────────────────────────────────────────────

const CampaignStatusSchema = z.enum([
  'BRIEFED',
  'PLANNING',
  'ARCHITECTING',
  'ACTIVATING',
  'LIVE',
  'OPTIMIZING',
  'WRAPPING',
  'COMPLETED',
  'BLOCKED',
]);

const EngineStatusSchema = z.enum(['IDLE', 'ACTIVE', 'BLOCKED', 'COMPLETED']);
const TaskStatusSchema = z.enum([
  'PENDING',
  'IN_PROGRESS',
  'BLOCKED',
  'REVIEW',
  'DONE',
  'SKIPPED',
]);

const CampaignTaskSchema = z.object({
  id: z.string(),
  name: z.string(),
  engine: z.string(),
  hours: z.number(),
  depends_on: z.array(z.string()),
  status: TaskStatusSchema,
});

const SprintSchema = z.object({
  name: z.string(),
  duration_hours: z.number(),
  tasks: z.array(CampaignTaskSchema),
});

export const CampaignCreateInputSchema = z.object({
  campaign_name: z.string(),
  client: z.string(),
  start_date: z.string().optional(),
  brief_summary: z.string().optional(),
});

export const CampaignStateSchema = z.object({
  campaign: z.object({
    name: z.string(),
    client: z.string(),
    state: CampaignStatusSchema,
    start_date: z.string(),
    brief_summary: z.string(),
  }),
  engines: z.record(
    z.string(),
    z.object({ state: EngineStatusSchema, progress: z.number() }),
  ),
  sprints: z.record(z.string(), SprintSchema),
  blockers: z.array(z.string()),
  created_at: z.string(),
});

export const TaskUpdateInputSchema = z.object({
  state: CampaignStateSchema,
  task_id: z.string(),
  new_status: TaskStatusSchema,
});

export const NextActionSchema = z.object({
  task_id: z.string(),
  task_name: z.string(),
  engine: z.string(),
  sprint: z.string(),
  estimated_hours: z.number(),
});

// ─── Optimization Rules ─────────────────────────────────────────────

const CampaignMetricsInputSchema = z.object({
  name: z.string(),
  channel: z.string(),
  spend: z.number(),
  budget: z.number(),
  days_elapsed: z.number(),
  days_total: z.number(),
  impressions: z.number(),
  clicks: z.number(),
  conversions: z.number(),
  revenue: z.number(),
  cpa_target: z.number(),
  roas_target: z.number(),
  historical_ctr: z.number(),
});

export const OptimizationInputSchema = z.object({
  campaigns: z.array(CampaignMetricsInputSchema),
});

const OptAlertSchema = z.object({
  type: z.string(),
  severity: SeveritySchema,
  message: z.string(),
  recommendation: z.string(),
});

export const OptimizationOutputSchema = z.object({
  campaigns: z.array(
    z.object({
      campaign: z.string(),
      channel: z.string(),
      metrics: z.object({
        spend: z.number(),
        budget: z.number(),
        cpa: z.number(),
        roas: z.number(),
        ctr: z.number(),
        pacing_pct: z.number(),
      }),
      alerts: z.array(OptAlertSchema),
      alert_count: z.object({
        critical: z.number(),
        warning: z.number(),
        info: z.number(),
      }),
    }),
  ),
  total_alerts: z.object({
    critical: z.number(),
    warning: z.number(),
    info: z.number(),
  }),
});

export const ReallocateInputSchema = z.object({
  campaigns: z.array(
    z.object({
      name: z.string(),
      channel: z.string(),
      spend: z.number(),
      roas: z.number(),
    }),
  ),
});

export const ReallocateOutputSchema = z.object({
  recommendations: z.array(
    z.object({
      from_campaign: z.string(),
      to_campaign: z.string(),
      amount: z.number(),
      reason: z.string(),
    }),
  ),
  estimated_roas_improvement: z.number(),
});
