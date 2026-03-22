// ─── Consumption Page ──────────────────────────────────────────────
// Usage metering: pipeline runs, tokens, actions, per-engine breakdown.

import { useState, useEffect, useCallback } from 'react';
import { Spinner } from '../components/Spinner';
import { StatusBadge } from '../components/StatusBadge';
import { listRuns, getRun, type MeshRunSummary, type MeshRunDetail } from '../api/agents';
import {
  GlassCard,
  GlassCardHeader,
  GlassCardTitle,
  GlassCardContent,
  GlassTable,
  GlassTableHeader,
  GlassTableBody,
  GlassTableRow,
  GlassTableHead,
  GlassTableCell,
  StatCard,
  StatsGrid,
} from '../components/ui/glass';

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
          <p className="text-sm font-semibold text-white/95">Run {run.id.slice(0, 10)}</p>
          <p className="text-xs text-white/50">{run.pipeline_id}</p>
        </div>
        <StatusBadge status={run.status} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-white/5 border border-white/10 p-2.5 text-center">
          <p className="text-xs text-white/50">Duration</p>
          <p className="text-sm font-bold text-white/95">{fmtDuration(run.total_duration_ms)}</p>
        </div>
        <div className="rounded-lg bg-white/5 border border-white/10 p-2.5 text-center">
          <p className="text-xs text-white/50">Stages</p>
          <p className="text-sm font-bold text-white/95">{stageEntries.length}</p>
        </div>
        <div className="rounded-lg bg-white/5 border border-white/10 p-2.5 text-center">
          <p className="text-xs text-white/50">Actions</p>
          <p className="text-sm font-bold text-white/95">{run.usage?.actions_executed ?? 0}</p>
        </div>
      </div>

      {stageEntries.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-white/50 uppercase">Stages</h4>
          {stageEntries.map(([agentId, stage]) => (
            <div key={agentId} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              <div>
                <p className="text-sm font-medium text-white/95">{agentId}</p>
                <p className="text-xs text-white/50">
                  {stage.skills_invoked.length > 0 ? stage.skills_invoked.join(', ') : 'no skills invoked'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-white/50">{fmtDuration(stage.duration_ms)}</span>
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
  
  const completedRuns = runs.filter(r => r.status === 'completed' || r.status === 'partial').length; void completedRuns;
  const totalDuration = runs.reduce((sum, r) => sum + r.total_duration_ms, 0);
  const avgDuration = totalRuns > 0 ? totalDuration / totalRuns : 0;

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Spinner /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Consumption</h2>
        <p className="mt-1 text-sm text-white/50">
          Usage metering: pipeline runs, execution time, actions, and per-stage breakdown.
        </p>
      </div>

      {/* Summary Metrics */}
      <StatsGrid columns={4}>
        <StatCard
          label="Total Runs"
          value={String(totalRuns)}
        />
        <StatCard
          label="Total Execution Time"
          value={fmtDuration(totalDuration)}
        />
        <StatCard
          label="Avg Run Duration"
          value={fmtDuration(Math.round(avgDuration))}
        />
        <StatCard
          label="Engines Available"
          value="4"
        />
      </StatsGrid>

      {/* Runs Table + Detail Panel */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Runs List */}
        <div className="lg:col-span-3">
          <GlassCard>
            <GlassCardHeader>
              <GlassCardTitle>Pipeline Runs</GlassCardTitle>
            </GlassCardHeader>
            <GlassCardContent>
              {runs.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-white/50">No pipeline runs yet.</p>
                  <p className="mt-1 text-xs text-white/30">
                    Run the demo from the Home page or execute a pipeline from the Command Center.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <GlassTable>
                    <GlassTableHeader>
                      <GlassTableRow>
                        <GlassTableHead>Run ID</GlassTableHead>
                        <GlassTableHead>Pipeline</GlassTableHead>
                        <GlassTableHead>Status</GlassTableHead>
                        <GlassTableHead>Duration</GlassTableHead>
                        <GlassTableHead>Started</GlassTableHead>
                      </GlassTableRow>
                    </GlassTableHeader>
                    <GlassTableBody>
                      {runs.map((run) => (
                        <GlassTableRow
                          key={run.id}
                          onClick={() => void handleSelectRun(run.id)}
                          className={`cursor-pointer transition-colors hover:bg-white/5 ${
                            selectedRun?.id === run.id ? 'bg-[#00F5FF]/5' : ''
                          }`}
                        >
                          <GlassTableCell className="font-mono text-xs text-white/70">{run.id.slice(0, 10)}</GlassTableCell>
                          <GlassTableCell className="text-white/70">{run.pipeline_id}</GlassTableCell>
                          <GlassTableCell><StatusBadge status={run.status} /></GlassTableCell>
                          <GlassTableCell className="text-white/70">{fmtDuration(run.total_duration_ms)}</GlassTableCell>
                          <GlassTableCell className="text-xs text-white/50">{new Date(run.started_at).toLocaleString()}</GlassTableCell>
                        </GlassTableRow>
                      ))}
                    </GlassTableBody>
                  </GlassTable>
                </div>
              )}
            </GlassCardContent>
          </GlassCard>
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-2">
          <GlassCard>
            <GlassCardHeader>
              <GlassCardTitle>Run Detail</GlassCardTitle>
            </GlassCardHeader>
            <GlassCardContent>
              {detailLoading ? (
                <div className="flex h-32 items-center justify-center"><Spinner /></div>
              ) : selectedRun ? (
                <RunDetailPanel run={selectedRun} />
              ) : (
                <p className="py-8 text-center text-sm text-white/40">
                  Click a run to see stage-level details.
                </p>
              )}
            </GlassCardContent>
          </GlassCard>

          {/* Cost Estimation */}
          <GlassCard className="mt-4">
            <GlassCardHeader>
              <GlassCardTitle>Cost Estimation</GlassCardTitle>
            </GlassCardHeader>
            <GlassCardContent>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-white/70">
                  <span>LLM Calls (orient + decide)</span>
                  <span className="font-medium">{totalRuns * 2} calls</span>
                </div>
                <div className="flex justify-between text-white/70">
                  <span>Est. Tokens (~4K/call)</span>
                  <span className="font-medium">{fmtTokens(totalRuns * 2 * 4000)}</span>
                </div>
                <div className="flex justify-between text-white/70">
                  <span>Est. LLM Cost</span>
                  <span className="font-medium">${(totalRuns * 2 * 0.012).toFixed(2)}</span>
                </div>
                <hr className="border-white/10" />
                <div className="flex justify-between font-semibold text-white/95">
                  <span>Total Infrastructure</span>
                  <span>${(totalRuns * 2 * 0.012 + totalRuns * 0.001).toFixed(2)}</span>
                </div>
                <p className="text-xs text-white/40">
                  Estimated based on Claude Sonnet pricing. Actual costs depend on prompt/completion sizes.
                </p>
              </div>
            </GlassCardContent>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
