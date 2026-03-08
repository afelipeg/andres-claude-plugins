// ─── Pipeline Scheduler Tests ──────────────────────────────────────
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InMemoryEventBus } from '@openagency/events';
import { PipelineScheduler, matchesCron, nextCronDate } from '../mesh/scheduler.js';
import type { MeshCoordinator } from '../mesh/mesh-coordinator.js';
import type { MeshRun } from '../mesh/types.js';

// ─── Cron matcher unit tests ────────────────────────────────────────

describe('matchesCron', () => {
  it('matches wildcard (*) for every field', () => {
    const date = new Date('2025-03-03T10:30:00');
    expect(matchesCron('* * * * *', date)).toBe(true);
  });

  it('matches exact minute and hour', () => {
    const date = new Date('2025-03-03T06:00:00');
    expect(matchesCron('0 6 * * *', date)).toBe(true);
  });

  it('does not match wrong minute', () => {
    const date = new Date('2025-03-03T06:01:00');
    expect(matchesCron('0 6 * * *', date)).toBe(false);
  });

  it('matches specific day of week (1=Monday)', () => {
    // 2025-03-03 is a Monday (day=1)
    const monday = new Date('2025-03-03T06:00:00');
    expect(matchesCron('0 6 * * 1', monday)).toBe(true);

    // 2025-03-04 is a Tuesday (day=2)
    const tuesday = new Date('2025-03-04T06:00:00');
    expect(matchesCron('0 6 * * 1', tuesday)).toBe(false);
  });

  it('matches day of month', () => {
    const first = new Date('2025-03-01T09:00:00');
    expect(matchesCron('0 9 1 * *', first)).toBe(true);

    const second = new Date('2025-03-02T09:00:00');
    expect(matchesCron('0 9 1 * *', second)).toBe(false);
  });

  it('matches comma-separated values', () => {
    const monDate = new Date('2025-03-03T08:00:00'); // Monday
    const friDate = new Date('2025-03-07T08:00:00'); // Friday
    const satDate = new Date('2025-03-08T08:00:00'); // Saturday
    expect(matchesCron('0 8 * * 1,5', monDate)).toBe(true);
    expect(matchesCron('0 8 * * 1,5', friDate)).toBe(true);
    expect(matchesCron('0 8 * * 1,5', satDate)).toBe(false);
  });

  it('matches range values', () => {
    const mon = new Date('2025-03-03T10:00:00'); // Monday=1
    const wed = new Date('2025-03-05T10:00:00'); // Wednesday=3
    const sat = new Date('2025-03-08T10:00:00'); // Saturday=6
    expect(matchesCron('0 10 * * 1-5', mon)).toBe(true);
    expect(matchesCron('0 10 * * 1-5', wed)).toBe(true);
    expect(matchesCron('0 10 * * 1-5', sat)).toBe(false);
  });

  it('returns false for malformed cron (wrong field count)', () => {
    const date = new Date();
    expect(matchesCron('* * *', date)).toBe(false);
    expect(matchesCron('* * * * * *', date)).toBe(false);
  });
});

// ─── nextCronDate tests ─────────────────────────────────────────────

describe('nextCronDate', () => {
  it('returns next minute for * * * * *', () => {
    const from = new Date('2025-03-03T10:00:00');
    const next = nextCronDate('* * * * *', from);
    expect(next).not.toBeNull();
    expect(next!.getMinutes()).toBe(1);
    expect(next!.getHours()).toBe(10);
  });

  it('returns next Monday for "0 6 * * 1"', () => {
    // from = Wednesday 2025-03-05
    const from = new Date('2025-03-05T06:00:00');
    const next = nextCronDate('0 6 * * 1', from);
    expect(next).not.toBeNull();
    // Next Monday = 2025-03-10
    expect(next!.getDay()).toBe(1);
    expect(next!.getHours()).toBe(6);
    expect(next!.getMinutes()).toBe(0);
  });

  it('returns same day if cron matches later today', () => {
    const from = new Date('2025-03-03T05:00:00');
    const next = nextCronDate('0 6 * * *', from);
    expect(next).not.toBeNull();
    expect(next!.getHours()).toBe(6);
    expect(next!.getDate()).toBe(3);
  });
});

// ─── PipelineScheduler tests ────────────────────────────────────────

function createMockMesh() {
  const mockRun: MeshRun = {
    id: 'run_01',
    pipeline_id: 'full-optimization',
    status: 'completed',
    context: {
      run_id: 'run_01',
      stage_results: new Map(),
      started_at: new Date().toISOString(),
    },
    started_at: new Date().toISOString(),
    total_duration_ms: 100,
  };

  return {
    executePipeline: vi.fn().mockResolvedValue(mockRun),
    getPipeline: vi.fn().mockReturnValue({ id: 'full-optimization', name: 'Test', stages: [] }),
    listPipelines: vi.fn().mockReturnValue([]),
    listRuns: vi.fn().mockReturnValue([]),
    registerPipeline: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  } as unknown as MeshCoordinator;
}

