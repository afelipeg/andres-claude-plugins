import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HFLCoordinator } from '../coordinator.js';
import type { MeshRunSummary } from '../coordinator.js';
import type { HFLConfig } from '../types.js';
import type { EventBus, EngineEvent } from '@openagency/types';

function createMockEventBus(): EventBus {
  const events: EngineEvent[] = [];
  return {
    publish: vi.fn(async (event: EngineEvent) => { events.push(event); }),
    subscribe: vi.fn(() => () => {}),
    onAny: vi.fn(() => () => {}),
    _events: events,
  } as unknown as EventBus & { _events: EngineEvent[] };
}

function makeConfig(overrides?: Partial<HFLConfig>): HFLConfig {
  return {
    client_id: 'test-client',
    auto_approve_threshold: 1000,
    channels: [
      { id: 'slack', type: 'webhook', url: 'https://hooks.slack.com/x', render_level: 'rich', active: true },
    ],
    default_channel: 'slack',
    escalation_rules: [],
    timeout_ms: 0, // disable timeout for tests
    ...overrides,
  };
}

function makeRun(overrides?: Partial<MeshRunSummary>): MeshRunSummary {
  return {
    id: 'run-1',
    pipeline_id: 'full-optimization',
    status: 'completed',
    total_duration_ms: 5000,
    client_id: 'test-client',
    stage_results: {
      'leak-detector': { agent_id: 'leak-detector', status: 'completed', duration_ms: 1000, skills_invoked: ['waste-waterfall'] },
      'media-architect': { agent_id: 'media-architect', status: 'completed', duration_ms: 800, skills_invoked: ['mmm-optimize'] },
    },
    ...overrides,
  };
}

describe('HFLCoordinator', () => {
  let eventBus: ReturnType<typeof createMockEventBus>;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    eventBus = createMockEventBus();
    mockFetch = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }));
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('auto-approves when within threshold', async () => {
    const hfl = new HFLCoordinator(eventBus, { base_url: 'http://test:3100' });
    hfl.setConfig(makeConfig({ auto_approve_threshold: 999999 }));

    // Second run (first is always escalated)
    await hfl.evaluate(makeRun());
    const decision = await hfl.evaluate(makeRun({ id: 'run-2' }));

    expect(decision.status).toBe('auto_approved');
    expect(decision.needs_human).toBe(false);
    expect(eventBus.publish).toHaveBeenCalled();
  });

  it('escalates first run for client', async () => {
    const hfl = new HFLCoordinator(eventBus, { base_url: 'http://test:3100' });
    hfl.setConfig(makeConfig());

    const decision = await hfl.evaluate(makeRun());

    expect(decision.status).toBe('escalated');
    expect(decision.needs_human).toBe(true);
    expect(decision.render_output).toBeDefined();
    expect(decision.dispatched_to).toBe('slack');
  });

  it('escalates when stages failed', async () => {
    const hfl = new HFLCoordinator(eventBus, { base_url: 'http://test:3100' });
    hfl.setConfig(makeConfig({ auto_approve_threshold: 999999 }));

    // Skip first run escalation
    await hfl.evaluate(makeRun());

    const decision = await hfl.evaluate(makeRun({
      id: 'run-2',
      stage_results: {
        'leak-detector': { agent_id: 'leak-detector', status: 'failed', duration_ms: 1000, skills_invoked: [], error: 'timeout' },
      },
    }));

    expect(decision.status).toBe('escalated');
    expect(decision.needs_human).toBe(true);
  });

  it('approves a pending run', async () => {
    const hfl = new HFLCoordinator(eventBus, { base_url: 'http://test:3100' });
    hfl.setConfig(makeConfig());

    const escalated = await hfl.evaluate(makeRun());
    expect(escalated.status).toBe('escalated');

    const approved = await hfl.approveRun('run-1', 'Looks good');
    expect(approved).toBeDefined();
    expect(approved!.status).toBe('human_approved');
    expect(approved!.human_response).toBe('approved');
    expect(approved!.human_feedback).toBe('Looks good');
  });

  it('rejects a pending run', async () => {
    const hfl = new HFLCoordinator(eventBus, { base_url: 'http://test:3100' });
    hfl.setConfig(makeConfig());

    await hfl.evaluate(makeRun());

    const rejected = await hfl.rejectRun('run-1', 'Too risky');
    expect(rejected).toBeDefined();
    expect(rejected!.status).toBe('human_rejected');
    expect(rejected!.human_feedback).toBe('Too risky');
  });

  it('returns undefined for non-existent pending run', async () => {
    const hfl = new HFLCoordinator(eventBus, { base_url: 'http://test:3100' });
    const result = await hfl.approveRun('non-existent');
    expect(result).toBeUndefined();
  });

  it('dispatches to webhook channel', async () => {
    const hfl = new HFLCoordinator(eventBus, { base_url: 'http://test:3100' });
    hfl.setConfig(makeConfig());

    const decision = await hfl.evaluate(makeRun());

    expect(decision.dispatch_result).toBeDefined();
    expect(decision.dispatch_result!.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('lists decisions', async () => {
    const hfl = new HFLCoordinator(eventBus, { base_url: 'http://test:3100' });
    hfl.setConfig(makeConfig({ auto_approve_threshold: 999999 }));

    await hfl.evaluate(makeRun({ id: 'run-1' }));
    await hfl.evaluate(makeRun({ id: 'run-2' }));

    const decisions = hfl.listDecisions();
    expect(decisions).toHaveLength(2);
  });

  it('lists pending decisions', async () => {
    const hfl = new HFLCoordinator(eventBus, { base_url: 'http://test:3100' });
    hfl.setConfig(makeConfig());

    await hfl.evaluate(makeRun({ id: 'run-1' }));
    await hfl.evaluate(makeRun({ id: 'run-2' }));

    const pending = hfl.listPending();
    expect(pending.length).toBeGreaterThanOrEqual(1);
    expect(pending.every((d) => d.status === 'escalated')).toBe(true);
  });

  it('force-escalates when forceEscalate=true even if risk is low', async () => {
    const hfl = new HFLCoordinator(eventBus, { base_url: 'http://test:3100' });
    hfl.setConfig(makeConfig({ auto_approve_threshold: 999999 }));

    // Skip first-run escalation
    await hfl.evaluate(makeRun({ id: 'run-0' }));

    // Second run would auto-approve, but forceEscalate overrides
    const decision = await hfl.evaluate(
      {
        ...makeRun({ id: 'run-force' }),
        pipeline_score: { composite: 25, stage_health: 50, action_success: 0, risk_signal: 0 },
      } as MeshRunSummary,
      true,
    );

    expect(decision.status).toBe('escalated');
    expect(decision.needs_human).toBe(true);
    expect(decision.risk_score.risk_factors).toContain('pipeline_score_below_threshold');
  });

  it('config management', () => {
    const hfl = new HFLCoordinator(eventBus);
    const config = makeConfig();
    hfl.setConfig(config);

    const retrieved = hfl.getConfig('test-client');
    expect(retrieved).toEqual(config);

    expect(hfl.getConfig('unknown')).toBeUndefined();
  });
});
