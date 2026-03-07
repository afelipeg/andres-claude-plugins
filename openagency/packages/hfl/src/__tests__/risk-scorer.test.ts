import { describe, it, expect } from 'vitest';
import { RiskScorer, createDefaultConfig } from '../risk-scorer.js';
import type { HFLConfig, RiskInput } from '../types.js';

function makeConfig(overrides?: Partial<HFLConfig>): HFLConfig {
  return {
    ...createDefaultConfig('test-client'),
    ...overrides,
  };
}

function makeInput(overrides?: Partial<RiskInput>): RiskInput {
  return {
    run_id: 'run-1',
    pipeline_id: 'full-optimization',
    client_id: 'test-client',
    total_duration_ms: 5000,
    stages_executed: 4,
    stages_failed: 0,
    is_first_run: false,
    ...overrides,
  };
}

describe('RiskScorer', () => {
  it('auto-approves when within threshold and no risk factors', () => {
    const scorer = new RiskScorer(makeConfig({ auto_approve_threshold: 5000 }));
    const result = scorer.evaluate(makeInput({
      proposed_actions: [{ type: 'adjust', description: 'test', estimated_impact_usd: 500 }],
    }));

    expect(result.needs_human).toBe(false);
    expect(result.urgency).toBe('low');
    expect(result.risk_factors).toHaveLength(0);
  });

  it('escalates when impact exceeds threshold', () => {
    const scorer = new RiskScorer(makeConfig({ auto_approve_threshold: 1000 }));
    const result = scorer.evaluate(makeInput({
      proposed_actions: [
        { type: 'reallocate', description: 'test', estimated_impact_usd: 5000 },
        { type: 'pause', description: 'test', estimated_impact_usd: 3000 },
      ],
    }));

    expect(result.needs_human).toBe(true);
    expect(result.urgency).toBe('high');
    expect(result.total_impact_usd).toBe(8000);
    expect(result.risk_factors).toContain('impact_above_threshold: $8000.00 > $1000');
  });

  it('always escalates first run for client', () => {
    const scorer = new RiskScorer(makeConfig({ auto_approve_threshold: 999999 }));
    const result = scorer.evaluate(makeInput({ is_first_run: true }));

    expect(result.needs_human).toBe(true);
    expect(result.risk_factors).toContain('first_run_for_client');
  });

  it('escalates when stages failed', () => {
    const scorer = new RiskScorer(makeConfig());
    const result = scorer.evaluate(makeInput({ stages_failed: 2 }));

    expect(result.needs_human).toBe(true);
    expect(result.risk_factors.some((f) => f.startsWith('stages_failed'))).toBe(true);
  });

  it('applies custom escalation rules', () => {
    const scorer = new RiskScorer(makeConfig({
      auto_approve_threshold: 100,
      escalation_rules: [
        { condition: 'budget_change > 5000', urgency: 'critical', channel_id: 'slack' },
      ],
    }));

    const result = scorer.evaluate(makeInput({
      proposed_actions: [{ type: 'reallocate', description: 'test', estimated_impact_usd: 6000 }],
    }));

    expect(result.needs_human).toBe(true);
    expect(result.urgency).toBe('critical');
    expect(result.risk_factors.some((f) => f.includes('budget_change > 5000'))).toBe(true);
  });

  it('evaluates duration condition', () => {
    const scorer = new RiskScorer(makeConfig({
      auto_approve_threshold: 0,
      escalation_rules: [
        { condition: 'duration > 10000', urgency: 'medium', channel_id: '' },
      ],
    }));

    const result = scorer.evaluate(makeInput({ total_duration_ms: 15000 }));
    expect(result.risk_factors.some((f) => f.includes('duration > 10000'))).toBe(true);
  });

  it('auto-approves with zero proposed actions and no flags', () => {
    const scorer = new RiskScorer(makeConfig({ auto_approve_threshold: 1000 }));
    const result = scorer.evaluate(makeInput());

    expect(result.needs_human).toBe(false);
    expect(result.total_impact_usd).toBe(0);
  });
});