describe('PipelineScheduler', () => {
  let eventBus: InMemoryEventBus;
  let mesh: MeshCoordinator;
  let scheduler: PipelineScheduler;

  beforeEach(() => {
    eventBus = new InMemoryEventBus();
    mesh = createMockMesh();
    scheduler = new PipelineScheduler(mesh, eventBus);
  });

  afterEach(() => {
    scheduler.stop();
  });

  it('starts without DB repo (in-memory only)', async () => {
    await expect(scheduler.start()).resolves.toBeUndefined();
  });

  it('creates a schedule and returns it', async () => {
    await scheduler.start();

    const schedule = await scheduler.createSchedule({
      client_id: 'client_abc',
      pipeline_id: 'full-optimization',
      cron: '0 6 * * 1',
    });

    expect(schedule.id).toBeDefined();
    expect(schedule.client_id).toBe('client_abc');
    expect(schedule.pipeline_id).toBe('full-optimization');
    expect(schedule.cron).toBe('0 6 * * 1');
    expect(schedule.enabled).toBe(true);
    expect(schedule.auto_approve).toBe(false);
    expect(schedule.notify_on_complete).toBe(true);
    expect(schedule.next_run_at).toBeDefined();
  });

  it('lists schedules (unfiltered)', async () => {
    await scheduler.start();

    await scheduler.createSchedule({ client_id: 'client_1', pipeline_id: 'full-optimization', cron: '0 6 * * 1' });
    await scheduler.createSchedule({ client_id: 'client_2', pipeline_id: 'full-optimization', cron: '0 9 * * *' });

    const all = scheduler.listSchedules();
    expect(all).toHaveLength(2);
  });

  it('lists schedules filtered by client_id', async () => {
    await scheduler.start();

    await scheduler.createSchedule({ client_id: 'client_1', pipeline_id: 'full-optimization', cron: '0 6 * * 1' });
    await scheduler.createSchedule({ client_id: 'client_2', pipeline_id: 'full-optimization', cron: '0 9 * * *' });

    const client1 = scheduler.listSchedules('client_1');
    expect(client1).toHaveLength(1);
    expect(client1[0]!.client_id).toBe('client_1');
  });

  it('deletes a schedule by ID', async () => {
    await scheduler.start();

    const schedule = await scheduler.createSchedule({
      client_id: 'client_abc',
      pipeline_id: 'full-optimization',
      cron: '0 6 * * 1',
    });

    const deleted = await scheduler.deleteSchedule(schedule.id);
    expect(deleted).toBe(true);
    expect(scheduler.listSchedules()).toHaveLength(0);
  });

  it('returns false when deleting non-existent schedule', async () => {
    await scheduler.start();
    const deleted = await scheduler.deleteSchedule('does-not-exist');
    expect(deleted).toBe(false);
  });

  it('emits mesh.schedule.created event on createSchedule', async () => {
    await scheduler.start();

    const events: string[] = [];
    eventBus.onAny((e) => { events.push(e.type); });

    await scheduler.createSchedule({
      client_id: 'client_abc',
      pipeline_id: 'full-optimization',
      cron: '0 6 * * 1',
    });

    expect(events).toContain('mesh.schedule.created');
  });

  it('emits mesh.schedule.deleted event on deleteSchedule', async () => {
    await scheduler.start();

    const schedule = await scheduler.createSchedule({
      client_id: 'client_abc',
      pipeline_id: 'full-optimization',
      cron: '0 6 * * 1',
    });

    const events: string[] = [];
    eventBus.onAny((e) => { events.push(e.type); });

    await scheduler.deleteSchedule(schedule.id);
    expect(events).toContain('mesh.schedule.deleted');
  });

  it('uses repo when provided: create + findAll', async () => {
    const stored: ReturnType<typeof Object.values>[number][] = [];
    const repo = {
      create: vi.fn(async (s) => { stored.push(s); }),
      findAll: vi.fn(async () => stored),
      findById: vi.fn(async () => null),
      updateLastRun: vi.fn(async () => undefined),
      delete: vi.fn(async () => true),
    };

    const schedulerWithRepo = new PipelineScheduler(mesh, eventBus, repo);
    await schedulerWithRepo.start();

    await schedulerWithRepo.createSchedule({
      client_id: 'c1',
      pipeline_id: 'full-optimization',
      cron: '0 9 * * *',
    });

    expect(repo.create).toHaveBeenCalledOnce();
    schedulerWithRepo.stop();
  });

  it('loads schedules from repo on start', async () => {
    const existingSchedule = {
      id: 'sched_existing',
      client_id: 'c1',
      pipeline_id: 'full-optimization',
      cron: '0 9 * * *',
      auto_approve: false,
      notify_on_complete: true,
      enabled: true,
      created_at: new Date().toISOString(),
    };

    const repo = {
      create: vi.fn(),
      findAll: vi.fn(async () => [existingSchedule]),
      findById: vi.fn(async () => null),
      updateLastRun: vi.fn(async () => undefined),
      delete: vi.fn(async () => true),
    };

    const schedulerWithRepo = new PipelineScheduler(mesh, eventBus, repo);
    await schedulerWithRepo.start();

    const schedules = schedulerWithRepo.listSchedules();
    expect(schedules).toHaveLength(1);
    expect(schedules[0]!.id).toBe('sched_existing');

    schedulerWithRepo.stop();
  });

  it('stops cleanly without throwing', () => {
    expect(() => scheduler.stop()).not.toThrow();
  });
});
