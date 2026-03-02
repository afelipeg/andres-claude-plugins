// ─── Redis Streams Event Bus ────────────────────────────────────────
// Loaded only when REDIS_URL is set. Falls back to InMemoryEventBus otherwise.

import type { EngineEvent, EngineEventType, EventBus, EventHandler } from '@openagency/types';

/**
 * Redis Streams adapter for distributed event bus.
 * Requires `ioredis` as an optional dependency.
 */
export class RedisEventBus implements EventBus {
  private redis: unknown; // ioredis.Redis
  private handlers = new Map<string, Set<EventHandler<unknown>>>();
  private polling = false;
  private consumerGroup = 'openagency-api';
  private consumerId: string;
  private streamKey = 'openagency:events';

  constructor(redisUrl: string) {
    this.consumerId = `consumer-${process.pid}-${Date.now()}`;
    void this.init(redisUrl);
  }

  private async init(redisUrl: string): Promise<void> {
    try {
      const ioredis = await import('ioredis');
      const Redis = ioredis.default ?? ioredis;
      this.redis = new (Redis as unknown as new (url: string) => unknown)(redisUrl);

      // Create consumer group if it doesn't exist
      try {
        await (this.redis as { xgroup: (...args: string[]) => Promise<unknown> }).xgroup(
          'CREATE', this.streamKey, this.consumerGroup, '0', 'MKSTREAM',
        );
      } catch {
        // Group already exists
      }

      this.startPolling();
    } catch {
      console.warn('[events] ioredis not available, Redis event bus disabled');
    }
  }

  async publish<T>(event: EngineEvent<T>): Promise<void> {
    if (!this.redis) return;
    const r = this.redis as { xadd: (...args: unknown[]) => Promise<unknown> };
    await r.xadd(
      this.streamKey, '*',
      'id', event.id,
      'type', event.type,
      'timestamp', event.timestamp,
      'payload', JSON.stringify(event.payload),
      'metadata', JSON.stringify(event.metadata),
    );
  }

  subscribe<T>(
    type: EngineEventType,
    handler: EventHandler<T>,
  ): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler as EventHandler<unknown>);
    return () => {
      set!.delete(handler as EventHandler<unknown>);
    };
  }

  onAny<T>(handler: EventHandler<T>): () => void {
    let set = this.handlers.get('*');
    if (!set) {
      set = new Set();
      this.handlers.set('*', set);
    }
    set.add(handler as EventHandler<unknown>);
    return () => {
      set!.delete(handler as EventHandler<unknown>);
    };
  }

  private startPolling(): void {
    if (this.polling) return;
    this.polling = true;
    void this.poll();
  }

  private async poll(): Promise<void> {
    while (this.polling) {
      try {
        const r = this.redis as { xreadgroup: (...args: unknown[]) => Promise<unknown> };
        const results = await r.xreadgroup(
          'GROUP', this.consumerGroup, this.consumerId,
          'COUNT', '10', 'BLOCK', '5000',
          'STREAMS', this.streamKey, '>',
        ) as Array<[string, Array<[string, string[]]>]> | null;

        if (!results) continue;

        for (const [, messages] of results) {
          for (const [, fields] of messages) {
            const map = new Map<string, string>();
            for (let i = 0; i < fields.length; i += 2) {
              map.set(fields[i]!, fields[i + 1]!);
            }
            const event: EngineEvent<unknown> = {
              id: map.get('id') ?? '',
              type: map.get('type') as EngineEventType,
              timestamp: map.get('timestamp') ?? '',
              payload: JSON.parse(map.get('payload') ?? 'null') as unknown,
              metadata: JSON.parse(map.get('metadata') ?? '{}') as Record<string, unknown>,
            };
            const handlers = this.handlers.get(event.type);
            if (handlers) {
              for (const handler of handlers) {
                void handler(event);
              }
            }
            // Dispatch to wildcard (onAny) handlers
            const anyHandlers = this.handlers.get('*');
            if (anyHandlers) {
              for (const handler of anyHandlers) {
                void handler(event);
              }
            }
          }
        }
      } catch {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  stop(): void {
    this.polling = false;
  }
}
