// ─── Sync Observer ──────────────────────────────────────────────────
// Listens to sync.completed events, converts SyncResult to Observation.

import { ulid } from 'ulid';
import type { Observation, EventBus, EngineEvent, SyncResult } from '@openagency/types';
import type { ObservationSource } from './types.js';

export class SyncObserver implements ObservationSource {
  readonly name = 'sync';
  private unsubscribe: (() => void) | null = null;

  constructor(private eventBus: EventBus) {}

  start(callback: (obs: Observation) => void): void {
    this.unsubscribe = this.eventBus.subscribe<SyncResult>(
      'sync.completed',
      (event: EngineEvent<SyncResult>) => {
        callback({
          id: ulid(),
          source: this.name,
          type: 'sync_data',
          data: event.payload,
          timestamp: event.timestamp,
          platform: event.payload.platform,
        });
      },
    );
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }
}
