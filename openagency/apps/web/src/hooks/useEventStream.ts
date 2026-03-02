// ─── SSE Event Stream Hook ─────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from 'react';

export interface StreamEvent {
  id: string;
  type: string;
  timestamp: string;
  payload: unknown;
}

interface UseEventStreamOptions {
  agentId?: string;
  types?: string[];
}

const MAX_EVENTS = 200;

export function useEventStream(options: UseEventStreamOptions = {}) {
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    const apiUrl = import.meta.env.VITE_API_URL;
    if (!apiUrl) return;

    const params = new URLSearchParams();
    if (options.agentId) params.set('agent_id', options.agentId);
    if (options.types?.length) params.set('type', options.types.join(','));

    const qs = params.toString();
    const url = `${apiUrl}/v1/agents/events/stream${qs ? `?${qs}` : ''}`;

    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    // Listen for all event types
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as StreamEvent;
        setEvents((prev) => {
          const next = [data, ...prev];
          return next.length > MAX_EVENTS ? next.slice(0, MAX_EVENTS) : next;
        });
      } catch {
        // Skip malformed events
      }
    };

    return () => {
      es.close();
      setConnected(false);
    };
  }, [options.agentId, options.types?.join(',')]);

  useEffect(() => {
    const cleanup = connect();
    return cleanup;
  }, [connect]);

  const clear = useCallback(() => setEvents([]), []);

  return { events, connected, clear };
}
