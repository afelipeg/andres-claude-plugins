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
import { getConnectorStatus } from '../api/onboarding';

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

  const urgencyColor: Record<string, string> = {
    low: 'bg-green-100 text-green-700',
    medium: 'bg-yellow-100 text-yellow-700',
    high: 'bg-red-100 text-red-700',
  };

  return (
    <div className="space-y-2">
      {decisions.map((d) => (
        <div key={d.id} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-amber-700">{d.pipeline_id}</span>
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${urgencyColor[d.urgency] ?? 'bg-gray-100'}`}>
              {d.urgency}
            </span>
            {d.client_id && (
              <span className="text-[10px] text-gray-400">{d.client_id}</span>
            )}
          </div>
          <p className="mt-1 text-xs text-gray-600 line-clamp-2">{d.reason}</p>
          <p className="mt-0.5 text-[10px] text-gray-400 font-mono">run {d.run_id.slice(0, 10)}</p>
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

// ─── HFL Badge ───────────────────────────────────────────────────

function HFLBadge({ status, urgency }: { status: string; urgency?: string }) {
  const colors: Record<string, string> = {
    auto_approved: 'bg-green-100 text-green-700',
    escalated: 'bg-amber-100 text-amber-700',
    human_approved: 'bg-green-100 text-green-700',
    human_rejected: 'bg-red-100 text-red-700',
    timed_out: 'bg-gray-100 text-gray-500',
  };
  const label = status.replace(/_/g, ' ');
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${colors[status] ?? 'bg-gray-100 text-gray-500'}`}>
      {urgency && status === 'escalated' ? `${urgency}` : label}
    </span>
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

type RunType = 'standard' | 'planned' | 'actual';

const RUN_TYPE_LABELS: Record<RunType, string> = {
  standard: 'Standard Run',
  planned: 'Planned Run',
  actual: 'Actual Run',
};

const RUN_TYPE_COLORS: Record<RunType, string> = {
  standard: 'bg-zinc-100 text-zinc-700',
  planned: 'bg-blue-100 text-blue-700',
  actual: 'bg-green-100 text-green-700',
};

export function CommandCenterPage() {
  const [agents, setAgents] = useState<AgentState[]>([]);
  const [pipelines, setPipelines] = useState<MeshPipeline[]>([]);
  const [runs, setRuns] = useState<MeshRunSummary[]>([]);
  const [goals, setGoals] = useState<GoalSummary[]>([]);
  const [decisions, setDecisions] = useState<PendingDecision[]>([]);
  const [selectedRunDetail, setSelectedRunDetail] = useState<MeshRunDetail | null>(null);
  const [executing, setExecuting] = useState(false);
  const [syntheticData, setSyntheticData] = useState(false);
  const [runType, setRunType] = useState<RunType>('standard');
  const [runTypeMap, setRunTypeMap] = useState<Record<string, RunType>>({});
  const { events, connected } = useEventStream();

  const refresh = useCallback(async () => {
    try {
      const [a, p, r, g, d, cs] = await Promise.allSettled([
        listAgents(),
        listPipelines(),
        listRuns(),
        listGoals(),
        listPendingDecisions(),
        getConnectorStatus(),
      ]);
      if (a.status === 'fulfilled') setAgents(a.value);
      if (p.status === 'fulfilled') setPipelines(p.value);
      if (r.status === 'fulfilled') setRuns(r.value);
      if (g.status === 'fulfilled') setGoals(g.value);
      if (d.status === 'fulfilled') setDecisions(d.value);
      if (cs.status === 'fulfilled') {
        const anyConnected = cs.value.some((s) => s.connected);
        setSyntheticData(!anyConnected);
      }
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
      const result = await executePipeline('full-optimization', undefined, undefined, runType);
      setSelectedRunDetail(result);
      setRunTypeMap((prev) => ({ ...prev, [result.id]: runType }));
      await refresh();
    } catch {
      // Error handled
    } finally {
      setExecuting(false);
    }
  };

  const handleApprove = async (d: PendingDecision) => {
    try {
      await approveDecision(d.pipeline_id, d.run_id);
      setDecisions((prev) => prev.filter((x) => x.id !== d.id));
      await refresh();
    } catch { /* keep visible */ }
  };

  const handleReject = async (d: PendingDecision) => {
    try {
      await rejectDecision(d.pipeline_id, d.run_id);
      setDecisions((prev) => prev.filter((x) => x.id !== d.id));
      await refresh();
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
    <div className="flex flex-col gap-4 h-full">
      {syntheticData && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <svg className="h-4 w-4 shrink-0 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <p className="text-sm text-amber-800">
            <span className="font-semibold">Running on synthetic data</span> — no ad platforms are connected.{' '}
            <a href="/app/integrations" className="underline hover:text-amber-900">Connect a platform</a> to analyze real campaign data.
          </p>
        </div>
      )}
    <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-12">
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
          {/* Run type selector */}
          <div className="mt-3">
            <label className="text-[11px] font-medium text-gray-500 mb-1 block">Run type</label>
            <div className="flex gap-2">
              {(['standard', 'planned', 'actual'] as RunType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setRunType(t)}
                  className={`flex-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
                    runType === t
                      ? `${RUN_TYPE_COLORS[t]} border-transparent`
                      : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => void handleExecute()}
            disabled={executing}
            className="mt-3 w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {executing ? 'Executing...' : 'Execute Full Pipeline'}
          </button>
          {syntheticData && (
            <p className="mt-2 text-center text-[10px] text-amber-600">Results will use synthetic benchmark data</p>
          )}
        </div>

        {/* Stage Output Visualization */}
        {selectedRunDetail && (
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-900">Stage Output</h3>
                {(runTypeMap[selectedRunDetail.id] != null) && (() => {
                  const rt = runTypeMap[selectedRunDetail.id] as RunType;
                  return (
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${RUN_TYPE_COLORS[rt]}`}>
                      {RUN_TYPE_LABELS[rt]}
                    </span>
                  );
                })()}
              </div>
              <div className="flex items-center gap-1.5">
                {selectedRunDetail.hfl_decision && (
                  <HFLBadge status={selectedRunDetail.hfl_decision.status} urgency={selectedRunDetail.hfl_decision.urgency} />
                )}
                <StatusBadge status={selectedRunDetail.status} />
              </div>
            </div>
            <p className="mt-1 text-[10px] text-gray-400 font-mono">{selectedRunDetail.id.slice(0, 12)}</p>
            {selectedRunDetail.hfl_decision && (
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-amber-700">HFL Decision</span>
                  <HFLBadge status={selectedRunDetail.hfl_decision.status} urgency={selectedRunDetail.hfl_decision.urgency} />
                </div>
                <p className="mt-1 text-[10px] text-gray-600">{selectedRunDetail.hfl_decision.reason}</p>
                {selectedRunDetail.hfl_decision.human_feedback && (
                  <p className="mt-1 text-[10px] text-gray-500 italic">Feedback: {selectedRunDetail.hfl_decision.human_feedback}</p>
                )}
              </div>
            )}
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
                  <div className="flex items-center gap-1.5">
                    {r.hfl && <HFLBadge status={r.hfl.status} urgency={r.hfl.urgency} />}
                    <StatusBadge status={r.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
    </div>
  );
}
