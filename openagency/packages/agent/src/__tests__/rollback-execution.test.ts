import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ActionExecutor } from '../safety/action-executor.js';
import type { Decision, PlatformCredentials, SafetyPipelineResult } from '@openagency/types';

// ─── Mocks ──────────────────────────────────────────────────────────

function mockActionLogRepo() {
  const store = new Map<string, Record<string, unknown>>();
  return {
    store,
    create: vi.fn(async (entry: Record<string, unknown>) => {
      store.set(entry['id'] as string, entry);
    }),
    getById: vi.fn(async (id: string) => store.get(id) ?? null),
    listByAgent: vi.fn(async () => []),
    listByDecision: vi.fn(async () => []),
    countTodayByPlatform: vi.fn(async () => 0),
  };
}

function mockWriteRegistry() {
  return {
    executeWrite: vi.fn(async () => ({
      safety: {
        approved: true,
        checks: [
          {
            gate: 'rollback_tracker',
            status: 'passed' as const,
            metadata: {
              operation: 'budget_update',
              timestamp: new Date().toISOString(),
              previous_budget: 5000,
              new_budget: 7500,
            },
          },
        ],
      } satisfies SafetyPipelineResult,
      result: { success: true, platform: 'google_ads' as const, operation: 'budget_update' as const },
    })),
    registerWriter: vi.fn(),
    getWriter: vi.fn(),
    listWriters: vi.fn(() => []),
  };
}

const baseCreds: PlatformCredentials = {
  platform: 'google_ads',
  tokens: { access_token: 'test', refresh_token: 'test', token_type: 'Bearer', expires_at: Date.now() + 3600000 },
  connected_at: new Date().toISOString(),
};

const agentConfig = { max_budget_change_pct: 25, approval_threshold_usd: 1000, dry_run: false };

