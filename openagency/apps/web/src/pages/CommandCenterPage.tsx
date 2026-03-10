// ─── Command Center Page ───────────────────────────────────────────
// Three-panel view: Agent Status | Live Feed | Metrics & Pipeline
// Enhanced: decision queue, goal panel, stage output visualization.

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
  getRun,
  executePipeline,
  listGoals,
  listPendingDecisions,
  approveDecision,
  rejectDecision,
  type AgentState,
  type MeshPipeline,
  type MeshRunSummary,
  type MeshRunDetail,
  type GoalSummary,
  type PendingDecision,
} from '../api/agents';

// ─── Decision Queue Component ─────────────────────────────────────

function DecisionQueue({
  decisions,
  onApprove,
  onReject,
}: {
  decisions: PendingDecision[];
  onApprove: (d: PendingDecision) => void;
  onReject: (d: PendingDecision) => void;
}) {
  if (decisions.length === 0) {
    return <p className="py-4 text-center text-xs text-gray-400">No pending decisions</p>;
  }

  const riskColor: Record<string, string> = {
    low: 'bg-green-100 text-green-700',
    medium: 'bg-yellow-100 text-yellow-700',
    high: 'bg-red-100 text-red-700',
  };

  return (
    <div className="space-y-2">
      {decisions.map((d) => (
        <div key={d.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-amber-700">{d.agent_id}</span>
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${riskColor[d.risk_level] ?? 'bg-gray-100'}`}>
              {d.risk_level}
            </span>
            <span className="text-[10px] text-gray-400">{Math.round(d.confidence * 100)}%</span>
          </div>
          <p className="mt-1 text-xs text-gray-600 line-clamp-2">{d.reasoning}</p>
          {d.actions.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {d.actions.slice(0, 3).map((a, i) => (
                <span key={i} className="rounded bg-white px-1.5 py-0.5 text-[10px] font-mono text-gray-500 shadow-sm">
                  {a.type}
                </span>
              ))}
            </div>
          )}
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => onApprove(d)}
              className="rounded-md bg-green-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-green-700"
            >
              Approve
            </button>
            <button
              onClick={() => onReject(d)}
              className="rounded-md bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-red-700"
            >
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Goal Panel Component ─────────────────────────────────────────

function GoalPanel({ goals }: { goals: GoalSummary[] }) {
  if (goals.length === 0) {
    return <p className="py-4 text-center text-xs text-gray-400">No active goals</p>;
  }

  const statusColor: Record<string, string> = {
    active: 'bg-zinc-100 text-zinc-700',
    completed: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
  };

  return (
    <div className="space-y-2">
      {goals.map((g) => (
        <div key={g.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-900">{g.name}</span>
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${statusColor[g.status] ?? 'bg-gray-100'}`}>
              {g.status}
            </span>
          </div>
          <div className="mt-2">
            <div className="flex items-center justify-between text-[10px] text-gray-500">
              <span>{g.target_metric}: {g.current_value ?? '?'} / {g.target_value}</span>
              <span>{g.progress_pct.toFixed(0)}%</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-[#02c98d] transition-all"
                style={{ width: `${Math.min(100, g.progress_pct)}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Stage Output Panel ───────────────────────────────────────────

function StageOutputPanel({ run }: { run: MeshRunDetail }) {
  const stages = Object.entries(run.stage_results ?? {});

  if (stages.length === 0) {
    return <p className="py-4 text-center text-xs text-gray-400">No stage results</p>;
  }

  const stageColors: Record<string, string> = {
    'leak-detector': 'border-red-200 bg-red-50',
    'media-architect': 'border-zinc-200 bg-zinc-50',
    'campaign-ops': 'border-green-200 bg-green-50',
    'executive-bridge': 'border-purple-200 bg-purple-50',
  };

  return (
    <div className="space-y-2">
      {stages.map(([agentId, stage]) => (
        <div key={agentId} className={`rounded-lg border p-3 ${stageColors[agentId] ?? 'border-gray-200 bg-gray-50'}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-900">{agentId}</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500">{stage.duration_ms}ms</span>
              <StatusBadge status={stage.status} />
            </div>
          </div>
          {stage.skills_invoked.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {stage.skills_invoked.map((s) => (
                <span key={s} className="rounded-full bg-white px-1.5 py-0.5 text-[10px] text-gray-600 shadow-sm">{s}</span>
              ))}
            </div>
          )}
          {stage.error && (
            <p className="mt-1 text-[10px] text-red-600">{stage.error}</p>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────

export function CommandCenterPage() {
  const [agents, setAgents] = useState<AgentState[]>([]);
  const [pipelines, setPipelines] = useState<MeshPipeline[]>([]);
  const [runs, setRuns] = useState<MeshRunSummary[]>([]);
  const [goals, setGoals] = useState<GoalSummary[]>([]);
  const [decisions, setDecisions] = useState<PendingDecision[]>([]);
  const [selectedRunDetail, setSelectedRunDetail] = useState<MeshRunDetail | null>(null);
  const [executing, setExecuting] = useState(false);
  const { events, connected } = useEventStream();

  const refresh = useCallback(async () => {
    try {
      const [a, p, r, g, d] = await Promise.allSettled([
        listAgents(),
        listPipelines(),
        listRuns(),
        listGoals(),
        listPendingDecisions(),
      ]);
      if (a.status === 'fulfilled') setAgents(a.value);
      if (p.status === 'fulfilled') setPipelines(p.value);
      if (r.status === 'fulfilled') setRuns(r.value);
      if (g.status === 'fulfilled') setGoals(g.value);
      if (d.status === 'fulfilled') setDecisions(d.value);
    } catch {
      // API not available
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
      const result = await executePipeline('full-optimization');
      setSelectedRunDetail(result);
      await refresh();
    } catch {
      // Error handled
    } finally {
      setExecuting(false);
    }
  };

  const handleApprove = async (d: PendingDecision) => {
    try {
      await approveDecision(d.agent_id, d.id);
      setDecisions((prev) => prev.filter((x) => x.id !== d.id));
    } catch { /* keep visible */ }
  };

  const handleReject = async (d: PendingDecision) => {
    try {
      await rejectDecision(d.agent_id, d.id);
      setDecisions((prev) => prev.filter((x) => x.id !== d.id));
    } catch { /* keep visible */ }
  };

  const handleSelectRun = async (runId: string) => {
    try {
      const detail = await getRun(runId);
      setSelectedRunDetail(detail);
    } catch { /* ignore */ }
  };

  const lastRun = runs[0];
  const defaultStages = ['leak-detector', 'media-architect', 'campaign-ops', 'executive-bridge'].map(
    (id) => ({ agent_id: id, status: 'pending', duration_ms: 0 }),
  );

  return (
    <div className="grid h-full grid-cols-1 gap-4 lg:grid-cols-12">
      {/* Left panel — Agent Status + Goals + Decisions */}
      <div className="lg:col-span-3 flex flex-col gap-3 overflow-y-auto">
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
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-900">Pipeline Flow</h3>
          <div className="mt-3 flex justify-center">
            <PipelineViz stages={defaultStages} />
          </div>
        </div>

        {/* Decision Queue */}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Decision Queue</h3>
            {decisions.length > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                {decisions.length}
              </span>
            )}
          </div>
          <div className="mt-2">
            <DecisionQueue decisions={decisions} onApprove={(d) => void handleApprove(d)} onReject={(d) => void handleReject(d)} />
          </div>
        </div>

        {/* Goal Panel */}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-900">Active Goals</h3>
          <div className="mt-2">
            <GoalPanel goals={goals} />
          </div>
        </div>
      </div>

      {/* Center panel — Live Feed */}
      <div className="lg:col-span-5 flex flex-col rounded-lg border border-gray-200 bg-white overflow-hidden">
        <EventFeed events={events} connected={connected} />
      </div>

      {/* Right panel — Pipeline Control + Stage Output */}
      <div className="lg:col-span-4 flex flex-col gap-4 overflow-y-auto">
        {/* Execute pipeline button */}
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-900">Pipeline Control</h3>
          <p className="mt-1 text-xs text-gray-500">
            Run the full 4-stage optimization pipeline
          </p>
          <button
            onClick={() => void handleExecute()}
            disabled={executing}
            className="mt-3 w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {executing ? 'Executing...' : 'Execute Full Pipeline'}
          </button>
        </div>

        {/* Stage Output Visualization */}
        {selectedRunDetail && (
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Stage Output</h3>
              <StatusBadge status={selectedRunDetail.status} />
            </div>
            <p className="mt-1 text-[10px] text-gray-400 font-mono">{selectedRunDetail.id.slice(0, 12)}</p>
            <div className="mt-3">
              <StageOutputPanel run={selectedRunDetail} />
            </div>
          </div>
        )}

        {/* Last run summary */}
        {lastRun && !selectedRunDetail && (
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
                <div
                  key={r.id}
                  onClick={() => void handleSelectRun(r.id)}
                  className={`flex items-center justify-between text-xs cursor-pointer rounded px-1.5 py-1 transition-colors hover:bg-gray-50 ${
                    selectedRunDetail?.id === r.id ? 'bg-zinc-100' : ''
                  }`}
                >
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
