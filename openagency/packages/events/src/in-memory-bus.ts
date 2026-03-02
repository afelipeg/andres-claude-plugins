// ─── In-Memory Event Bus ────────────────────────────────────────────

import { EventEmitter } from 'node:events';
import type { EngineEvent, EngineEventType, EventBus, EventHandler } from '@openagency/types';

export class InMemoryEventBus implements EventBus {
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(100);
  }

  async publish<T>(event: EngineEvent<T>): Promise<void> {
    this.emitter.emit(event.type, event);
    this.emitter.emit('*', event);
  }

  subscribe<T>(
    type: EngineEventType,
    handler: EventHandler<T>,
  ): () => void {
    const listener = (event: EngineEvent<T>) => {
      void handler(event);
    };
    this.emitter.on(type, listener);
    return () => {
      this.emitter.off(type, listener);
    };
  }

  /** Subscribe to all events */
  onAny<T>(handler: EventHandler<T>): () => void {
    const listener = (event: EngineEvent<T>) => {
      void handler(event);
    };
    this.emitter.on('*', listener);
    return () => {
      this.emitter.off('*', listener);
    };
  }
}
