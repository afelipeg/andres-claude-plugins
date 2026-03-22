// ─── History Page ─────────────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react';
import {
  Clock, CheckCircle2, XCircle, Loader2, AlertTriangle,
  ChevronDown, ChevronRight, RefreshCw, Bot, FileText,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import {
  GlassCard,
  GlassCardContent,
  GlassButton,

} from '../components/ui/glass';

const API_URL = import.meta.env.VITE_API_URL ?? '';

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('plinth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

interface RunSummary {
  id: string;
  pipeline_id: string;
  status: 'completed' | 'running' | 'failed';
  started_at: string;
  completed_at?: string;
  total_duration_ms?: number;
  hfl_decision?: { status: string; urgency?: string };
  scorecard?: {
    id: string;
    ad_spend: number;
    billing: { total_fee: number; recovery_fee: number; lift_fee: number };
    status: 'pending' | 'accepted' | 'rejected';
  };
}

function statusIcon(status: string) {
  if (status === 'completed') return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
  if (status === 'running') return <Loader2 className="h-4 w-4 animate-spin text-[#00F5FF]" />;
  if (status === 'failed') return <XCircle className="h-4 w-4 text-red-400" />;
  return <AlertTriangle className="h-4 w-4 text-amber-400" />;
}

function RunRow({ run }: { run: RunSummary }) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  const duration = run.total_duration_ms
    ? `${(run.total_duration_ms / 1000).toFixed(1)}s`
    : '--';

  const hfl = run.hfl_decision?.status ?? 'N/A';
  const hflColor =
    hfl === 'auto_approved' || hfl === 'human_approved'
      ? 'text-emerald-300 bg-emerald-500/20'
      : hfl === 'human_rejected'
      ? 'text-red-300 bg-red-500/20'
      : hfl === 'escalated'
      ? 'text-amber-300 bg-amber-500/20'
      : 'text-white/50 bg-white/10';

  const billing = run.scorecard?.billing;

  return (
    <div className="border-b border-white/5 last:border-0">
      <div
        className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <button className="shrink-0 text-white/40">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        {statusIcon(run.status)}

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white/90 truncate">{run.pipeline_id}</p>
          <p className="text-xs text-white/50 font-mono">{run.id.slice(0, 16)}...</p>
        </div>

        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold', hflColor)}>
          {hfl.replace(/_/g, ' ')}
        </span>

        {billing && (
          <div className="shrink-0 text-right">
            <p className="text-sm font-semibold text-white/90">${billing.total_fee.toLocaleString()}</p>
            <p className="text-[10px] text-white/40">total fee</p>
          </div>
        )}

        <div className="shrink-0 text-right">
          <p className="text-xs text-white/70">{duration}</p>
          <p className="text-[10px] text-white/40">
            {new Date(run.started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </p>
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); navigate('/app/assistant'); }}
          className="shrink-0 rounded-lg border border-white/10 p-1.5 text-white/40 transition-colors hover:border-white/20 hover:text-white/70"
          title="Open in Assistant"
        >
          <Bot className="h-3.5 w-3.5" />
        </button>
      </div>

      {expanded && (
        <div className="border-t border-white/5 bg-white/5 px-8 py-4">
          <div className="grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
            <div>
              <p className="text-white/40 font-medium uppercase tracking-wider text-[10px]">Status</p>
              <p className="mt-1 font-semibold text-white/70">{run.status}</p>
            </div>
            <div>
              <p className="text-white/40 font-medium uppercase tracking-wider text-[10px]">Started</p>
              <p className="mt-1 font-semibold text-white/70">{new Date(run.started_at).toLocaleString()}</p>
            </div>
            {run.scorecard && (
              <>
                <div>
                  <p className="text-white/40 font-medium uppercase tracking-wider text-[10px]">Ad Spend</p>
                  <p className="mt-1 font-semibold text-white/70">${run.scorecard.ad_spend.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-white/40 font-medium uppercase tracking-wider text-[10px]">Recovery Fee</p>
                  <p className="mt-1 font-semibold text-emerald-400">${billing?.recovery_fee.toLocaleString()}</p>
                </div>
              </>
            )}
          </div>

          {run.scorecard && (
            <div className="mt-3 flex gap-2">
              <GlassButton variant="outline" size="sm" onClick={() => navigate('/app/scorecard')}>
                <FileText className="h-3.5 w-3.5 mr-1.5" />
                View Scorecard
              </GlassButton>
              <GlassButton variant="outline" size="sm" onClick={() => navigate('/app/assistant')}>
                <Bot className="h-3.5 w-3.5 mr-1.5" />
                Open in Assistant
              </GlassButton>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function HistoryPage() {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchRuns = useCallback(
    async (p = 1, append = false) => {
      try {
        const params = new URLSearchParams({ page: String(p), limit: '20' });
        if (statusFilter) params.set('status', statusFilter);

        const res = await fetch(`${API_URL}/v1/mesh/runs?${params}`, { headers: authHeaders() });
        if (!res.ok) return;

        const data = (await res.json()) as { runs: RunSummary[]; total: number };
        const items = data.runs ?? [];
        setRuns((prev) => (append ? [...prev, ...items] : items));
        setHasMore(p * 20 < (data.total ?? 0));
        setPage(p);
      } catch {
        // silently fail
      }
    },
    [statusFilter],
  );

  useEffect(() => {
    setLoading(true);
    void fetchRuns(1).finally(() => setLoading(false));
  }, [fetchRuns]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchRuns(1);
    setRefreshing(false);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Pipeline History</h2>
          <p className="text-sm text-white/50">All runs, scorecards and billing records</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/70 focus:outline-none focus:ring-1 focus:ring-[#00F5FF]/30"
          >
            <option value="" className="bg-[#0A0A0F]">All statuses</option>
            <option value="completed" className="bg-[#0A0A0F]">Completed</option>
            <option value="running" className="bg-[#0A0A0F]">Running</option>
            <option value="failed" className="bg-[#0A0A0F]">Failed</option>
          </select>
          <GlassButton variant="outline" size="sm" onClick={() => void handleRefresh()} disabled={refreshing}>
            <RefreshCw className={cn('h-4 w-4 mr-1.5', refreshing && 'animate-spin')} />
            Refresh
          </GlassButton>
        </div>
      </div>

      {/* Table */}
      <GlassCard>
        <GlassCardContent className="p-0">
          {/* Column headers */}
          <div className="grid grid-cols-[2rem_2rem_1fr_auto_auto_auto_2rem] items-center gap-3 border-b border-white/10 bg-white/5 px-4 py-2 text-[10px] font-semibold uppercase tracking-widest text-white/40">
            <span />
            <span />
            <span>Run</span>
            <span>HFL</span>
            <span className="text-right">Fee</span>
            <span className="text-right">Date</span>
            <span />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-white/30" />
            </div>
          ) : runs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Clock className="mb-3 h-10 w-10 text-white/20" />
              <p className="text-sm font-medium text-white/40">No pipeline runs yet</p>
              <p className="mt-1 text-xs text-white/30">Go to Command Center to trigger your first run.</p>
            </div>
          ) : (
            runs.map((run) => <RunRow key={run.id} run={run} />)
          )}
        </GlassCardContent>
      </GlassCard>

      {/* Pagination */}
      {hasMore && !loading && (
        <div className="flex justify-center">
          <GlassButton variant="outline" onClick={() => void fetchRuns(page + 1, true)}>
            Load more
          </GlassButton>
        </div>
      )}
    </div>
  );
}
