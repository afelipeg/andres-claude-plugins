// ─── Agent Row (Glassmorphism) ─────────────────────────────────────

import { StatusBadge } from './StatusBadge';
import type { AgentState } from '../api/agents';
import { startAgent, stopAgent, pauseAgent } from '../api/agents';

interface AgentRowProps {
  agent: AgentState;
  onRefresh: () => void;
}

const ENGINE_LABELS: Record<string, string> = {
  'leak-detector': 'Leak Detector',
  'media-architect': 'Media Architect',
  'campaign-ops': 'Campaign Ops',
  'executive-bridge': 'Executive Bridge',
};

export function AgentRow({ agent, onRefresh }: AgentRowProps) {
  const label = ENGINE_LABELS[agent.engine_id] ?? agent.engine_id;
  const canStart = agent.status === 'idle' || agent.status === 'error';
  const canStop = agent.status !== 'idle';
  const canPause = agent.status === 'observing' || agent.status === 'orienting' || agent.status === 'deciding' || agent.status === 'acting';

  const handleAction = async (action: (id: string) => Promise<unknown>) => {
    try {
      await action(agent.agent_id);
      onRefresh();
    } catch {
      // Silently handle — the UI will refresh
    }
  };

  return (
    <div className="flex items-center justify-between rounded-lg border border-white/[0.10] bg-white/[0.05] backdrop-blur-xl px-4 py-3 transition-all duration-300 hover:border-white/[0.15] hover:bg-white/[0.07]">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white/[0.10] text-xs font-bold text-[#00F5FF]">
          {label.charAt(0)}
        </div>
        <div>
          <p className="text-sm font-medium text-white/95">{label}</p>
          <p className="text-xs text-white/50">{agent.cycles_completed} cycles</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge status={agent.status} />
        <div className="flex gap-1">
          {canStart && (
            <button
              onClick={() => handleAction(startAgent)}
              className="rounded px-2 py-1 text-xs font-medium text-emerald-400 hover:bg-emerald-500/10 transition-colors"
            >
              Start
            </button>
          )}
          {canPause && (
            <button
              onClick={() => handleAction(pauseAgent)}
              className="rounded px-2 py-1 text-xs font-medium text-amber-400 hover:bg-amber-500/10 transition-colors"
            >
              Pause
            </button>
          )}
          {canStop && (
            <button
              onClick={() => handleAction(stopAgent)}
              className="rounded px-2 py-1 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-colors"
            >
              Stop
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
