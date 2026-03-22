// ─── Agency Dashboard ──────────────────────────────────────────────
// Agency-scoped metrics for agency_admin + account_manager.
// 4 sections: Overview, Runs, Usage, Scorecards.

import { useState, useEffect, useCallback } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import {
  Building2, Zap, Plug, FileText, RefreshCw,
} from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../components/ui/table';
import {
  getAgencyOverview, getAgencyRuns, getAgencyUsage, getAgencyScorecards,
  type AgencyOverview,
} from '../api/agency-dashboard';

function fmtUsd(n: number): string {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(s: string | null): string {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function ProgressBar({ used, limit, color, label }: { used: number; limit: number; color: string; label: string }) {
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const barColor = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : color;
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-white/50">{label}</p>
      <p className="mt-2 text-2xl font-bold text-white/95">{used} <span className="text-sm font-normal text-white/40">/ {limit}</span></p>
      <div className="mt-2 h-2 w-full rounded-full bg-white/10">
        <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: barColor }} />
      </div>
    </div>
  );
}

function StatCard({ label, value, Icon, color }: { label: string; value: string | number; Icon: React.ComponentType<{ className?: string }>; color: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-white/50">{label}</p>
          <p className="mt-2 text-2xl font-bold text-white/95">{value}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-emerald-500/100/20 text-emerald-300',
  running: 'bg-[#00F5FF]/20 text-[#00F5FF]',
  failed: 'bg-red-100 text-red-400',
  pending: 'bg-amber-500/100/20 text-amber-300',
  accepted: 'bg-emerald-500/100/20 text-emerald-300',
  rejected: 'bg-red-100 text-red-400',
};

const TABS = ['overview', 'runs', 'usage', 'scorecards'] as const;
type Tab = (typeof TABS)[number];
const TAB_LABELS: Record<Tab, string> = { overview: 'Overview', runs: 'Pipeline Runs', usage: 'Usage & Cost', scorecards: 'Scorecards' };

export function AgencyDashboard() {
  const [tab, setTab] = useState<Tab>('overview');
  const [overview, setOverview] = useState<AgencyOverview | null>(null);
  const [runs, setRuns] = useState<Array<Record<string, unknown>>>([]);
  const [usage, setUsage] = useState<Array<Record<string, unknown>>>([]);
  const [scorecards, setScorecards] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      switch (tab) {
        case 'overview': { setOverview(await getAgencyOverview()); break; }
        case 'runs': { const d = await getAgencyRuns({ limit: 50 }); setRuns(d.runs); break; }
        case 'usage': { const d = await getAgencyUsage(30); setUsage(d.by_day); break; }
        case 'scorecards': { const d = await getAgencyScorecards(20); setScorecards(d.scorecards); break; }
      }
    } catch (err) { console.error('[agency-dashboard]', err); }
    finally { setLoading(false); }
  }, [tab]);

  useEffect(() => { void loadData(); }, [loadData]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white/95">{overview?.agency_name ?? 'Agency Dashboard'}</h2>
          <p className="text-sm text-white/50">Your agency performance and usage</p>
        </div>
        <button onClick={() => void loadData()} className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/60 hover:bg-white/5">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="flex gap-1 border-b border-white/10">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t ? 'border-[#02c98d] text-[#02c98d]' : 'border-transparent text-white/50 hover:text-white/70'}`}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><RefreshCw className="h-6 w-6 animate-spin text-white/40" /></div>
      ) : (
        <>
          {tab === 'overview' && overview && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
                <ProgressBar used={overview.runs_used} limit={overview.runs_limit} color="#3b82f6" label="Pipeline Runs (this month)" />
                <ProgressBar used={overview.assistant_sessions_used} limit={overview.assistant_sessions_limit} color="#8b5cf6" label="Assistant Sessions" />
                <StatCard label="Brands" value={overview.brand_count} Icon={Building2} color="bg-[#00F5FF]/20 text-[#00F5FF]" />
                <StatCard label="Connectors" value={overview.active_connectors} Icon={Plug} color="bg-emerald-500/100/20 text-emerald-300" />
                <StatCard label="Total Runs" value={overview.total_runs} Icon={Zap} color="bg-amber-500/100/20 text-amber-300" />
                <StatCard label="Scorecards" value={overview.total_scorecards} Icon={FileText} color="bg-violet-500/20 text-violet-300" />
              </div>
              {overview.last_run && (
                <p className="text-xs text-white/40">Last run: {fmtDate(overview.last_run)}</p>
              )}
            </div>
          )}

          {tab === 'runs' && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Run ID</TableHead>
                  <TableHead>Pipeline</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">{String(r['id'] ?? '').slice(0, 12)}...</TableCell>
                    <TableCell className="text-xs">{String(r['pipeline_id'] ?? '')}</TableCell>
                    <TableCell><span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[String(r['status'])] ?? 'bg-white/10 text-white/60'}`}>{String(r['status'])}</span></TableCell>
                    <TableCell className="text-xs text-white/50">{fmtDate(String(r['started_at'] ?? ''))}</TableCell>
                    <TableCell className="text-xs">{fmtDuration(Number(r['total_duration_ms'] ?? 0))}</TableCell>
                  </TableRow>
                ))}
                {runs.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-white/40 py-8">No pipeline runs yet</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}

          {tab === 'usage' && (
            <div className="space-y-4">
              {usage.length > 0 ? (
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <HighchartsReact highcharts={Highcharts} options={{
                    chart: { type: 'area', height: 280 },
                    title: { text: 'Daily Token Usage (30 days)', style: { fontSize: '14px' } },
                    xAxis: { categories: [...usage].reverse().map((d) => String(d['date'] ?? '').slice(5)), labels: { style: { fontSize: '10px' } } },
                    yAxis: { title: { text: 'Tokens' } },
                    plotOptions: { area: { stacking: 'normal', marker: { enabled: false }, fillOpacity: 0.3 } },
                    colors: ['#6366f1', '#f59e0b'],
                    series: [
                      { name: 'Prompt', data: [...usage].reverse().map((d) => Number(d['tokens_prompt'] ?? 0)), type: 'area' },
                      { name: 'Completion', data: [...usage].reverse().map((d) => Number(d['tokens_completion'] ?? 0)), type: 'area' },
                    ],
                    credits: { enabled: false },
                  } satisfies Highcharts.Options} />
                </div>
              ) : (
                <p className="text-center text-sm text-white/40 py-12">No usage data yet. Run your first pipeline to see metrics.</p>
              )}
            </div>
          )}

          {tab === 'scorecards' && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Ad Spend</TableHead>
                  <TableHead>Total Fee</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scorecards.map((s, i) => {
                  const billing = (s['billing'] as Record<string, unknown>) ?? {};
                  return (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">{String(s['id'] ?? '').slice(0, 12)}...</TableCell>
                      <TableCell>{fmtUsd(Number(s['ad_spend'] ?? 0))}</TableCell>
                      <TableCell className="font-semibold">{fmtUsd(Number(billing['total_fee'] ?? 0))}</TableCell>
                      <TableCell><span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[String(s['status'])] ?? 'bg-white/10 text-white/60'}`}>{String(s['status'])}</span></TableCell>
                      <TableCell className="text-xs text-white/50">{fmtDate(String(s['created_at'] ?? ''))}</TableCell>
                    </TableRow>
                  );
                })}
                {scorecards.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-white/40 py-8">No scorecards yet</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </>
      )}
    </div>
  );
}
