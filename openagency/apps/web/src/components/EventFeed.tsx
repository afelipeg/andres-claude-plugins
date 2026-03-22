// ─── Event Feed (Glassmorphism) ────────────────────────────────────

import type { StreamEvent } from '../hooks/useEventStream';
import { StatusBadge } from './StatusBadge';

const EVENT_TYPE_COLORS: Record<string, string> = {
  'agent.cycle.started': 'bg-[#00F5FF]/10 border-[#00F5FF]/20',
  'agent.cycle.completed': 'bg-emerald-500/10 border-emerald-400/20',
  'agent.cycle.failed': 'bg-red-500/10 border-red-400/20',
  'agent.decision.made': 'bg-[#7000FF]/10 border-[#7000FF]/20',
  'mesh.pipeline.started': 'bg-[#7000FF]/10 border-[#7000FF]/20',
  'mesh.pipeline.completed': 'bg-emerald-500/10 border-emerald-400/20',
  'mesh.stage.started': 'bg-[#00F5FF]/10 border-[#00F5FF]/20',
  'mesh.stage.completed': 'bg-emerald-500/10 border-emerald-400/20',
  'domain.waste_detected': 'bg-amber-500/10 border-amber-400/20',
  'domain.budget_reallocated': 'bg-[#FF00FF]/10 border-[#FF00FF]/20',
};

interface EventFeedProps {
  events: StreamEvent[];
  connected: boolean;
}

export function EventFeed({ events, connected }: EventFeedProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2">
        <h3 className="text-sm font-semibold text-white/95">Live Feed</h3>
        <div className="flex items-center gap-1.5">
          <div className={`h-2 w-2 rounded-full ${connected ? 'bg-[#00F5FF] shadow-[0_0_8px_rgba(0,245,255,0.5)]' : 'bg-white/20'}`} />
          <span className="text-xs text-white/50">{connected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {events.length === 0 ? (
          <p className="py-8 text-center text-sm text-white/30">
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
  const colorClass = EVENT_TYPE_COLORS[event.type] ?? 'bg-white/[0.05] border-white/[0.10]';
  const payload = event.payload as Record<string, unknown> | null;
  const agentId = payload?.['agent_id'] as string | undefined;
  const time = new Date(event.timestamp).toLocaleTimeString();

  return (
    <div className={`rounded-md border px-3 py-2 backdrop-blur-sm ${colorClass}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusBadge status={event.type.split('.').pop() ?? event.type} />
          {agentId && <span className="text-xs text-white/50">{agentId}</span>}
        </div>
        <span className="text-xs text-white/40">{time}</span>
      </div>
      <p className="mt-0.5 text-xs text-white/50 truncate">{event.type}</p>
    </div>
  );
}
