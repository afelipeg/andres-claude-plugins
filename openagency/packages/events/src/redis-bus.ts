// ─── Redis Streams Event Bus ────────────────────────────────────────
// Loaded only when REDIS_URL is set. Falls back to InMemoryEventBus otherwise.
// Fixes: init race (queued events), XACK after processing, consumer cleanup on stop.

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

  /** Stored init promise — callers can await readiness */
  private initPromise: Promise<void>;
  private ready = false;

  /** Events published before Redis is connected — flushed on ready */
  private pendingPublish: EngineEvent<unknown>[] = [];

  constructor(redisUrl: string) {
    this.consumerId = `consumer-${process.pid}-${Date.now()}`;
    this.initPromise = this.init(redisUrl);
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

      this.ready = true;

      // Flush any events that were published before init completed
      if (this.pendingPublish.length > 0) {
        const queued = this.pendingPublish.splice(0);
        for (const event of queued) {
          await this.publishToRedis(event);
        }
      }

      this.startPolling();
    } catch {
      console.warn('[events] ioredis not available, Redis event bus disabled');
    }
  }

  async publish<T>(event: EngineEvent<T>): Promise<void> {
    // If init hasn't completed yet, queue the event
    if (!this.ready) {
      this.pendingPublish.push(event as EngineEvent<unknown>);
      // Wait for init — if init completes, events are flushed there
      await this.initPromise;
      // After init, the event may have been flushed already
      // If redis is still not available, silently drop
      return;
    }
    await this.publishToRedis(event);
  }

  private async publishToRedis<T>(event: EngineEvent<T>): Promise<void> {
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
        const r = this.redis as {
          xreadgroup: (...args: unknown[]) => Promise<unknown>;
          xack: (...args: unknown[]) => Promise<unknown>;
        };
        const results = await r.xreadgroup(
          'GROUP', this.consumerGroup, this.consumerId,
          'COUNT', '10', 'BLOCK', '5000',
          'STREAMS', this.streamKey, '>',
        ) as Array<[string, Array<[string, string[]]>]> | null;

        if (!results) continue;

        for (const [, messages] of results) {
          for (const [messageId, fields] of messages) {
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

            // Dispatch to type-specific handlers
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

            // XACK — acknowledge the message to prevent PEL growth
            try {
              await r.xack(this.streamKey, this.consumerGroup, messageId);
            } catch {
              // ACK failure is non-fatal — message will be re-delivered
            }
          }
        }
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  stop(): void {
    this.polling = false;

    // Clean up consumer from the group to prevent dead consumer entries
    if (this.redis) {
      const r = this.redis as { xgroup: (...args: string[]) => Promise<unknown> };
      r.xgroup('DELCONSUMER', this.streamKey, this.consumerGroup, this.consumerId).catch(() => {
        // Cleanup failure is non-fatal
      });
    }
  }
}
