// ─── Demo API Client ──────────────────────────────────────────────
// Runs the full demo flow: all 4 engines + billing scorecard.

import { runScorecard, type BillingResult } from './scorecard';
import { DEMO_AD_SPEND, DEMO_DATA } from '../data/demo-data';

export interface DemoResult {
  scorecard_id: string;
  engine_results: Record<string, unknown>;
  billing: BillingResult;
}

export async function runFullDemo(): Promise<DemoResult> {
  return runScorecard({
    ad_spend: DEMO_AD_SPEND,
    data: DEMO_DATA,
  });
}

export { DEMO_AD_SPEND } from '../data/demo-data';
