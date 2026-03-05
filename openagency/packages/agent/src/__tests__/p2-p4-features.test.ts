// ─── P2-P4 Feature Tests ────────────────────────────────────────────
// Rate floor, credential wiring, goal tracker fix, safety audit trail,
// mesh context enrichment.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InMemoryEventBus } from '@openagency/events';
import type { Observation, Orientation, PlatformCredentials, Goal } from '@openagency/types';
import type { DecisionPlan } from '../reasoning/decide-prompt.js';
import {
  MockAgentStateRepo,
  MockDecisionRepo,
  MockActionLogRepo,
  MockOutcomeRepo,
  MockMemoryRepo,
  MockGoalRepo,
} from './helpers/mock-repos.js';

// ─── Default mocks ─────────────────────────────────────────────────

const DEFAULT_ORIENTATION: Orientation = {
  observations_analyzed: 1,
  context: {},
  anomalies: [],
  opportunities: [],
  risks: [],
  reasoning: 'Test orientation reasoning for P2-P4',
};

const DEFAULT_PLAN: DecisionPlan = {
  actions: [
    {
      type: 'skill_execution',
      target: {},
      parameters: { skill: 'test' },
      estimated_impact: 'Test impact',
    },
  ],
  reasoning: 'Test decision',
  confidence: 0.85,
  risk_level: 'low',
};

vi.mock('../reasoning/orient-prompt.js', () => ({
  orient: vi.fn().mockResolvedValue(DEFAULT_ORIENTATION),
}));

vi.mock('../reasoning/decide-prompt.js', () => ({
  decide: vi.fn().mockResolvedValue(DEFAULT_PLAN),
}));

const { OodaRuntime } = await import('../ooda-runtime.js');
const { orient } = await import('../reasoning/orient-prompt.js');
const { decide } = await import('../reasoning/decide-prompt.js');

function makeObs(): Observation {
  return {
    id: 'obs_1',
    source: 'test',
    type: 'sync_data',
    data: { test: true },
    timestamp: new Date().toISOString(),
  };
}

function createRuntime(overrides: Record<string, unknown> = {}) {
  const eventBus = new InMemoryEventBus();
  const agentStateRepo = new MockAgentStateRepo();
  const decisionRepo = new MockDecisionRepo();
  const actionLogRepo = new MockActionLogRepo();
  const outcomeRepo = new MockOutcomeRepo();
  const memoryRepo = new MockMemoryRepo();
  const goalRepo = new MockGoalRepo();

  const agency = { run: vi.fn(), engines: { register: vi.fn() }, listEngines: vi.fn() } as never;
  const connectors = {
    registerWriter: vi.fn(),
    getWriter: vi.fn(),
    listWriters: vi.fn().mockReturnValue([]),
    executeWrite: vi.fn().mockResolvedValue({
      safety: { approved: true, checks: [] },
      result: { success: true, platform: 'meta', operation: 'budget_update', target_id: 'c1', timestamp: new Date().toISOString(), dry_run: false },
    }),
  } as never;

  const runtime = new OodaRuntime({
    engineId: 'leak-detector',
    agency,
    eventBus,
    connectors,
    llmConfig: { provider: 'anthropic' as const, model: 'test' },
    agentStateRepo: agentStateRepo as never,
    decisionRepo: decisionRepo as never,
    actionLogRepo: actionLogRepo as never,
    outcomeRepo: outcomeRepo as never,
    memoryRepo: memoryRepo as never,
    goalRepo: goalRepo as never,
    ...overrides,
  });

  return { runtime, eventBus, agentStateRepo, decisionRepo, actionLogRepo, outcomeRepo, memoryRepo, goalRepo };
}

// ─── P2: Rate Floor ────────────────────────────────────────────────

describe('P2: Rate Floor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(orient).mockResolvedValue(DEFAULT_ORIENTATION);
    vi.mocked(decide).mockResolvedValue(DEFAULT_PLAN);
  });

  it('blocks rapid back-to-back cycles', async () => {
    const { runtime } = createRuntime({
      config: { min_cycle_interval_ms: 60_000 }, // 60s floor
    });

    // First cycle runs normally
    const first = await runtime.cycle([makeObs()]);
    expect(first.observe.observation_count).toBe(1);
    expect(orient).toHaveBeenCalledOnce();

    // Second immediate cycle is blocked by rate floor
    const second = await runtime.cycle([makeObs()]);
    expect(second.observe.observation_count).toBe(0);
    expect(second.orient).toBeNull();
    // orient should NOT be called again
    expect(orient).toHaveBeenCalledOnce();
  });

  it('allows cycle after min interval elapses', async () => {
    const { runtime } = createRuntime({
      config: { min_cycle_interval_ms: 1 }, // 1ms floor
    });

    await runtime.cycle([makeObs()]);
    expect(orient).toHaveBeenCalledOnce();

    // Wait for the interval
    await new Promise((r) => setTimeout(r, 5));

    await runtime.cycle([makeObs()]);
    expect(orient).toHaveBeenCalledTimes(2);
  });

  it('does not block when min_cycle_interval_ms is 0', async () => {
    const { runtime } = createRuntime({
      config: { min_cycle_interval_ms: 0 },
    });

    await runtime.cycle([makeObs()]);
    await runtime.cycle([makeObs()]);
    expect(orient).toHaveBeenCalledTimes(2);
  });
});

