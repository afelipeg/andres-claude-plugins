// ─── Mesh Coordinator Tests ────────────────────────────────────────
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InMemoryEventBus } from '@openagency/events';
import type { EngineEvent, OodaCycleResult, Observation } from '@openagency/types';
import { MeshCoordinator } from '../mesh/mesh-coordinator.js';
import type { MeshPipeline } from '../mesh/types.js';

// Minimal OodaRuntime mock
function createMockAgent(engineId: string, cycleFn?: (obs?: Observation[]) => Promise<OodaCycleResult>) {
  const defaultCycle = async (): Promise<OodaCycleResult> => ({
    cycle_id: 'cycle_1',
    agent_id: engineId,
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    duration_ms: 100,
    observe: { observation_count: 1 },
    orient: {
      observations_analyzed: 1,
      context: {},
      anomalies: [],
      opportunities: [],
      risks: [],
      reasoning: `${engineId} analysis`,
    },
    decide: { decision_id: 'dec_1', action_count: 1 },
    act: { results: [{ action_id: 'act_1', type: 'skill_execution', status: 'executed' }] },
  });

  return {
    getState: vi.fn().mockReturnValue({ agent_id: engineId, status: 'observing' }),
    cycle: vi.fn(cycleFn ?? defaultCycle),
    start: vi.fn(),
    stop: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
  };
}

function createTestPipeline(): MeshPipeline {
  return {
    id: 'test-pipeline',
    name: 'Test Pipeline',
    description: 'A test pipeline',
    trigger: 'manual',
    stages: [
      {
        agent_id: 'agent-a',
        order: 1,
        skills: ['skill-1'],
        trigger_events: ['sync.completed'],
        emit_events: ['domain.waste_detected'],
        timeout_ms: 5000,
      },
      {
        agent_id: 'agent-b',
        order: 2,
        skills: ['skill-2'],
        trigger_events: ['domain.waste_detected'],
        emit_events: ['domain.budget_reallocated'],
        timeout_ms: 5000,
      },
    ],
  };
}

