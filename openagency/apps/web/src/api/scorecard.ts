// ─── Scorecard API Client ──────────────────────────────────────────

const API_URL = import.meta.env.VITE_API_URL ?? '';
const API_KEY = import.meta.env.VITE_API_KEY ?? '';

function headers(): HeadersInit {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (API_KEY) h['X-API-Key'] = API_KEY;
  const token = localStorage.getItem('plinth_token');
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { ...init, headers: { ...headers(), ...init?.headers } });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

// ─── Types ──────────────────────────────────────────────────────────

export interface FeeBreakdown {
  category: 'recovery' | 'lift' | 'efficiency';
  base_amount: number;
  rate: number;
  fee: number;
  line_items: Array<{ label: string; amount: number }>;
}

export interface TierRates {
  tier: string;
  label: string;
  min_spend: number;
  max_spend: number | null;
  recovery_rate: number;
  lift_rate: number;
  efficiency_rate: number;
}

export interface MediaDrivenSalesResult {
  final_value: number;
  method: string;
  attribution_revenue: number;
  modeled_contribution: number;
  confidence: number;
}

export interface BillingResult {
  tier: TierRates;
  ad_spend: number;
  total_recovery: number;
  total_lift: number;
  total_efficiency_savings: number;
  media_driven_sales: MediaDrivenSalesResult;
  recovery_fee: FeeBreakdown;
  lift_fee: FeeBreakdown;
  efficiency_fee: FeeBreakdown;
  total_fee: number;
  fee_as_pct_of_spend: number;
  value_delivered: number;
  roi_on_fee: number;
}

export interface ScorecardRecord {
  id: string;
  created_at: string;
  ad_spend: number;
  billing: BillingResult;
  status: 'pending' | 'accepted' | 'rejected';
  feedback?: string;
}

export interface ScorecardSummary {
  id: string;
  created_at: string;
  ad_spend: number;
  total_fee: number;
  value_delivered: number;
  roi_on_fee: number;
  tier: string;
  status: string;
}

// ─── API Functions ──────────────────────────────────────────────────

export async function getLatestScorecard(): Promise<ScorecardRecord> {
  return fetchJson<ScorecardRecord>('/v1/scorecard');
}

export async function getScorecard(id: string): Promise<ScorecardRecord> {
  return fetchJson<ScorecardRecord>(`/v1/scorecard/${id}`);
}

export async function listScorecards(): Promise<ScorecardSummary[]> {
  const res = await fetchJson<{ scorecards: ScorecardSummary[] }>('/v1/scorecards');
  return res.scorecards;
}

export async function computeScorecard(engineOutputs: Record<string, unknown>): Promise<{
  scorecard_id: string;
  billing: BillingResult;
}> {
  return fetchJson('/v1/scorecard/compute', {
    method: 'POST',
    body: JSON.stringify(engineOutputs),
  });
}

export async function runScorecard(data: {
  ad_spend: number;
  data: Record<string, unknown>;
  engines?: string[];
}): Promise<{
  scorecard_id: string;
  engine_results: Record<string, unknown>;
  billing: BillingResult;
}> {
  return fetchJson('/v1/scorecard/run', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateScorecardStatus(
  id: string,
  status: 'accepted' | 'rejected',
  feedback?: string,
): Promise<ScorecardRecord> {
  return fetchJson<ScorecardRecord>(`/v1/scorecard/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, feedback }),
  });
}

export async function getTierPreview(adSpend: number): Promise<TierRates> {
  return fetchJson<TierRates>(`/v1/scorecard/tier-preview?ad_spend=${adSpend}`);
}