// ─── P2: Credential Store Wiring ───────────────────────────────────

describe('P2: Credential Store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(orient).mockResolvedValue(DEFAULT_ORIENTATION);
  });

  it('passes credentials from store to action executor', async () => {
    const mockCreds: PlatformCredentials = {
      platform: 'meta_ads',
      tokens: { access_token: 'test_token', token_type: 'bearer', expires_at: Date.now() + 3600000 },
      connected_at: new Date().toISOString(),
    };

    const credentialStore = {
      get: vi.fn().mockReturnValue(mockCreds),
    };

    // Budget update action that goes through connector writes
    const BUDGET_PLAN: DecisionPlan = {
      actions: [
        {
          type: 'budget_update',
          target: { platform: 'meta_ads', campaign_id: 'c1' },
          parameters: { new_budget: 1000, current_budget: 2000 },
          estimated_impact: 'Cut budget',
        },
      ],
      reasoning: 'Budget cut',
      confidence: 0.9,
      risk_level: 'low',
    };
    vi.mocked(decide).mockResolvedValue(BUDGET_PLAN);

    const { runtime } = createRuntime({
      credentialStore,
      config: { writable_platforms: ['meta_ads'] },
    });

    await runtime.cycle([makeObs()]);

    // Credential store should have been queried for writable platforms
    expect(credentialStore.get).toHaveBeenCalledWith('meta_ads');
  });

  it('works without credential store (backward compatible)', async () => {
    vi.mocked(decide).mockResolvedValue(DEFAULT_PLAN);
    const { runtime } = createRuntime();

    // Should not throw
    const result = await runtime.cycle([makeObs()]);
    expect(result.observe.observation_count).toBe(1);
  });
});

// ─── P3: GoalTracker adjustPlan bug fix ────────────────────────────

