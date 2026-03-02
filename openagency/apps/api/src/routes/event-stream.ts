// ─── SSE Event Stream Route ─────────────────────────────────────────
// GET /v1/agents/events/stream — real-time event streaming via SSE.

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { EventBus, EngineEvent, EngineEventType } from '@openagency/types';

export function eventStreamRoutes(eventBus: EventBus) {
  const app = new Hono();

  app.get('/v1/agents/events/stream', (c) => {
    const agentId = c.req.query('agent_id');
    const typesParam = c.req.query('type');
    const typeFilter = typesParam
      ? new Set(typesParam.split(',').map((t) => t.trim()))
      : null;

    return streamSSE(c, async (stream) => {
      let alive = true;

      const unsubscribe = eventBus.onAny((event: EngineEvent) => {
        if (!alive) return;

        // Filter by agent_id if specified
        if (agentId) {
          const payload = event.payload as Record<string, unknown> | null;
          if (payload && payload['agent_id'] && payload['agent_id'] !== agentId) {
            return;
          }
        }

        // Filter by event type if specified
        if (typeFilter && !typeFilter.has(event.type)) {
          return;
        }

        void stream.writeSSE({
          id: event.id,
          event: event.type,
          data: JSON.stringify({
            id: event.id,
            type: event.type,
            timestamp: event.timestamp,
            payload: event.payload,
            metadata: event.metadata,
          }),
        });
      });

      // Keepalive every 30 seconds
      const keepalive = setInterval(() => {
        if (!alive) return;
        void stream.writeSSE({
          event: 'keepalive',
          data: JSON.stringify({ timestamp: new Date().toISOString() }),
        });
      }, 30_000);

      // Cleanup on disconnect
      stream.onAbort(() => {
        alive = false;
        clearInterval(keepalive);
        unsubscribe();
      });

      // Keep the stream open until client disconnects
      await new Promise<void>((resolve) => {
        stream.onAbort(() => resolve());
      });
    });
  });

  return app;
}
