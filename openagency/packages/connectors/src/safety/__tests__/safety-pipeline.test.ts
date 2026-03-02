// ─── Safety Pipeline Tests ─────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import type { SafetyContext, WriteOperation } from '@openagency/types';
import { SafetyPipeline } from '../pipeline.js';
import { DryRunGate } from '../dry-run-gate.js';
import { BudgetCapGate } from '../budget-cap-gate.js';
import { DailyWriteLimitGate } from '../daily-write-limit-gate.js';
import { ApprovalGate } from '../approval-gate.js';
import { RollbackTracker } from '../rollback-tracker.js';

function baseContext(overrides?: Partial<SafetyContext>): SafetyContext {
  return {
    current_budget: 10000,
    daily_spend_rate: 500,
    campaign_status: 'active',
    agent_config: {
      max_budget_change_pct: 20,
      approval_threshold_usd: 5000,
      dry_run: false,
    },
    recent_writes: [],
    ...overrides,
  };
}

function budgetAction(newBudget: number): { type: WriteOperation; parameters: Record<string, unknown> } {
  return {
    type: 'budget_update',
    parameters: { campaign_id: 'c1', new_budget: newBudget },
  };
}

function pauseAction(): { type: WriteOperation; parameters: Record<string, unknown> } {
  return {
    type: 'campaign_pause',
    parameters: { campaign_id: 'c1' },
  };
}

describe('SafetyPipeline', () => {
  it('DryRunGate blocks when dry_run=true', () => {
    const gate = new DryRunGate();
    const result = gate.check(budgetAction(11000), baseContext({
      agent_config: { max_budget_change_pct: 20, approval_threshold_usd: 5000, dry_run: true },
    }));
    expect(result.status).toBe('failed');
    expect(result.reason).toContain('Dry run');
  });

  it('BudgetCapGate blocks when change exceeds max %', () => {
    const gate = new BudgetCapGate();
    // 10000 → 14000 = 40% change, max = 20%
    const result = gate.check(budgetAction(14000), baseContext());
    expect(result.status).toBe('failed');
    expect(result.reason).toContain('40.0%');
  });

  it('BudgetCapGate passes within limit', () => {
    const gate = new BudgetCapGate();
    // 10000 → 11000 = 10% change, max = 20%
    const result = gate.check(budgetAction(11000), baseContext());
    expect(result.status).toBe('passed');
  });

  it('DailyWriteLimitGate blocks at 50 writes', () => {
    const gate = new DailyWriteLimitGate();
    const today = new Date().toISOString().slice(0, 10);
    const recentWrites = Array.from({ length: 50 }, (_, i) => ({
      operation: 'budget_update' as WriteOperation,
      timestamp: `${today}T12:00:00.000Z`,
      target_id: `c${i}`,
    }));
    const result = gate.check(pauseAction(), baseContext({ recent_writes: recentWrites }));
    expect(result.status).toBe('failed');
    expect(result.reason).toContain('Daily write limit');
  });

  it('ApprovalGate blocks when budget diff exceeds threshold', () => {
    const gate = new ApprovalGate();
    // 10000 → 20000 = $10K diff, threshold = $5K
    const result = gate.check(budgetAction(20000), baseContext());
    expect(result.status).toBe('failed');
    expect(result.reason).toContain('Requires human approval');
  });

  it('RollbackTracker always passes and records metadata', () => {
    const gate = new RollbackTracker();
    const result = gate.check(budgetAction(11000), baseContext());
    expect(result.status).toBe('passed');
    expect(result.metadata?.['previous_budget']).toBe(10000);
    expect(result.metadata?.['new_budget']).toBe(11000);
  });

  it('pipeline fail-fast: stops on first failure', () => {
    const pipeline = new SafetyPipeline();
    // dry_run = true → DryRunGate fails first, rest not checked
    const result = pipeline.evaluate(
      budgetAction(11000),
      baseContext({ agent_config: { max_budget_change_pct: 20, approval_threshold_usd: 5000, dry_run: true } }),
    );
    expect(result.approved).toBe(false);
    expect(result.checks).toHaveLength(1);
    expect(result.checks[0]!.gate).toBe('dry_run');
  });

  it('pipeline passes all gates for safe operation', () => {
    const pipeline = new SafetyPipeline();
    // 10000 → 11000 = 10% < 20%, $1000 < $5000, dry_run=false, < 50 writes
    const result = pipeline.evaluate(budgetAction(11000), baseContext());
    expect(result.approved).toBe(true);
    expect(result.checks).toHaveLength(5);
    expect(result.checks.every((c) => c.status === 'passed')).toBe(true);
  });
});
