// ─── Common Zod Schemas ─────────────────────────────────────────────

import { z } from 'zod';

export const IndustrySchema = z.enum([
  'automotive',
  'fmcg',
  'financial',
  'retail',
  'telecom',
]);

export const SeveritySchema = z.enum(['critical', 'warning', 'info']);

export const DataSourceSchema = z.enum(['actual', 'benchmark_estimate']);

export const BenchmarkComparisonSchema = z.enum(['above', 'below', 'at']);

export const DifficultySchema = z.enum(['easy', 'medium', 'hard']);

export const ChannelSchema = z.object({
  name: z.string(),
  spend: z.number(),
  impressions: z.number().optional(),
  clicks: z.number().optional(),
  conversions: z.number().optional(),
  revenue: z.number().optional(),
});

export const CSuiteSummarySchema = z.object({
  ceo: z.string(),
  cfo: z.string(),
  cmo: z.string(),
});

export const RecoveryActionSchema = z.object({
  category: z.string(),
  action: z.string(),
  estimated_savings: z.number(),
  difficulty: DifficultySchema,
  timeline: z.string(),
});
