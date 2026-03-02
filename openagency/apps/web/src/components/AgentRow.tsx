// ─── Agent Row ─────────────────────────────────────────────────────

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
    <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-900 text-xs font-bold text-white">
          {label.charAt(0)}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">{label}</p>
          <p className="text-xs text-gray-500">{agent.cycles_completed} cycles</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge status={agent.status} />
        <div className="flex gap-1">
          {canStart && (
            <button
              onClick={() => handleAction(startAgent)}
              className="rounded px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50"
            >
              Start
            </button>
          )}
          {canPause && (
            <button
              onClick={() => handleAction(pauseAgent)}
              className="rounded px-2 py-1 text-xs font-medium text-yellow-700 hover:bg-yellow-50"
            >
              Pause
            </button>
          )}
          {canStop && (
            <button
              onClick={() => handleAction(stopAgent)}
              className="rounded px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
            >
              Stop
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
