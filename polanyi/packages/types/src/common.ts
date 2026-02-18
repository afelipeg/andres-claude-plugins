// ─── Shared Enums & Types ───────────────────────────────────────────

export type Industry = 'automotive' | 'fmcg' | 'financial' | 'retail' | 'telecom';

export type Severity = 'critical' | 'warning' | 'info';

export type DataSource = 'actual' | 'benchmark_estimate';

export type BenchmarkComparison = 'above' | 'below' | 'at';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Channel {
  name: string;
  spend: number;
  impressions?: number;
  clicks?: number;
  conversions?: number;
  revenue?: number;
}

export interface CSuiteSummary {
  ceo: string;
  cfo: string;
  cmo: string;
}

export interface RecoveryAction {
  category: string;
  action: string;
  estimated_savings: number;
  difficulty: Difficulty;
  timeline: string;
}