describe('MeshCoordinator', () => {
  let eventBus: InMemoryEventBus;

  beforeEach(() => {
    eventBus = new InMemoryEventBus();
  });

  it('executes stages sequentially', async () => {
    const agentA = createMockAgent('agent-a');
    const agentB = createMockAgent('agent-b');
    const agents = new Map([['agent-a', agentA], ['agent-b', agentB]]) as never;

    const mesh = new MeshCoordinator(agents, eventBus);
    mesh.registerPipeline(createTestPipeline());

    const run = await mesh.executePipeline('test-pipeline');

    expect(run.status).toBe('completed');
    expect(agentA.cycle).toHaveBeenCalledOnce();
    expect(agentB.cycle).toHaveBeenCalledOnce();

    // Verify agent-a was called first
    const aCallOrder = agentA.cycle.mock.invocationCallOrder[0]!;
    const bCallOrder = agentB.cycle.mock.invocationCallOrder[0]!;
    expect(aCallOrder).toBeLessThan(bCallOrder);
  });

  it('continues to next stage on failure', async () => {
    const failAgent = createMockAgent('agent-a', async () => {
      throw new Error('LLM failed');
    });
    const successAgent = createMockAgent('agent-b');
    const agents = new Map([['agent-a', failAgent], ['agent-b', successAgent]]) as never;

    const mesh = new MeshCoordinator(agents, eventBus);
    mesh.registerPipeline(createTestPipeline());

    const run = await mesh.executePipeline('test-pipeline');

    expect(run.status).toBe('partial');
    expect(failAgent.cycle).toHaveBeenCalledOnce();
    expect(successAgent.cycle).toHaveBeenCalledOnce();

    const aResult = run.context.stage_results.get('agent-a');
    expect(aResult?.status).toBe('failed');
    expect(aResult?.error).toBe('LLM failed');

    const bResult = run.context.stage_results.get('agent-b');
    expect(bResult?.status).toBe('completed');
  });

  it('respects skip_if condition', async () => {
    const agentA = createMockAgent('agent-a');
    const agentB = createMockAgent('agent-b');
    const agents = new Map([['agent-a', agentA], ['agent-b', agentB]]) as never;

    const pipeline = createTestPipeline();
    pipeline.stages[1]!.skip_if = () => true;

    const mesh = new MeshCoordinator(agents, eventBus);
    mesh.registerPipeline(pipeline);

    const run = await mesh.executePipeline('test-pipeline');

    expect(run.status).toBe('completed');
    expect(agentA.cycle).toHaveBeenCalledOnce();
    expect(agentB.cycle).not.toHaveBeenCalled();

    const bResult = run.context.stage_results.get('agent-b');
    expect(bResult?.status).toBe('skipped');
  });

  it('handles event-triggered pipelines', async () => {
    const agentA = createMockAgent('agent-a');
    const agents = new Map([['agent-a', agentA]]) as never;

    const pipeline: MeshPipeline = {
      id: 'auto-pipeline',
      name: 'Auto Pipeline',
      description: 'Triggered by sync',
      trigger: 'sync.completed',
      stages: [{
        agent_id: 'agent-a',
        order: 1,
        skills: ['skill-1'],
        trigger_events: ['sync.completed'],
        emit_events: [],
        timeout_ms: 5000,
      }],
    };

    const mesh = new MeshCoordinator(agents, eventBus);
    mesh.registerPipeline(pipeline);
    mesh.start();

    // Fire the trigger event
    await eventBus.publish({
      id: 'e1', type: 'sync.completed', timestamp: new Date().toISOString(),
      payload: { platform: 'meta', row_count: 100, date_range: { start: '2024-01-01', end: '2024-01-07' } },
      metadata: {},
    });

    // Give async handler time to complete
    await new Promise((r) => setTimeout(r, 50));

    expect(agentA.cycle).toHaveBeenCalled();

    mesh.stop();
  });

  it('handles timeout on slow agents', async () => {
    const slowAgent = createMockAgent('agent-a', async () => {
      await new Promise((r) => setTimeout(r, 10000));
      throw new Error('unreachable');
    });
    const agents = new Map([['agent-a', slowAgent]]) as never;

    const pipeline: MeshPipeline = {
      id: 'timeout-pipeline',
      name: 'Timeout Test',
      description: 'test',
      trigger: 'manual',
      stages: [{
        agent_id: 'agent-a',
        order: 1,
        skills: [],
        trigger_events: [],
        emit_events: [],
        timeout_ms: 50, // Very short timeout
      }],
    };

    const mesh = new MeshCoordinator(agents, eventBus);
    mesh.registerPipeline(pipeline);

    const run = await mesh.executePipeline('timeout-pipeline');

    expect(run.status).toBe('failed');
    const result = run.context.stage_results.get('agent-a');
    expect(result?.status).toBe('timed_out');
  });

  it('tracks runs and provides status', async () => {
    const agentA = createMockAgent('agent-a');
    const agents = new Map([['agent-a', agentA]]) as never;

    const pipeline: MeshPipeline = {
      id: 'track-pipeline',
      name: 'Track Test',
      description: 'test',
      trigger: 'manual',
      stages: [{
        agent_id: 'agent-a',
        order: 1,
        skills: ['skill-1'],
        trigger_events: [],
        emit_events: [],
        timeout_ms: 5000,
      }],
    };

    const mesh = new MeshCoordinator(agents, eventBus);
    mesh.registerPipeline(pipeline);

    const run = await mesh.executePipeline('track-pipeline');

    // Get run by ID
    const retrieved = mesh.getRun(run.id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.id).toBe(run.id);
    expect(retrieved!.status).toBe('completed');

    // List runs
    const allRuns = mesh.listRuns();
    expect(allRuns).toHaveLength(1);
  });

  it('tracks usage metering', async () => {
    const agentA = createMockAgent('agent-a');
    const agentB = createMockAgent('agent-b');
    const agents = new Map([['agent-a', agentA], ['agent-b', agentB]]) as never;

    const mesh = new MeshCoordinator(agents, eventBus);
    mesh.registerPipeline(createTestPipeline());

    const run = await mesh.executePipeline('test-pipeline', undefined, 'client_123');

    expect(run.usage).toBeDefined();
    expect(run.usage!.stages_executed).toBe(2);
    expect(run.usage!.agent_client_id).toBe('client_123');
    expect(run.usage!.total_duration_ms).toBeGreaterThanOrEqual(0);
  });

  it('emits mesh pipeline and stage events', async () => {
    const agentA = createMockAgent('agent-a');
    const agents = new Map([['agent-a', agentA]]) as never;

    const pipeline: MeshPipeline = {
      id: 'event-pipeline',
      name: 'Event Test',
      description: 'test',
      trigger: 'manual',
      stages: [{
        agent_id: 'agent-a',
        order: 1,
        skills: [],
        trigger_events: [],
        emit_events: [],
        timeout_ms: 5000,
      }],
    };

    const events: EngineEvent[] = [];
    eventBus.onAny((e) => { events.push(e as EngineEvent); });

    const mesh = new MeshCoordinator(agents, eventBus);
    mesh.registerPipeline(pipeline);

    await mesh.executePipeline('event-pipeline');

    const types = events.map((e) => e.type);
    expect(types).toContain('mesh.pipeline.started');
    expect(types).toContain('mesh.stage.started');
    expect(types).toContain('mesh.stage.completed');
    expect(types).toContain('mesh.pipeline.completed');
  });
});
