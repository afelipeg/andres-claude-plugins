// ─── Event Feed ────────────────────────────────────────────────────

import type { StreamEvent } from '../hooks/useEventStream';
import { StatusBadge } from './StatusBadge';

const EVENT_TYPE_COLORS: Record<string, string> = {
  'agent.cycle.started': 'bg-blue-50 border-blue-200',
  'agent.cycle.completed': 'bg-green-50 border-green-200',
  'agent.cycle.failed': 'bg-red-50 border-red-200',
  'agent.decision.made': 'bg-purple-50 border-purple-200',
  'mesh.pipeline.started': 'bg-indigo-50 border-indigo-200',
  'mesh.pipeline.completed': 'bg-emerald-50 border-emerald-200',
  'mesh.stage.started': 'bg-sky-50 border-sky-200',
  'mesh.stage.completed': 'bg-teal-50 border-teal-200',
  'domain.waste_detected': 'bg-amber-50 border-amber-200',
  'domain.budget_reallocated': 'bg-orange-50 border-orange-200',
};

interface EventFeedProps {
  events: StreamEvent[];
  connected: boolean;
}

export function EventFeed({ events, connected }: EventFeedProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-2">
        <h3 className="text-sm font-semibold text-gray-900">Live Feed</h3>
        <div className="flex items-center gap-1.5">
          <div className={`h-2 w-2 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-300'}`} />
          <span className="text-xs text-gray-500">{connected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {events.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-400">
            {connected ? 'Waiting for events...' : 'Connect to API to see live events'}
          </p>
        ) : (
          <div className="space-y-1.5">
            {events.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EventRow({ event }: { event: StreamEvent }) {
  const colorClass = EVENT_TYPE_COLORS[event.type] ?? 'bg-gray-50 border-gray-200';
  const payload = event.payload as Record<string, unknown> | null;
  const agentId = payload?.['agent_id'] as string | undefined;
  const time = new Date(event.timestamp).toLocaleTimeString();

  return (
    <div className={`rounded-md border px-3 py-2 ${colorClass}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusBadge status={event.type.split('.').pop() ?? event.type} />
          {agentId && <span className="text-xs text-gray-500">{agentId}</span>}
        </div>
        <span className="text-xs text-gray-400">{time}</span>
      </div>
      <p className="mt-0.5 text-xs text-gray-600 truncate">{event.type}</p>
    </div>
  );
}
