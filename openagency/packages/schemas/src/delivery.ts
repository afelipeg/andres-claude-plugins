// ─── Delivery Engine Schemas ─────────────────────────────────────────

import { z } from 'zod';

// ─── Shared ──────────────────────────────────────────────────────────

const LayerOneResultsSchema = z.object({
  leak_detector: z.unknown().optional(),
  media_architect: z.unknown().optional(),
  campaign_ops: z.unknown().optional(),
  executive_bridge: z.unknown().optional(),
  run_id: z.string().optional(),
  client_id: z.string().optional(),
  period_start: z.string().optional(),
  period_end: z.string().optional(),
});

const DeliverySkillBaseSchema = z.object({
  client_id: z.string().min(1),
  run_id: z.string().min(1),
  layer_one_results: LayerOneResultsSchema,
  context: z.record(z.string(), z.unknown()).optional(),
});

// ─── monthly-report ──────────────────────────────────────────────────

export const MonthlyReportInputSchema = DeliverySkillBaseSchema.extend({
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  output_formats: z.array(z.enum(['pdf', 'pptx'])).min(1).default(['pdf']),
});

export type MonthlyReportInput = z.infer<typeof MonthlyReportInputSchema>;

// ─── competitive-analysis ────────────────────────────────────────────

export const CompetitiveAnalysisInputSchema = DeliverySkillBaseSchema.extend({
  competitors: z.array(z.string().min(1)).min(1).max(10),
  industry: z.string().optional(),
  output_formats: z.array(z.enum(['pdf', 'pptx', 'docx'])).min(1).default(['pdf']),
});

export type CompetitiveAnalysisInput = z.infer<typeof CompetitiveAnalysisInputSchema>;

// ─── industry-benchmarks ─────────────────────────────────────────────

export const IndustryBenchmarksInputSchema = DeliverySkillBaseSchema.extend({
  industry: z.string().min(1),
  channels: z.array(z.string()).optional(),
  output_formats: z.array(z.enum(['pdf', 'xlsx'])).min(1).default(['pdf']),
});

export type IndustryBenchmarksInput = z.infer<typeof IndustryBenchmarksInputSchema>;

// ─── budget-proposal ─────────────────────────────────────────────────

export const BudgetProposalInputSchema = DeliverySkillBaseSchema.extend({
  proposed_budget: z.number().positive(),
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  objectives: z.array(z.string()).optional(),
  output_formats: z.array(z.enum(['pdf', 'docx'])).min(1).default(['pdf']),
});

export type BudgetProposalInput = z.infer<typeof BudgetProposalInputSchema>;

// ─── campaign-brief ──────────────────────────────────────────────────

export const CampaignBriefInputSchema = DeliverySkillBaseSchema.extend({
  campaign_name: z.string().min(1),
  objective: z.string().min(1),
  budget: z.number().positive().optional(),
  output_formats: z.array(z.enum(['pdf', 'docx'])).min(1).default(['docx']),
});

export type CampaignBriefInput = z.infer<typeof CampaignBriefInputSchema>;

// ─── project-status ──────────────────────────────────────────────────

export const ProjectStatusInputSchema = DeliverySkillBaseSchema.extend({
  as_of_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  output_formats: z.array(z.enum(['pdf', 'docx'])).min(1).default(['pdf']),
});

export type ProjectStatusInput = z.infer<typeof ProjectStatusInputSchema>;

// ─── quarterly-review ────────────────────────────────────────────────

export const QuarterlyReviewInputSchema = DeliverySkillBaseSchema.extend({
  quarter: z.string().regex(/^Q[1-4] \d{4}$/),  // e.g. "Q1 2026"
  output_formats: z.array(z.enum(['pptx', 'pdf'])).min(1).default(['pptx']),
});

export type QuarterlyReviewInput = z.infer<typeof QuarterlyReviewInputSchema>;

// ─── media-plan-deck ─────────────────────────────────────────────────

export const MediaPlanDeckInputSchema = DeliverySkillBaseSchema.extend({
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  total_budget: z.number().positive().optional(),
  output_formats: z.array(z.enum(['pptx', 'pdf'])).min(1).default(['pptx']),
});

export type MediaPlanDeckInput = z.infer<typeof MediaPlanDeckInputSchema>;

// ─── learnings-digest ────────────────────────────────────────────────

export const LearningsDigestInputSchema = DeliverySkillBaseSchema.extend({
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  output_formats: z.array(z.enum(['pdf', 'docx'])).min(1).default(['pdf']),
});

export type LearningsDigestInput = z.infer<typeof LearningsDigestInputSchema>;

// ─── client-scorecard-export ─────────────────────────────────────────

export const ClientScorecardExportInputSchema = DeliverySkillBaseSchema.extend({
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  output_formats: z.array(z.enum(['xlsx', 'pdf'])).min(1).default(['xlsx', 'pdf']),
});

export type ClientScorecardExportInput = z.infer<typeof ClientScorecardExportInputSchema>;

// ─── Shared delivery output schema ──────────────────────────────────

export const DeliverySkillOutputSchema = z.object({
  files: z.array(z.object({
    file_type: z.string(),
    file_name: z.string(),
    storage_key: z.string().optional(),
    download_url: z.string().optional(),
    size_bytes: z.number().optional(),
  })),
  summary: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