function makeDecision(overrides?: Partial<Decision>): Decision {
  return {
    id: 'dec-1',
    agent_id: 'agent-leak',
    actions: [
      {
        id: 'act-1',
        type: 'budget_update',
        target: { platform: 'google_ads', campaign_id: 'camp-123' },
        parameters: { campaign_id: 'camp-123', new_budget: 7500, current_budget: 5000 },
        dry_run: false,
        safety_checks: ['rollback_tracker'],
        estimated_impact: 'Budget increase 50%',
      },
    ],
    reasoning: 'Increase budget for high-performing campaign',
    confidence: 0.85,
    risk_level: 'low',
    requires_approval: true,
    status: 'approved',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────

describe('ActionExecutor rollback', () => {
  let executor: ActionExecutor;
  let logRepo: ReturnType<typeof mockActionLogRepo>;
  let writeReg: ReturnType<typeof mockWriteRegistry>;
  let credentials: Map<string, PlatformCredentials>;

  beforeEach(() => {
    logRepo = mockActionLogRepo();
    writeReg = mockWriteRegistry();
    executor = new ActionExecutor(writeReg as never, logRepo as never);
    credentials = new Map([['google_ads', baseCreds]]);
  });

  it('persists previous_value (rollback metadata) in action_log', async () => {
    const decision = makeDecision();
    const results = await executor.execute(decision, credentials, agentConfig);

    expect(results).toHaveLength(1);
    expect(results[0]!.status).toBe('executed');
    expect(results[0]!.rollback_available).toBe(true);
    expect(results[0]!.rollback_metadata).toBeDefined();
    expect(results[0]!.rollback_metadata!['previous_budget']).toBe(5000);

    // Verify action_log entry has previous_value
    expect(logRepo.create).toHaveBeenCalled();
    const logEntry = logRepo.create.mock.calls.find(
      (c) => (c[0] as Record<string, unknown>)['action_type'] === 'budget_update',
    );
    expect(logEntry).toBeDefined();
    expect((logEntry![0] as Record<string, unknown>)['previous_value']).toEqual({
      operation: 'budget_update',
      timestamp: expect.any(String),
      previous_budget: 5000,
      new_budget: 7500,
    });
  });

  it('rollbackAction builds correct inverse for budget_update', async () => {
    // First execute to populate action_log
    const decision = makeDecision();
    await executor.execute(decision, credentials, agentConfig);

    // Find the action_log entry ID
    const budgetLogCall = logRepo.create.mock.calls.find(
      (c) => (c[0] as Record<string, unknown>)['action_type'] === 'budget_update',
    );
    const actionLogId = (budgetLogCall![0] as Record<string, unknown>)['id'] as string;

    // Simulate what the DB would store (previous_value as parsed JSON)
    logRepo.store.set(actionLogId, {
      id: actionLogId,
      decision_id: 'dec-1',
      agent_id: 'agent-leak',
      action_type: 'budget_update',
      target_platform: 'google_ads',
      target_id: 'camp-123',
      parameters: { campaign_id: 'camp-123', new_budget: 7500, budget_type: 'daily' },
      previous_value: { previous_budget: 5000, new_budget: 7500 },
      status: 'executed',
      dry_run: false,
      duration_ms: 100,
    });

    // Reset mock to track rollback write call
    writeReg.executeWrite.mockClear();

    const result = await executor.rollbackAction(actionLogId, credentials, agentConfig);

    expect(result.status).toBe('executed');

    // Verify the write was called with inverse params
    expect(writeReg.executeWrite).toHaveBeenCalledTimes(1);
    const writeCall = (writeReg.executeWrite.mock.calls as unknown[][])[0]!;
    expect(writeCall[0]).toMatchObject({
      type: 'budget_update',
      platform: 'google_ads',
      parameters: {
        campaign_id: 'camp-123',
        new_budget: 5000, // restored to previous
        budget_type: 'daily',
      },
    });
  });

  it('rollbackAction returns error for non-executed actions', async () => {
    logRepo.store.set('act-skip', {
      id: 'act-skip',
      status: 'skipped',
      action_type: 'budget_update',
    });

    const result = await executor.rollbackAction('act-skip', credentials, agentConfig);
    expect(result.status).toBe('failed');
    expect(result.error).toContain('Cannot rollback action with status: skipped');
  });

  it('rollbackAction returns error when no previous_value recorded', async () => {
    logRepo.store.set('act-no-prev', {
      id: 'act-no-prev',
      status: 'executed',
      action_type: 'budget_update',
      previous_value: null,
    });

    const result = await executor.rollbackAction('act-no-prev', credentials, agentConfig);
    expect(result.status).toBe('failed');
    expect(result.error).toContain('No previous value');
  });

  it('rollbackAction returns error for unknown action log ID', async () => {
    const result = await executor.rollbackAction('nonexistent', credentials, agentConfig);
    expect(result.status).toBe('failed');
    expect(result.error).toContain('not found');
  });

  it('rollbackAction builds correct inverse for campaign_pause', async () => {
    logRepo.store.set('act-pause', {
      id: 'act-pause',
      decision_id: 'dec-2',
      agent_id: 'agent-leak',
      action_type: 'campaign_pause',
      target_platform: 'google_ads',
      target_id: 'camp-456',
      parameters: { campaign_id: 'camp-456' },
      previous_value: { previous_status: 'active' },
      status: 'executed',
      dry_run: false,
      duration_ms: 50,
    });

    const result = await executor.rollbackAction('act-pause', credentials, agentConfig);
    expect(result.status).toBe('executed');

    // Inverse of pause = enable
    const writeCall = (writeReg.executeWrite.mock.calls as unknown[][])[0]!;
    expect(writeCall[0]).toMatchObject({
      type: 'campaign_enable',
      platform: 'google_ads',
    });
  });

  it('rollbackAction logs the rollback action itself', async () => {
    logRepo.store.set('act-rb', {
      id: 'act-rb',
      decision_id: 'dec-3',
      agent_id: 'agent-leak',
      action_type: 'campaign_enable',
      target_platform: 'google_ads',
      target_id: 'camp-789',
      parameters: { campaign_id: 'camp-789' },
      previous_value: { previous_status: 'paused' },
      status: 'executed',
      dry_run: false,
      duration_ms: 30,
    });

    await executor.rollbackAction('act-rb', credentials, agentConfig);

    // Should have logged the rollback action
    const rollbackLog = logRepo.create.mock.calls.find(
      (c) => ((c[0] as Record<string, unknown>)['action_type'] as string).startsWith('rollback:'),
    );
    expect(rollbackLog).toBeDefined();
    expect((rollbackLog![0] as Record<string, unknown>)['action_type']).toBe('rollback:campaign_enable');
  });
});
