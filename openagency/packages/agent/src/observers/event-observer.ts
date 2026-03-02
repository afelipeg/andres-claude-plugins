// ─── Event Observer ─────────────────────────────────────────────────
// Listens to specific event types per agent and converts to observations.

import { ulid } from 'ulid';
import type { Observation, EventBus, EngineEvent, EngineEventType } from '@openagency/types';
import type { ObservationSource } from './types.js';

export class EventObserver implements ObservationSource {
  readonly name = 'event';
  private unsubscribers: Array<() => void> = [];

  constructor(
    private eventBus: EventBus,
    private eventTypes: EngineEventType[],
  ) {}

  start(callback: (obs: Observation) => void): void {
    for (const eventType of this.eventTypes) {
      const unsub = this.eventBus.subscribe(eventType, (event: EngineEvent) => {
        callback({
          id: ulid(),
          source: this.name,
          type: 'event_signal',
          data: { event_type: eventType, payload: event.payload },
          timestamp: event.timestamp,
        });
      });
      this.unsubscribers.push(unsub);
    }
  }

  stop(): void {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];
  }
}
