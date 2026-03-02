// ─── Mock LLM for Testing ───────────────────────────────────────────
// Provides canned orient/decide responses for deterministic tests.

import { vi } from 'vitest';
import type { Orientation } from '@openagency/types';
import type { DecisionPlan } from '../../reasoning/decide-prompt.js';

export const DEFAULT_ORIENTATION: Orientation = {
  observations_analyzed: 3,
  context: { engine: 'test' },
  anomalies: [
    {
      metric: 'ctr',
      expected: 0.05,
      actual: 0.02,
      deviation_pct: -60,
      severity: 'high',
    },
  ],
  opportunities: [
    {
      description: 'Rebalance budget to Search',
      potential_impact: 15000,
      confidence: 0.8,
      suggested_action: 'Shift 20% of Display budget to Search',
    },
  ],
  risks: [
    {
      description: 'Display overspend',
      severity: 'medium',
      probability: 0.6,
      mitigation: 'Reduce Display daily cap',
    },
  ],
  reasoning: 'CTR anomaly detected in Display channel, opportunity in Search.',
};

export const DEFAULT_DECISION_PLAN: DecisionPlan = {
  actions: [
    {
      type: 'skill_execution',
      target: {},
      parameters: { skill: 'waste-waterfall' },
      estimated_impact: 'Identify $50K waste',
    },
  ],
  reasoning: 'Running waste analysis to quantify Display leakage.',
  confidence: 0.85,
  risk_level: 'low',
};

export const HIGH_RISK_DECISION_PLAN: DecisionPlan = {
  actions: [
    {
      type: 'budget_update',
      target: { platform: 'meta', campaign_id: 'camp_123' },
      parameters: { new_budget: 50000, current_budget: 100000 },
      estimated_impact: 'Cut Display by 50%',
      rollback_plan: 'Restore budget to $100K',
    },
  ],
  reasoning: 'Drastic budget cut required.',
  confidence: 0.3,
  risk_level: 'high',
};

/**
 * Install mock orient/decide modules.
 * Call in `beforeEach` with `vi.mock`.
 */
export function installMockLLM(
  orientResponse = DEFAULT_ORIENTATION,
  decideResponse = DEFAULT_DECISION_PLAN,
) {
  const mockOrient = vi.fn().mockResolvedValue(orientResponse);
  const mockDecide = vi.fn().mockResolvedValue(decideResponse);

  vi.doMock('../../reasoning/orient-prompt.js', () => ({
    orient: mockOrient,
  }));

  vi.doMock('../../reasoning/decide-prompt.js', () => ({
    decide: mockDecide,
  }));

  return { mockOrient, mockDecide };
}
