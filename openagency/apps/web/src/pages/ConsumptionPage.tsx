// ─── Consumption Page ──────────────────────────────────────────────
// Usage metering: pipeline runs, tokens, actions, per-engine breakdown.

import { useState, useEffect, useCallback } from 'react';
import { Card, MetricCard } from '../components/Card';
import { Spinner } from '../components/Spinner';
import { StatusBadge } from '../components/StatusBadge';
import { listRuns, getRun, type MeshRunSummary, type MeshRunDetail } from '../api/agents';

// ─── Helpers ──────────────────────────────────────────────────────

function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

// ─── Run Detail Panel ─────────────────────────────────────────────

function RunDetailPanel({ run }: { run: MeshRunDetail }) {
  const stageEntries = Object.entries(run.stage_results ?? {});

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">Run {run.id.slice(0, 10)}</p>
          <p className="text-xs text-gray-500">{run.pipeline_id}</p>
        </div>
        <StatusBadge status={run.status} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-gray-50 p-2.5 text-center">
          <p className="text-xs text-gray-500">Duration</p>
          <p className="text-sm font-bold text-gray-900">{fmtDuration(run.total_duration_ms)}</p>
        </div>
        <div className="rounded-lg bg-gray-50 p-2.5 text-center">
          <p className="text-xs text-gray-500">Stages</p>
          <p className="text-sm font-bold text-gray-900">{stageEntries.length}</p>
        </div>
        <div className="rounded-lg bg-gray-50 p-2.5 text-center">
          <p className="text-xs text-gray-500">Actions</p>
          <p className="text-sm font-bold text-gray-900">{run.usage?.actions_executed ?? 0}</p>
        </div>
      </div>

      {stageEntries.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-gray-500 uppercase">Stages</h4>
          {stageEntries.map(([agentId, stage]) => (
            <div key={agentId} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
              <div>
                <p className="text-sm font-medium text-gray-900">{agentId}</p>
                <p className="text-xs text-gray-500">
                  {stage.skills_invoked.length > 0 ? stage.skills_invoked.join(', ') : 'no skills invoked'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">{fmtDuration(stage.duration_ms)}</span>
                <StatusBadge status={stage.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────

export function ConsumptionPage() {
  const [runs, setRuns] = useState<MeshRunSummary[]>([]);
  const [selectedRun, setSelectedRun] = useState<MeshRunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadRuns = useCallback(async () => {
    setLoading(true);
    try {
      const r = await listRuns();
      setRuns(r);
    } catch {
      // API not available
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadRuns(); }, [loadRuns]);

  const handleSelectRun = async (runId: string) => {
    setDetailLoading(true);
    try {
      const detail = await getRun(runId);
      setSelectedRun(detail);
    } catch {
      // Failed to fetch detail
    } finally {
      setDetailLoading(false);
    }
  };

  // Aggregate stats
  const totalRuns = runs.length;
  const completedRuns = runs.filter(r => r.status === 'completed' || r.status === 'partial').length;
  const totalDuration = runs.reduce((sum, r) => sum + r.total_duration_ms, 0);
  const avgDuration = totalRuns > 0 ? totalDuration / totalRuns : 0;

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Spinner /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Consumption</h2>
        <p className="mt-1 text-sm text-gray-500">
          Usage metering: pipeline runs, execution time, actions, and per-stage breakdown.
        </p>
      </div>

      {/* Summary Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total Runs"
          value={String(totalRuns)}
          sub={`${completedRuns} completed`}
          color="blue"
        />
        <MetricCard
          label="Total Execution Time"
          value={fmtDuration(totalDuration)}
          sub="across all runs"
          color="green"
        />
        <MetricCard
          label="Avg Run Duration"
          value={fmtDuration(Math.round(avgDuration))}
          sub="per pipeline"
          color="gray"
        />
        <MetricCard
          label="Engines Available"
          value="4"
          sub="29 skills total"
          color="yellow"
        />
      </div>

      {/* Runs Table + Detail Panel */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Runs List */}
        <div className="lg:col-span-3">
          <Card title="Pipeline Runs">
            {runs.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-gray-500">No pipeline runs yet.</p>
                <p className="mt-1 text-xs text-gray-400">
                  Run the demo from the Home page or execute a pipeline from the Command Center.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left">
                      <th className="pb-2 font-semibold text-gray-900">Run ID</th>
                      <th className="pb-2 font-semibold text-gray-900">Pipeline</th>
                      <th className="pb-2 font-semibold text-gray-900">Status</th>
                      <th className="pb-2 font-semibold text-gray-900">Duration</th>
                      <th className="pb-2 font-semibold text-gray-900">Started</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((run) => (
                      <tr
                        key={run.id}
                        onClick={() => void handleSelectRun(run.id)}
                        className={`cursor-pointer border-b border-gray-50 transition-colors hover:bg-gray-50 ${
                          selectedRun?.id === run.id ? 'bg-zinc-100' : ''
                        }`}
                      >
                        <td className="py-2.5 font-mono text-xs text-gray-600">{run.id.slice(0, 10)}</td>
                        <td className="py-2.5 text-gray-700">{run.pipeline_id}</td>
                        <td className="py-2.5"><StatusBadge status={run.status} /></td>
                        <td className="py-2.5 text-gray-600">{fmtDuration(run.total_duration_ms)}</td>
                        <td className="py-2.5 text-xs text-gray-500">{new Date(run.started_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-2">
          <Card title="Run Detail">
            {detailLoading ? (
              <div className="flex h-32 items-center justify-center"><Spinner /></div>
            ) : selectedRun ? (
              <RunDetailPanel run={selectedRun} />
            ) : (
              <p className="py-8 text-center text-sm text-gray-400">
                Click a run to see stage-level details.
              </p>
            )}
          </Card>

          {/* Cost Estimation */}
          <div className="mt-4">
            <Card title="Cost Estimation">
              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>LLM Calls (orient + decide)</span>
                  <span className="font-medium">{totalRuns * 2} calls</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Est. Tokens (~4K/call)</span>
                  <span className="font-medium">{fmtTokens(totalRuns * 2 * 4000)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Est. LLM Cost</span>
                  <span className="font-medium">${(totalRuns * 2 * 0.012).toFixed(2)}</span>
                </div>
                <hr className="border-gray-100" />
                <div className="flex justify-between font-semibold text-gray-900">
                  <span>Total Infrastructure</span>
                  <span>${(totalRuns * 2 * 0.012 + totalRuns * 0.001).toFixed(2)}</span>
                </div>
                <p className="text-xs text-gray-400">
                  Estimated based on Claude Sonnet pricing. Actual costs depend on prompt/completion sizes.
                </p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
