// ─── OODA Runtime Integration Tests ────────────────────────────────
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InMemoryEventBus } from '@openagency/events';
import type { EngineEvent, Observation, Orientation } from '@openagency/types';
import type { DecisionPlan } from '../reasoning/decide-prompt.js';
import {
  MockAgentStateRepo,
  MockDecisionRepo,
  MockActionLogRepo,
  MockOutcomeRepo,
  MockMemoryRepo,
  MockGoalRepo,
} from './helpers/mock-repos.js';

// ─── Mocks ─────────────────────────────────────────────────────────
const DEFAULT_ORIENTATION: Orientation = {
  observations_analyzed: 1,
  context: {},
  anomalies: [],
  opportunities: [],
  risks: [],
  reasoning: 'Test orientation',
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

const HIGH_RISK_PLAN: DecisionPlan = {
  actions: [
    {
      type: 'budget_update',
      target: { platform: 'meta', campaign_id: 'c1' },
      parameters: { new_budget: 50000 },
      estimated_impact: 'Cut budget 50%',
    },
  ],
  reasoning: 'High-risk cut',
  confidence: 0.3,
  risk_level: 'high',
};

vi.mock('../reasoning/orient-prompt.js', () => ({
  orient: vi.fn().mockResolvedValue(DEFAULT_ORIENTATION),
}));

vi.mock('../reasoning/decide-prompt.js', () => ({
  decide: vi.fn().mockResolvedValue(DEFAULT_PLAN),
}));

// Import after mocks
const { OodaRuntime } = await import('../ooda-runtime.js');
const { orient } = await import('../reasoning/orient-prompt.js');
const { decide } = await import('../reasoning/decide-prompt.js');

function makeObs(type = 'sync_data'): Observation {
  return {
    id: 'obs_1',
    source: 'test',
    type: type as Observation['type'],
    data: { test: true },
    timestamp: new Date().toISOString(),
  };
}

function createRuntime() {
  const eventBus = new InMemoryEventBus();
  const agentStateRepo = new MockAgentStateRepo();
  const decisionRepo = new MockDecisionRepo();
  const actionLogRepo = new MockActionLogRepo();
  const outcomeRepo = new MockOutcomeRepo();
  const memoryRepo = new MockMemoryRepo();
  const goalRepo = new MockGoalRepo();

  // Minimal OpenAgency stub
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
  });

  return { runtime, eventBus, agentStateRepo, decisionRepo, actionLogRepo, outcomeRepo, memoryRepo, goalRepo };
}

describe('OodaRuntime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(orient).mockResolvedValue(DEFAULT_ORIENTATION);
    vi.mocked(decide).mockResolvedValue(DEFAULT_PLAN);
  });

  it('starts in idle status', () => {
    const { runtime } = createRuntime();
    expect(runtime.getState().status).toBe('idle');
  });

  it('transitions idle → observing on start()', async () => {
    const { runtime } = createRuntime();
    await runtime.start();
    expect(runtime.getState().status).toBe('observing');
    expect(runtime.getState().started_at).not.toBeNull();
    await runtime.stop();
  });

  it('returns empty result when no observations', async () => {
    const { runtime } = createRuntime();
    const result = await runtime.cycle([]);
    expect(result.observe.observation_count).toBe(0);
    expect(result.orient).toBeNull();
    expect(result.decide.action_count).toBe(0);
    expect(result.act.results).toEqual([]);
  });

  it('runs full OODA cycle with observations', async () => {
    const { runtime } = createRuntime();
    const result = await runtime.cycle([makeObs()]);

    expect(result.observe.observation_count).toBe(1);
    expect(result.orient).not.toBeNull();
    expect(result.decide.action_count).toBe(1);
    expect(result.duration_ms).toBeGreaterThanOrEqual(0);
    expect(orient).toHaveBeenCalledOnce();
    expect(decide).toHaveBeenCalledOnce();
  });

  it('sets requires_approval when confidence < 0.5', async () => {
    vi.mocked(decide).mockResolvedValue(HIGH_RISK_PLAN);

    const { runtime, decisionRepo } = createRuntime();
    const result = await runtime.cycle([makeObs()]);

    // High risk + low confidence → requires_approval = true → no execution
    expect(result.act.results).toEqual([]);
    const decisions = await decisionRepo.listByAgent('leak-detector');
    expect(decisions[0]?.requires_approval).toBe(true);
  });

  it('sets requires_approval when risk_level is high', async () => {
    const highRiskLowConfidence: DecisionPlan = {
      ...DEFAULT_PLAN,
      risk_level: 'high',
      confidence: 0.9,
    };
    vi.mocked(decide).mockResolvedValue(highRiskLowConfidence);

    const { runtime, decisionRepo } = createRuntime();
    await runtime.cycle([makeObs()]);

    const decisions = await decisionRepo.listByAgent('leak-detector');
    expect(decisions[0]?.requires_approval).toBe(true);
  });

  it('skips execution when approval is required', async () => {
    vi.mocked(decide).mockResolvedValue(HIGH_RISK_PLAN);

    const { runtime } = createRuntime();
    const result = await runtime.cycle([makeObs()]);

    // No actions should be executed
    expect(result.act.results).toHaveLength(0);
  });

  it('emits cycle events on eventBus', async () => {
    const { runtime, eventBus } = createRuntime();
    const events: EngineEvent[] = [];
    eventBus.onAny((event) => { events.push(event as EngineEvent); });

    await runtime.cycle([makeObs()]);

    const types = events.map((e) => e.type);
    expect(types).toContain('agent.cycle.started');
    expect(types).toContain('agent.cycle.completed');
    expect(types).toContain('agent.decision.made');
  });

  it('transitions to error state on failure', async () => {
    vi.mocked(orient).mockRejectedValue(new Error('LLM down'));

    const { runtime, eventBus } = createRuntime();
    const events: EngineEvent[] = [];
    eventBus.onAny((event) => { events.push(event as EngineEvent); });

    await expect(runtime.cycle([makeObs()])).rejects.toThrow('LLM down');
    expect(runtime.getState().status).toBe('error');

    const failEvents = events.filter((e) => e.type === 'agent.cycle.failed');
    expect(failEvents).toHaveLength(1);
  });

  it('persists state to AgentStateRepo', async () => {
    const { runtime, agentStateRepo } = createRuntime();
    await runtime.cycle([makeObs()]);

    const stored = await agentStateRepo.get('leak-detector');
    expect(stored).not.toBeNull();
    expect(stored!.cycles_completed).toBe(1);
    expect(stored!.status).toBe('observing');
  });

  it('stores cycle summary in MemoryRepo', async () => {
    const { runtime, memoryRepo } = createRuntime();
    await runtime.cycle([makeObs()]);

    expect(memoryRepo._store.length).toBe(1);
    expect(memoryRepo._store[0]!.content_type).toBe('cycle_summary');
  });
});
