// ─── Action Executor Tests ─────────────────────────────────────────
import { describe, it, expect, vi } from 'vitest';
import type { Decision, PlannedAction } from '@openagency/types';
import { ActionExecutor } from '../safety/action-executor.js';
import { MockActionLogRepo } from './helpers/mock-repos.js';
import { MockConnectorWriteRegistry } from './helpers/mock-write-registry.js';

function makeDecision(actions: PlannedAction[], overrides?: Partial<Decision>): Decision {
  return {
    id: 'dec_1',
    agent_id: 'leak-detector',
    actions,
    reasoning: 'test',
    confidence: 0.9,
    risk_level: 'low',
    requires_approval: false,
    status: 'approved',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeAction(type: PlannedAction['type'] = 'skill_execution', overrides?: Partial<PlannedAction>): PlannedAction {
  return {
    id: 'act_1',
    type,
    target: {},
    parameters: { skill: 'waste-waterfall' },
    dry_run: false,
    safety_checks: [],
    estimated_impact: 'Test',
    ...overrides,
  };
}

describe('ActionExecutor', () => {
  it('bypasses connector write for skill_execution', async () => {
    const registry = new MockConnectorWriteRegistry();
    const logRepo = new MockActionLogRepo();
    const executor = new ActionExecutor(registry as never, logRepo as never);

    const action = makeAction('skill_execution');
    const decision = makeDecision([action]);

    const results = await executor.execute(decision, new Map(), {
      max_budget_change_pct: 20,
      approval_threshold_usd: 5000,
      dry_run: false,
    });

    expect(results).toHaveLength(1);
    expect(results[0]!.status).toBe('executed');
    expect(registry.calls).toHaveLength(0);
  });

  it('bypasses connector write for notification', async () => {
    const registry = new MockConnectorWriteRegistry();
    const logRepo = new MockActionLogRepo();
    const executor = new ActionExecutor(registry as never, logRepo as never);

    const action = makeAction('notification');
    const decision = makeDecision([action]);

    const results = await executor.execute(decision, new Map(), {
      max_budget_change_pct: 20,
      approval_threshold_usd: 5000,
      dry_run: false,
    });

    expect(results).toHaveLength(1);
    expect(results[0]!.status).toBe('executed');
  });

  it('routes budget_update through write registry', async () => {
    const registry = new MockConnectorWriteRegistry();
    const logRepo = new MockActionLogRepo();
    const executor = new ActionExecutor(registry as never, logRepo as never);

    const action = makeAction('budget_update', {
      id: 'act_budget',
      target: { platform: 'meta', campaign_id: 'c1' },
      parameters: { new_budget: 5000, campaign_id: 'c1', current_budget: 10000 },
    });

    const creds = new Map([['meta', { platform: 'meta', access_token: 'tok', account_id: 'acc1' }]]);
    const decision = makeDecision([action]);

    const results = await executor.execute(decision, creds as never, {
      max_budget_change_pct: 20,
      approval_threshold_usd: 5000,
      dry_run: false,
    });

    expect(results).toHaveLength(1);
    expect(results[0]!.status).toBe('executed');
    expect(registry.calls).toHaveLength(1);
    expect(registry.calls[0]!.action.type).toBe('budget_update');
  });

  it('returns skipped when safety rejects', async () => {
    const registry = new MockConnectorWriteRegistry();
    registry.setSafetyResult({
      approved: false,
      checks: [{ gate: 'budget_cap', status: 'failed', reason: 'Exceeds limit' }],
    });

    const logRepo = new MockActionLogRepo();
    const executor = new ActionExecutor(registry as never, logRepo as never);

    const action = makeAction('budget_update', {
      id: 'act_safety',
      target: { platform: 'meta', campaign_id: 'c1' },
      parameters: { new_budget: 50000, campaign_id: 'c1', current_budget: 10000 },
    });

    const creds = new Map([['meta', { platform: 'meta', access_token: 'tok', account_id: 'acc1' }]]);
    const decision = makeDecision([action]);

    const results = await executor.execute(decision, creds as never, {
      max_budget_change_pct: 20,
      approval_threshold_usd: 5000,
      dry_run: false,
    });

    expect(results[0]!.status).toBe('skipped');
    expect(results[0]!.error).toContain('Exceeds limit');
  });

  it('returns skipped when no credentials', async () => {
    const registry = new MockConnectorWriteRegistry();
    const logRepo = new MockActionLogRepo();
    const executor = new ActionExecutor(registry as never, logRepo as never);

    const action = makeAction('budget_update', {
      id: 'act_nocreds',
      target: { platform: 'meta', campaign_id: 'c1' },
      parameters: { new_budget: 5000, campaign_id: 'c1' },
    });

    const decision = makeDecision([action]);
    const results = await executor.execute(decision, new Map(), {
      max_budget_change_pct: 20,
      approval_threshold_usd: 5000,
      dry_run: false,
    });

    expect(results[0]!.status).toBe('skipped');
    expect(results[0]!.error).toContain('No credentials');
  });

  it('handles write failure gracefully', async () => {
    const registry = new MockConnectorWriteRegistry();
    registry.setWriteResult({
      success: false,
      platform: 'meta' as never,
      operation: 'budget_update',
      target_id: 'c1',
      timestamp: new Date().toISOString(),
      dry_run: false,
      error: 'API rate limited',
    });

    const logRepo = new MockActionLogRepo();
    const executor = new ActionExecutor(registry as never, logRepo as never);

    const action = makeAction('budget_update', {
      id: 'act_fail',
      target: { platform: 'meta', campaign_id: 'c1' },
      parameters: { new_budget: 5000, campaign_id: 'c1', current_budget: 10000 },
    });

    const creds = new Map([['meta', { platform: 'meta', access_token: 'tok', account_id: 'acc1' }]]);
    const decision = makeDecision([action]);

    const results = await executor.execute(decision, creds as never, {
      max_budget_change_pct: 20,
      approval_threshold_usd: 5000,
      dry_run: false,
    });

    expect(results[0]!.status).toBe('failed');
  });

  it('logs action to ActionLogRepo', async () => {
    const registry = new MockConnectorWriteRegistry();
    const logRepo = new MockActionLogRepo();
    const executor = new ActionExecutor(registry as never, logRepo as never);

    const action = makeAction('skill_execution', { id: 'act_log' });
    const decision = makeDecision([action]);

    await executor.execute(decision, new Map(), {
      max_budget_change_pct: 20,
      approval_threshold_usd: 5000,
      dry_run: false,
    });

    expect(logRepo._store).toHaveLength(1);
    expect(logRepo._store[0]!.action_type).toBe('skill_execution');
    expect(logRepo._store[0]!.decision_id).toBe('dec_1');
  });

  it('handles multiple actions in sequence', async () => {
    const registry = new MockConnectorWriteRegistry();
    const logRepo = new MockActionLogRepo();
    const executor = new ActionExecutor(registry as never, logRepo as never);

    const actions = [
      makeAction('skill_execution', { id: 'act_a' }),
      makeAction('notification', { id: 'act_b' }),
    ];
    const decision = makeDecision(actions);

    const results = await executor.execute(decision, new Map(), {
      max_budget_change_pct: 20,
      approval_threshold_usd: 5000,
      dry_run: false,
    });

    expect(results).toHaveLength(2);
    expect(results.every((r) => r.status === 'executed')).toBe(true);
  });
});
