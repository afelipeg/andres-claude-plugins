// ─── Cross-Engine Event Tests ──────────────────────────────────────
// Verifies each engine's agent config subscribes to the correct events.

import { describe, it, expect } from 'vitest';
import { InMemoryEventBus } from '@openagency/events';
import type { EngineEvent, EngineEventType, Observation } from '@openagency/types';
import { EventObserver } from '../observers/event-observer.js';
import { AGENT_CONFIGS } from '../agents/engine-configs.js';

function collectObservations(
  eventBus: InMemoryEventBus,
  subscriptions: EngineEventType[],
): { obs: Observation[]; destroy: () => void } {
  const obs: Observation[] = [];
  const observer = new EventObserver(eventBus, subscriptions);
  observer.start((o) => obs.push(o));
  return {
    obs,
    destroy: () => observer.stop(),
  };
}

function fireEvent(eventBus: InMemoryEventBus, type: EngineEventType): void {
  void eventBus.publish({
    id: 'test',
    type,
    timestamp: new Date().toISOString(),
    payload: { test: true },
    metadata: {},
  } as EngineEvent);
}

describe('Cross-Engine Events', () => {
  it('leak-detector reacts to sync.completed', () => {
    const eventBus = new InMemoryEventBus();
    const config = AGENT_CONFIGS['leak-detector']!;
    const { obs, destroy } = collectObservations(eventBus, config.subscriptions);

    fireEvent(eventBus, 'sync.completed');
    expect(obs).toHaveLength(1);

    // Should NOT react to domain.budget_reallocated
    fireEvent(eventBus, 'domain.budget_reallocated');
    expect(obs).toHaveLength(1);

    destroy();
  });

  it('media-architect reacts to sync.completed and domain.waste_detected', () => {
    const eventBus = new InMemoryEventBus();
    const config = AGENT_CONFIGS['media-architect']!;
    const { obs, destroy } = collectObservations(eventBus, config.subscriptions);

    fireEvent(eventBus, 'sync.completed');
    fireEvent(eventBus, 'domain.waste_detected');
    expect(obs).toHaveLength(2);

    // Should NOT react to domain.campaign_adjusted
    fireEvent(eventBus, 'domain.campaign_adjusted');
    expect(obs).toHaveLength(2);

    destroy();
  });

  it('campaign-ops reacts to waste_detected, budget_reallocated, and anomaly_found', () => {
    const eventBus = new InMemoryEventBus();
    const config = AGENT_CONFIGS['campaign-ops']!;
    const { obs, destroy } = collectObservations(eventBus, config.subscriptions);

    fireEvent(eventBus, 'domain.waste_detected');
    fireEvent(eventBus, 'domain.budget_reallocated');
    fireEvent(eventBus, 'domain.anomaly_found');
    expect(obs).toHaveLength(3);

    destroy();
  });

  it('executive-bridge reacts to waste_detected, budget_reallocated, campaign_adjusted', () => {
    const eventBus = new InMemoryEventBus();
    const config = AGENT_CONFIGS['executive-bridge']!;
    const { obs, destroy } = collectObservations(eventBus, config.subscriptions);

    fireEvent(eventBus, 'domain.waste_detected');
    fireEvent(eventBus, 'domain.budget_reallocated');
    fireEvent(eventBus, 'domain.campaign_adjusted');
    expect(obs).toHaveLength(3);

    // Should NOT react to sync.completed
    fireEvent(eventBus, 'sync.completed');
    expect(obs).toHaveLength(3);

    destroy();
  });

  it('each engine ignores events it is not subscribed to', () => {
    const eventBus = new InMemoryEventBus();

    const results: Record<string, number> = {};

    for (const [engineId, config] of Object.entries(AGENT_CONFIGS)) {
      const { obs, destroy } = collectObservations(eventBus, config.subscriptions);

      // Fire all possible domain events
      const allDomainEvents: EngineEventType[] = [
        'sync.completed',
        'domain.waste_detected',
        'domain.anomaly_found',
        'domain.budget_reallocated',
        'domain.campaign_adjusted',
        'domain.executive_report',
      ];

      for (const evt of allDomainEvents) {
        fireEvent(eventBus, evt);
      }

      results[engineId] = obs.length;
      destroy();
    }

    // leak-detector: subscribed to sync.completed only → 1
    expect(results['leak-detector']).toBe(1);
    // media-architect: sync.completed + domain.waste_detected → 2
    expect(results['media-architect']).toBe(2);
    // campaign-ops: sync.completed + waste + budget + anomaly → 4
    expect(results['campaign-ops']).toBe(4);
    // executive-bridge: waste + budget + campaign → 3
    expect(results['executive-bridge']).toBe(3);
  });
});
