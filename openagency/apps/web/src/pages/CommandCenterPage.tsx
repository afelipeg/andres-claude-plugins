// ─── Command Center Page ───────────────────────────────────────────
// Three-panel view: Agent Status | Live Feed | Metrics & Pipeline

import { useState, useEffect, useCallback } from 'react';
import { AgentRow } from '../components/AgentRow';
import { EventFeed } from '../components/EventFeed';
import { PipelineViz } from '../components/PipelineViz';
import { StatusBadge } from '../components/StatusBadge';
import { useEventStream } from '../hooks/useEventStream';
import {
  listAgents,
  listPipelines,
  listRuns,
  executePipeline,
  type AgentState,
  type MeshPipeline,
  type MeshRunSummary,
} from '../api/agents';

export function CommandCenterPage() {
  const [agents, setAgents] = useState<AgentState[]>([]);
  const [pipelines, setPipelines] = useState<MeshPipeline[]>([]);
  const [runs, setRuns] = useState<MeshRunSummary[]>([]);
  const [executing, setExecuting] = useState(false);
  const { events, connected } = useEventStream();

  const refresh = useCallback(async () => {
    try {
      const [a, p, r] = await Promise.all([listAgents(), listPipelines(), listRuns()]);
      setAgents(a);
      setPipelines(p);
      setRuns(r);
    } catch {
      // API not available — show empty state
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 10_000);
    return () => clearInterval(interval);
  }, [refresh]);

  const handleExecute = async () => {
    if (executing) return;
    setExecuting(true);
    try {
      await executePipeline('full-optimization');
      await refresh();
    } catch {
      // Error handled by API client
    } finally {
      setExecuting(false);
    }
  };

  const lastRun = runs[0];
  const defaultStages = ['leak-detector', 'media-architect', 'campaign-ops', 'executive-bridge'].map(
    (id) => ({ agent_id: id, status: 'pending', duration_ms: 0 }),
  );

  return (
    <div className="grid h-full grid-cols-1 gap-4 lg:grid-cols-12">
      {/* Left panel — Agent Status */}
      <div className="lg:col-span-3 flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-gray-900">Agents</h2>
        <div className="space-y-2">
          {agents.length > 0 ? (
            agents.map((agent) => (
              <AgentRow key={agent.agent_id} agent={agent} onRefresh={refresh} />
            ))
          ) : (
            <p className="py-4 text-center text-sm text-gray-400">
              No agents loaded. Start the API server.
            </p>
          )}
        </div>

        {/* Pipeline visualization */}
        <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-900">Pipeline Flow</h3>
          <div className="mt-3 flex justify-center">
            <PipelineViz stages={defaultStages} />
          </div>
        </div>
      </div>

      {/* Center panel — Live Feed */}
      <div className="lg:col-span-5 flex flex-col rounded-lg border border-gray-200 bg-white overflow-hidden">
        <EventFeed events={events} connected={connected} />
      </div>

      {/* Right panel — Metrics & Actions */}
      <div className="lg:col-span-4 flex flex-col gap-4">
        {/* Execute pipeline button */}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-900">Pipeline Control</h3>
          <p className="mt-1 text-xs text-gray-500">
            Run the full 4-stage optimization pipeline
          </p>
          <button
            onClick={handleExecute}
            disabled={executing}
            className="mt-3 w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {executing ? 'Executing...' : 'Execute Full Pipeline'}
          </button>
        </div>

        {/* Last run summary */}
        {lastRun && (
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Last Run</h3>
              <StatusBadge status={lastRun.status} />
            </div>
            <div className="mt-2 space-y-1.5 text-xs text-gray-600">
              <div className="flex justify-between">
                <span>Pipeline</span>
                <span className="font-medium">{lastRun.pipeline_id}</span>
              </div>
              <div className="flex justify-between">
                <span>Duration</span>
                <span className="font-medium">{(lastRun.total_duration_ms / 1000).toFixed(1)}s</span>
              </div>
              <div className="flex justify-between">
                <span>Started</span>
                <span className="font-medium">{new Date(lastRun.started_at).toLocaleTimeString()}</span>
              </div>
            </div>
          </div>
        )}

        {/* Available pipelines */}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-900">Available Pipelines</h3>
          {pipelines.length > 0 ? (
            <div className="mt-2 space-y-2">
              {pipelines.map((p) => (
                <div key={p.id} className="rounded-md border border-gray-100 bg-gray-50 p-2.5">
                  <p className="text-sm font-medium text-gray-900">{p.name}</p>
                  <p className="text-xs text-gray-500">{p.stage_count} stages</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-gray-400">No pipelines registered</p>
          )}
        </div>

        {/* Recent runs */}
        {runs.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-gray-900">Recent Runs</h3>
            <div className="mt-2 space-y-1.5">
              {runs.slice(0, 5).map((r) => (
                <div key={r.id} className="flex items-center justify-between text-xs">
                  <span className="font-mono text-gray-500">{r.id.slice(0, 8)}</span>
                  <StatusBadge status={r.status} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