describe('P3: GoalTracker', () => {
  it('adjustPlan persists updated sub_tasks via updateSubTasks', async () => {
    const goalRepo = new MockGoalRepo();

    const goal: Goal = {
      id: 'goal_1',
      agent_id: 'leak-detector',
      name: 'Reduce waste',
      description: 'Reduce ad waste by 20%',
      type: 'minimize',
      target_metric: 'waste_pct',
      target_value: 10,
      current_value: 25,
      priority: 1,
      status: 'active',
      constraints: {},
      sub_tasks: [
        { id: 'st_1', description: 'Audit campaigns', assigned_agent: 'leak-detector', skill_to_run: 'waste-waterfall', status: 'completed', depends_on: [] },
        { id: 'st_2', description: 'Cut bad placements', assigned_agent: 'leak-detector', skill_to_run: 'supply-chain-audit', status: 'pending', depends_on: [] },
      ],
      progress_pct: 30,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await goalRepo.create(goal);

    const mockDecomposer = {
      decompose: vi.fn().mockResolvedValue([
        { id: 'st_new_1', description: 'New task A', assigned_agent: 'leak-detector', skill_to_run: 'test', status: 'pending', depends_on: [] },
        { id: 'st_new_2', description: 'New task B', assigned_agent: 'leak-detector', skill_to_run: 'test2', status: 'pending', depends_on: [] },
      ]),
    } as never;

    const { GoalTracker } = await import('../goals/goal-tracker.js');
    const tracker = new GoalTracker(goalRepo as never);

    await tracker.adjustPlan('goal_1', mockDecomposer);

    // Verify sub_tasks were persisted (not just progress)
    const updated = await goalRepo.get('goal_1');
    expect(updated!.sub_tasks).toHaveLength(3); // 1 completed + 2 new
    expect(updated!.sub_tasks[0]!.status).toBe('completed');
    expect(updated!.sub_tasks[1]!.description).toBe('New task A');
    expect(updated!.sub_tasks[2]!.description).toBe('New task B');
  });

  it('checkProgress calculates on_track correctly', async () => {
    const goalRepo = new MockGoalRepo();

    const goal: Goal = {
      id: 'goal_2',
      agent_id: 'leak-detector',
      name: 'Maximize ROAS',
      description: 'Maximize return on ad spend',
      type: 'maximize',
      target_metric: 'roas',
      target_value: 5.0,
      current_value: 2.5,
      priority: 1,
      status: 'active',
      constraints: {},
      sub_tasks: [],
      progress_pct: 50,
      created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
      updated_at: new Date().toISOString(),
    };
    await goalRepo.create(goal);

    const { GoalTracker } = await import('../goals/goal-tracker.js');
    const tracker = new GoalTracker(goalRepo as never);

    const reports = await tracker.checkProgress('leak-detector');
    expect(reports).toHaveLength(1);
    expect(reports[0]!.progress_pct).toBe(50);
  });

  it('updateMetric auto-completes at 100%', async () => {
    const goalRepo = new MockGoalRepo();

    const goal: Goal = {
      id: 'goal_3',
      agent_id: 'leak-detector',
      name: 'Reduce CPA',
      description: 'Reduce CPA to $10',
      type: 'minimize',
      target_metric: 'cpa',
      target_value: 10,
      current_value: 15,
      priority: 1,
      status: 'active',
      constraints: {},
      sub_tasks: [],
      progress_pct: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await goalRepo.create(goal);

    const { GoalTracker } = await import('../goals/goal-tracker.js');
    const tracker = new GoalTracker(goalRepo as never);

    await tracker.updateMetric('goal_3', 8); // Below target → 100%
    const updated = await goalRepo.get('goal_3');
    expect(updated!.status).toBe('completed');
    expect(updated!.progress_pct).toBe(100);
  });
});

// ─── P4: Mesh Context Enrichment ───────────────────────────────────

describe('P4: Mesh Context Enrichment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(orient).mockResolvedValue(DEFAULT_ORIENTATION);
    vi.mocked(decide).mockResolvedValue(DEFAULT_PLAN);
  });

  it('extractOutputSummary includes anomaly/opportunity counts', async () => {
    const orientationWithSignals: Orientation = {
      ...DEFAULT_ORIENTATION,
      anomalies: [
        { metric: 'ctr', expected: 0.05, actual: 0.02, deviation_pct: -60, severity: 'high' },
      ],
      opportunities: [
        { description: 'Shift budget', potential_impact: 5000, confidence: 0.8, suggested_action: 'reallocate' },
        { description: 'New channel', potential_impact: 3000, confidence: 0.6, suggested_action: 'expand' },
      ],
      risks: [
        { description: 'Budget overrun', severity: 'medium', probability: 0.3, mitigation: 'cap' },
      ],
    };
    vi.mocked(orient).mockResolvedValue(orientationWithSignals);

    const eventBus = new InMemoryEventBus();
    const agents = new Map();

    // Create a real runtime for the agent
    const { runtime } = createRuntime();
    agents.set('leak-detector', runtime);

    const { MeshCoordinator } = await import('../mesh/mesh-coordinator.js');
    const mesh = new MeshCoordinator(agents, eventBus);

    mesh.registerPipeline({
      id: 'test-pipeline',
      name: 'Test Pipeline',
      description: 'Test',
      trigger: 'manual',
      stages: [
        {
          agent_id: 'leak-detector',
          order: 1,
          skills: ['leak-detector:waste-waterfall'],
          trigger_events: [],
          emit_events: [],
          timeout_ms: 10000,
        },
      ],
    });

    const run = await mesh.executePipeline('test-pipeline');
    const stageResult = run.context.stage_results.get('leak-detector');

    expect(stageResult).toBeDefined();
    expect(stageResult!.output_summary).toBeDefined();
    expect(stageResult!.output_summary!['anomaly_count']).toBe(1);
    expect(stageResult!.output_summary!['opportunity_count']).toBe(2);
    expect(stageResult!.output_summary!['risk_count']).toBe(1);
    expect(stageResult!.output_summary!['observation_count']).toBe(1);
    expect(typeof stageResult!.output_summary!['reasoning_snippet']).toBe('string');
  });

  it('output_summary included in serialized run', async () => {
    vi.mocked(orient).mockResolvedValue(DEFAULT_ORIENTATION);

    const eventBus = new InMemoryEventBus();
    const agents = new Map();
    const { runtime } = createRuntime();
    agents.set('leak-detector', runtime);

    const { MeshCoordinator } = await import('../mesh/mesh-coordinator.js');
    const mesh = new MeshCoordinator(agents, eventBus);

    mesh.registerPipeline({
      id: 'test-pipeline-2',
      name: 'Test',
      description: 'Test',
      trigger: 'manual',
      stages: [
        {
          agent_id: 'leak-detector',
          order: 1,
          skills: [],
          trigger_events: [],
          emit_events: [],
          timeout_ms: 10000,
        },
      ],
    });

    const run = await mesh.executePipeline('test-pipeline-2');
    const serialized = mesh.serializeRun(run);
    const stageResults = serialized['stage_results'] as Record<string, Record<string, unknown>>;

    expect(stageResults['leak-detector']!['output_summary']).toBeDefined();
  });
});
