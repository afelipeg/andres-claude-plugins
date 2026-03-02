// ─── Observer Pipeline Tests ───────────────────────────────────────
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InMemoryEventBus, syncCompleted } from '@openagency/events';
import { ObserverPipeline } from '../observers/pipeline.js';
import { SyncObserver } from '../observers/sync-observer.js';
import { EventObserver } from '../observers/event-observer.js';
import { ScheduleObserver } from '../observers/schedule-observer.js';
import { ThresholdObserver } from '../observers/threshold-observer.js';

describe('ObserverPipeline', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('flush returns and clears buffer', () => {
    const pipeline = new ObserverPipeline();
    const eventBus = new InMemoryEventBus();
    pipeline.addSource(new SyncObserver(eventBus));

    // Publish a sync event
    void eventBus.publish(syncCompleted({
      platform: 'meta',
      row_count: 100,
      date_range: { start: '2024-01-01', end: '2024-01-07' },
    }));

    expect(pipeline.bufferSize).toBe(1);
    const obs = pipeline.flush();
    expect(obs).toHaveLength(1);
    expect(obs[0]!.type).toBe('sync_data');
    expect(pipeline.bufferSize).toBe(0);

    pipeline.destroy();
  });

  it('SyncObserver converts sync.completed to observation', () => {
    const pipeline = new ObserverPipeline();
    const eventBus = new InMemoryEventBus();
    pipeline.addSource(new SyncObserver(eventBus));

    void eventBus.publish(syncCompleted({
      platform: 'google_ads',
      row_count: 200,
      date_range: { start: '2024-01-01', end: '2024-01-14' },
    }));

    const obs = pipeline.flush();
    expect(obs).toHaveLength(1);
    expect(obs[0]!.source).toBe('sync');
    expect(obs[0]!.platform).toBe('google_ads');

    pipeline.destroy();
  });

  it('EventObserver filters subscribed event types', () => {
    const pipeline = new ObserverPipeline();
    const eventBus = new InMemoryEventBus();
    pipeline.addSource(new EventObserver(eventBus, ['domain.waste_detected']));

    // Fire subscribed event
    void eventBus.publish({
      id: 'e1', type: 'domain.waste_detected', timestamp: new Date().toISOString(),
      payload: { total_waste: 5000 }, metadata: {},
    });

    // Fire unsubscribed event
    void eventBus.publish({
      id: 'e2', type: 'domain.anomaly_found', timestamp: new Date().toISOString(),
      payload: { metric: 'ctr' }, metadata: {},
    });

    const obs = pipeline.flush();
    expect(obs).toHaveLength(1);
    expect(obs[0]!.type).toBe('event_signal');

    pipeline.destroy();
  });

  it('ScheduleObserver fires on interval with fake timers', () => {
    const pipeline = new ObserverPipeline();
    pipeline.addSource(new ScheduleObserver(1000));

    expect(pipeline.bufferSize).toBe(0);

    vi.advanceTimersByTime(1000);
    expect(pipeline.bufferSize).toBe(1);

    vi.advanceTimersByTime(2000);
    expect(pipeline.bufferSize).toBe(3);

    const obs = pipeline.flush();
    expect(obs.every((o) => o.type === 'schedule_tick')).toBe(true);

    pipeline.destroy();
  });

  it('ThresholdObserver detects breaches', () => {
    const pipeline = new ObserverPipeline();
    const threshold = new ThresholdObserver([
      { metric: 'ctr', operator: 'lt', value: 0.03 },
      { metric: 'spend', operator: 'gt', value: 10000 },
    ]);
    pipeline.addSource(threshold);

    // CTR below threshold
    threshold.evaluate({ ctr: 0.02 });
    expect(pipeline.bufferSize).toBe(1);

    // Spend above threshold
    threshold.evaluate({ spend: 15000, ctr: 0.05 });
    expect(pipeline.bufferSize).toBe(2);

    const obs = pipeline.flush();
    expect(obs[0]!.type).toBe('threshold_breach');
    expect((obs[0]!.data as Record<string, unknown>)['metric']).toBe('ctr');
    expect((obs[1]!.data as Record<string, unknown>)['metric']).toBe('spend');

    pipeline.destroy();
  });

  it('destroy stops all sources and clears buffer', () => {
    const pipeline = new ObserverPipeline();
    const eventBus = new InMemoryEventBus();
    pipeline.addSource(new SyncObserver(eventBus));
    pipeline.addSource(new ScheduleObserver(1000));

    vi.advanceTimersByTime(1000);
    expect(pipeline.bufferSize).toBe(1);

    pipeline.destroy();
    expect(pipeline.bufferSize).toBe(0);

    // Timer should not fire after destroy
    vi.advanceTimersByTime(5000);
    expect(pipeline.bufferSize).toBe(0);
  });
});
