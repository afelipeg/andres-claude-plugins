// ─── Industry & Quality Benchmarks ──────────────────────────────────
// Extracted from waste_waterfall.py, supply_chain_audit.py, media_quality_score.py

import type { Industry } from '@openagency/types';

// ─── Waste Waterfall Benchmarks (from waste_waterfall.py lines 16-27) ───

export const INDUSTRY_BENCHMARKS: Record<
  Industry,
  Record<string, number>
> = {
  automotive: {
    non_working: 0.18, supply_chain: 0.08, quality: 0.12,
    audience: 0.10, optimization: 0.05, measurement: 0.02,
  },
  fmcg: {
    non_working: 0.15, supply_chain: 0.10, quality: 0.14,
    audience: 0.08, optimization: 0.04, measurement: 0.02,
  },
  financial: {
    non_working: 0.20, supply_chain: 0.07, quality: 0.10,
    audience: 0.13, optimization: 0.06, measurement: 0.04,
  },
  retail: {
    non_working: 0.14, supply_chain: 0.09, quality: 0.11,
    audience: 0.08, optimization: 0.05, measurement: 0.03,
  },
  telecom: {
    non_working: 0.17, supply_chain: 0.11, quality: 0.13,
    audience: 0.09, optimization: 0.05, measurement: 0.03,
  },
};

// ─── Supply Chain Benchmarks (from supply_chain_audit.py lines 15-31) ───

export const CPM_BENCHMARKS: Record<
  string,
  { min: number; median: number; max: number; anomaly: number }
> = {
  programmatic_display: { min: 1.50, median: 3.50, max: 8.00, anomaly: 12.00 },
  programmatic_video: { min: 8.00, median: 15.00, max: 30.00, anomaly: 45.00 },
  social_meta: { min: 4.00, median: 8.00, max: 15.00, anomaly: 22.00 },
  social_tiktok: { min: 3.00, median: 6.00, max: 12.00, anomaly: 18.00 },
  native: { min: 2.50, median: 5.00, max: 10.00, anomaly: 15.00 },
  linkedin: { min: 10.00, median: 20.00, max: 35.00, anomaly: 50.00 },
};

export const FEE_BENCHMARKS: Record<
  string,
  { typical_pct: number; max_acceptable_pct: number }
> = {
  dsp: { typical_pct: 12, max_acceptable_pct: 18 },
  ssp: { typical_pct: 10, max_acceptable_pct: 15 },
  verification: { typical_pct: 3, max_acceptable_pct: 5 },
  data: { typical_pct: 5, max_acceptable_pct: 10 },
  reseller: { typical_pct: 15, max_acceptable_pct: 20 },
  platform: { typical_pct: 0, max_acceptable_pct: 0 },
};

// ─── Quality Benchmarks (from media_quality_score.py lines 14-25) ───

export const QUALITY_BENCHMARKS: Record<
  string,
  { ivt: number; viewability: number; brand_safety: number; mfa: number }
> = {
  programmatic_display: { ivt: 10, viewability: 52, brand_safety: 97, mfa: 15 },
  programmatic_video: { ivt: 8, viewability: 65, brand_safety: 96, mfa: 8 },
  social_meta: { ivt: 3, viewability: 75, brand_safety: 98, mfa: 2 },
  social_paid: { ivt: 3, viewability: 75, brand_safety: 98, mfa: 2 },
  social_tiktok: { ivt: 5, viewability: 70, brand_safety: 95, mfa: 5 },
  search: { ivt: 2, viewability: 100, brand_safety: 99, mfa: 1 },
  native: { ivt: 12, viewability: 45, brand_safety: 94, mfa: 20 },
  linkedin: { ivt: 3, viewability: 60, brand_safety: 98, mfa: 2 },
};

export const QUALITY_WEIGHTS = {
  fraud: 0.30,
  viewability: 0.30,
  brand_safety: 0.20,
  mfa: 0.20,
} as const;

// ─── Recovery Metadata ──────────────────────────────────────────────

export const DIFFICULTY_MAP: Record<string, 'easy' | 'medium' | 'hard'> = {
  non_working: 'medium',
  supply_chain: 'hard',
  quality: 'easy',
  audience: 'medium',
  optimization: 'easy',
  measurement: 'medium',
};

export const TIMELINE_MAP: Record<string, string> = {
  non_working: '3-6 months',
  supply_chain: '6-12 months',
  quality: '1-3 months',
  audience: '1-3 months',
  optimization: 'immediate',
  measurement: '3-6 months',
};
