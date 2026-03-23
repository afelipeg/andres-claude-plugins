// ─── Super Admin Dashboard ─────────────────────────────────────────
// 9-tab dashboard for super_admin (dedalo@polanyi.tech).
// Overview · Agencies · Users · Pipeline Runs · Token & Cost · Connectors · Federation · Quotas · Pipeline Health

import { useState, useEffect, useCallback } from 'react';
import Highcharts from 'highcharts';
import HighchartsReact from 'highcharts-react-official';
import {
  Building2,
  Users,
  Zap,
  DollarSign,
  Plug,
  Globe,
  Activity,
  AlertTriangle,
  UserX,
  UserCheck,
  Trash2,
  Eye,
  RefreshCw,
  Gauge,
  HeartPulse,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  Clock,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import {
  getOverview,
  getAgencies,
  getUsers,
  getRuns,
  getTokens,
  getConnectors,
  getFederation,
  deactivateUser,
  reactivateUser,
  deleteAgency,
  impersonateAgency,
  getQuotaRequests as getAdminQuotaRequests,
  approveQuotaRequest,
  denyQuotaRequest,
  getPipelineHealth,
  type AdminOverview,
  type AgencySummary,
  type AdminUser,
  type AdminRun,
  type TokenData,
  type AdminConnector,
  type FederationData,
  type AdminQuotaRequest,
  type PipelineHealthCheck,
} from '../api/admin';

// ─── Helpers ─────────────────────────────────────────────────────────

function fmtUsd(n: number): string {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtNum(n: number): string {
  return n.toLocaleString('en-US');
}

function fmtDate(s: string | null): string {
  if (!s) return '\u2014';
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/** Human-readable time-ago */
function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Never';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  if (diffMs < 0) return 'Just now';
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

/** Whether a connector is stale */
function isConnectorStale(status: string, updatedAt: string | null): boolean {
  if (status === 'stale' || status === 'expired' || status === 'error') return true;
  if (status === 'connected' && updatedAt) {
    return (Date.now() - new Date(updatedAt).getTime()) > 86_400_000; // 24h
  }
  return false;
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  agency_admin: 'Admin',
  account_manager: 'Manager',
  viewer: 'Viewer',
  admin: 'Admin',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-500/100/20 text-emerald-300',
  invited: 'bg-[#00F5FF]/20 text-[#00F5FF]',
  deactivated: 'bg-red-100 text-red-400',
  completed: 'bg-emerald-500/100/20 text-emerald-300',
  running: 'bg-[#00F5FF]/20 text-[#00F5FF]',
  failed: 'bg-red-100 text-red-400',
  success: 'bg-emerald-500/100/20 text-emerald-300',
  timeout: 'bg-amber-500/100/20 text-amber-300',
  connected: 'bg-emerald-500/100/20 text-emerald-300',
  stale: 'bg-amber-500/100/20 text-amber-300',
  expired: 'bg-amber-500/100/20 text-amber-300',
  error: 'bg-red-500/20 text-red-300',
  disconnected: 'bg-white/10 text-white/50',
};

// ─── Tab definitions ─────────────────────────────────────────────────

const TABS = [
  { id: 'overview', label: 'Overview', Icon: Activity },
  { id: 'agencies', label: 'Agencies', Icon: Building2 },
  { id: 'users', label: 'Users', Icon: Users },
  { id: 'runs', label: 'Pipeline Runs', Icon: Zap },
  { id: 'tokens', label: 'Token & Cost', Icon: DollarSign },
  { id: 'connectors', label: 'Connectors', Icon: Plug },
  { id: 'federation', label: 'Federation', Icon: Globe },
  { id: 'quotas', label: 'Quotas', Icon: Gauge },
  { id: 'pipeline', label: 'Pipeline', Icon: HeartPulse },
] as const;

type TabId = (typeof TABS)[number]['id'];

// ─── Stat Card ───────────────────────────────────────────────────────

function StatCard({ label, value, sub, Icon, color }: {
  label: string;
  value: string | number;
  sub?: string;
  Icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 shadow-sm shadow-black/20">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-white/50">{label}</p>
          <p className="mt-2 text-2xl font-bold text-white/95">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-white/40">{sub}</p>}
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

// ─── Overview Tab ────────────────────────────────────────────────────

function OverviewTab({ data }: { data: AdminOverview | null }) {
  if (!data) return <LoadingState />;
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard label="Agencies" value={fmtNum(data.total_agencies)} Icon={Building2} color="bg-[#00F5FF]/20 text-[#00F5FF]" />
      <StatCard label="Users" value={fmtNum(data.total_users)} sub={`${data.active_users} active`} Icon={Users} color="bg-violet-500/20 text-violet-300" />
      <StatCard label="Runs Today" value={fmtNum(data.runs_today)} Icon={Zap} color="bg-emerald-500/100/20 text-emerald-300" />
      <StatCard label="Runs MTD" value={fmtNum(data.runs_mtd)} Icon={Activity} color="bg-cyan-500/20 text-cyan-300" />
      <StatCard label="LLM Cost MTD" value={fmtUsd(data.llm_cost_mtd)} Icon={DollarSign} color="bg-amber-500/100/20 text-amber-300" />
      <StatCard label="Outcome Fees MTD" value={fmtUsd(data.outcome_fees_mtd)} Icon={DollarSign} color="bg-emerald-500/100/20 text-emerald-300" />
      <StatCard label="A2A Calls MTD" value={fmtNum(data.a2a_calls_mtd)} Icon={Globe} color="bg-indigo-500/20 text-indigo-300" />
      <StatCard label="Stale Connectors" value={data.stale_connectors} sub={`of ${data.total_connectors}`} Icon={AlertTriangle} color={data.stale_connectors > 0 ? 'bg-red-100 text-red-400' : 'bg-white/10 text-white/50'} />
    </div>
  );
}

// ─── Agencies Tab ────────────────────────────────────────────────────

function AgenciesTab({ agencies, onImpersonate, onDelete }: {
  agencies: AgencySummary[];
  onImpersonate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  if (!agencies.length) return <EmptyState msg="No agencies found" />;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Agency ID</TableHead>
          <TableHead>Connections</TableHead>
          <TableHead>Advertisers</TableHead>
          <TableHead>Users</TableHead>
          <TableHead>Runs</TableHead>
          <TableHead>Last Activity</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {agencies.map((a) => (
          <TableRow key={a.agency_id}>
            <TableCell className="font-medium">{a.agency_id}</TableCell>
            <TableCell>{a.connection_count}</TableCell>
            <TableCell>{a.advertiser_count}</TableCell>
            <TableCell>{a.user_count}</TableCell>
            <TableCell>{a.run_count}</TableCell>
            <TableCell className="text-xs text-white/50">{fmtDate(a.last_activity)}</TableCell>
            <TableCell>
              <div className="flex gap-1">
                <button onClick={() => onImpersonate(a.agency_id)} className="rounded p-1 text-white/40 hover:bg-[#00F5FF]/10 hover:text-[#00F5FF]" title="Impersonate">
                  <Eye className="h-4 w-4" />
                </button>
                <button onClick={() => onDelete(a.agency_id)} className="rounded p-1 text-white/40 hover:bg-red-500/100/10 hover:text-red-400" title="Delete">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ─── Users Tab ───────────────────────────────────────────────────────

function UsersTab({ users, onDeactivate, onReactivate }: {
  users: AdminUser[];
  onDeactivate: (id: string) => void;
  onReactivate: (id: string) => void;
}) {
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const filtered = users.filter((u) => {
    if (roleFilter && u.role !== roleFilter) return false;
    if (statusFilter && u.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="rounded-lg border border-white/10 px-3 py-1.5 text-sm">
          <option value="">All roles</option>
          <option value="super_admin">Super Admin</option>
          <option value="agency_admin">Admin</option>
          <option value="account_manager">Manager</option>
          <option value="viewer">Viewer</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-white/10 px-3 py-1.5 text-sm">
          <option value="">All status</option>
          <option value="active">Active</option>
          <option value="invited">Invited</option>
          <option value="deactivated">Deactivated</option>
        </select>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last Login</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((u) => (
            <TableRow key={u.id}>
              <TableCell className="font-medium">{u.email.split('@')[0]}</TableCell>
              <TableCell className="text-xs">{u.email}</TableCell>
              <TableCell><Badge variant="outline" className="text-xs">{ROLE_LABELS[u.role] ?? u.role}</Badge></TableCell>
              <TableCell><span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[u.status] ?? 'bg-white/10 text-white/60'}`}>{u.status}</span></TableCell>
              <TableCell className="text-xs text-white/50">{fmtDate(u.last_login)}</TableCell>
              <TableCell className="text-xs text-white/50">{fmtDate(u.created_at)}</TableCell>
              <TableCell>
                {u.status === 'active' ? (
                  <button onClick={() => onDeactivate(u.id)} className="rounded p-1 text-white/40 hover:bg-red-500/100/10 hover:text-red-400" title="Deactivate">
                    <UserX className="h-4 w-4" />
                  </button>
                ) : u.status === 'deactivated' ? (
                  <button onClick={() => onReactivate(u.id)} className="rounded p-1 text-white/40 hover:bg-emerald-500/100/10 hover:text-emerald-300" title="Reactivate">
                    <UserCheck className="h-4 w-4" />
                  </button>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Pipeline Runs Tab ───────────────────────────────────────────────

function RunsTab({ runs }: { runs: AdminRun[] }) {
  const [statusFilter, setStatusFilter] = useState('');
  const filtered = runs.filter((r) => !statusFilter || r.status === statusFilter);

  // Chart: runs by status by day
  const dayMap = new Map<string, { completed: number; failed: number; running: number }>();
  for (const r of runs) {
    const day = r.started_at?.slice(0, 10);
    if (!day) continue;
    const entry = dayMap.get(day) ?? { completed: 0, failed: 0, running: 0 };
    if (r.status === 'completed') entry.completed++;
    else if (r.status === 'failed') entry.failed++;
    else entry.running++;
    dayMap.set(day, entry);
  }
  const days = [...dayMap.entries()].sort(([a], [b]) => a.localeCompare(b));

  const chartOpts: Highcharts.Options = {
    chart: { type: 'column', height: 220 },
    title: { text: undefined },
    xAxis: { categories: days.map(([d]) => d), labels: { style: { fontSize: '10px' } } },
    yAxis: { title: { text: undefined }, allowDecimals: false },
    plotOptions: { column: { stacking: 'normal', borderRadius: 3, borderWidth: 0 } },
    colors: ['#22c55e', '#ef4444', '#3b82f6'],
    series: [
      { name: 'Completed', data: days.map(([, v]) => v.completed), type: 'column' },
      { name: 'Failed', data: days.map(([, v]) => v.failed), type: 'column' },
      { name: 'Running', data: days.map(([, v]) => v.running), type: 'column' },
    ],
    credits: { enabled: false },
    legend: { itemStyle: { fontSize: '11px' } },
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-white/10 px-3 py-1.5 text-sm">
          <option value="">All status</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="running">Running</option>
        </select>
        <span className="text-xs text-white/40">{filtered.length} runs</span>
      </div>

      {days.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <HighchartsReact highcharts={Highcharts} options={chartOpts} />
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Run ID</TableHead>
            <TableHead>Pipeline</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Started</TableHead>
            <TableHead>Duration</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-mono text-xs">{r.id.slice(0, 12)}...</TableCell>
              <TableCell className="text-xs">{r.pipeline_id}</TableCell>
              <TableCell className="text-xs">{r.agency_id ?? '\u2014'}</TableCell>
              <TableCell><span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[r.status] ?? 'bg-white/10 text-white/60'}`}>{r.status}</span></TableCell>
              <TableCell className="text-xs text-white/50">{fmtDate(r.started_at)}</TableCell>
              <TableCell className="text-xs">{fmtDuration(r.duration_ms)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Token & Cost Tab ────────────────────────────────────────────────

function TokensTab({ data }: { data: TokenData | null }) {
  if (!data) return <LoadingState />;

  // Stacked area: daily tokens
  const byDay = (data.by_day ?? []).sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
    String(a['date'] ?? '').localeCompare(String(b['date'] ?? '')),
  );

  const areaOpts: Highcharts.Options = {
    chart: { type: 'area', height: 280 },
    title: { text: 'Daily Token Usage', style: { fontSize: '14px' } },
    xAxis: { categories: byDay.map((d: Record<string, unknown>) => String(d['date'] ?? '').slice(5)), labels: { style: { fontSize: '10px' } } },
    yAxis: { title: { text: 'Tokens' }, labels: { formatter() { return fmtNum(this.value as number); } } },
    plotOptions: { area: { stacking: 'normal', marker: { enabled: false }, fillOpacity: 0.3 } },
    colors: ['#6366f1', '#f59e0b'],
    series: [
      { name: 'Prompt', data: byDay.map((d: Record<string, unknown>) => Number(d['tokens_prompt'] ?? 0)), type: 'area' },
      { name: 'Completion', data: byDay.map((d: Record<string, unknown>) => Number(d['tokens_completion'] ?? 0)), type: 'area' },
    ],
    credits: { enabled: false },
  };

  // Donut: cost by model
  const byModel = data.by_model ?? [];
  const donutOpts: Highcharts.Options = {
    chart: { type: 'pie', height: 280 },
    title: { text: 'Cost by Model', style: { fontSize: '14px' } },
    plotOptions: { pie: { innerSize: '55%', dataLabels: { format: '{point.name}: {point.percentage:.1f}%' } } },
    series: [{ name: 'Cost', data: byModel.map((m) => ({ name: m.model ?? 'unknown', y: Number(m.llm_cost_usd ?? 0) })), type: 'pie' }],
    credits: { enabled: false },
  };

  // Bar: cost by engine
  const byEngine = data.by_engine ?? [];
  const barOpts: Highcharts.Options = {
    chart: { type: 'bar', height: 220 },
    title: { text: 'Cost by Engine', style: { fontSize: '14px' } },
    xAxis: { categories: byEngine.map((e) => e.engine_id), labels: { style: { fontSize: '10px' } } },
    yAxis: { title: { text: 'USD' } },
    colors: ['#02c98d'],
    series: [{ name: 'LLM Cost', data: byEngine.map((e) => Number(e.llm_cost_usd ?? 0)), type: 'bar' }],
    plotOptions: { bar: { borderRadius: 3, borderWidth: 0 } },
    credits: { enabled: false },
  };

  const mtd = data.mtd ?? {};

  return (
    <div className="space-y-6">
      {/* MTD summary */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Tokens (Prompt)" value={fmtNum(Number(mtd['tokens_prompt'] ?? 0))} Icon={Zap} color="bg-indigo-500/20 text-indigo-300" />
        <StatCard label="Tokens (Completion)" value={fmtNum(Number(mtd['tokens_completion'] ?? 0))} Icon={Zap} color="bg-amber-500/100/20 text-amber-300" />
        <StatCard label="LLM Cost MTD" value={fmtUsd(Number(mtd['llm_cost_usd'] ?? 0))} Icon={DollarSign} color="bg-red-100 text-red-400" />
        <StatCard label="Outcome Fees MTD" value={fmtUsd(Number(mtd['outcome_fees_usd'] ?? 0))} Icon={DollarSign} color="bg-emerald-500/100/20 text-emerald-300" />
      </div>

      {/* Charts */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <HighchartsReact highcharts={Highcharts} options={areaOpts} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <HighchartsReact highcharts={Highcharts} options={donutOpts} />
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <HighchartsReact highcharts={Highcharts} options={barOpts} />
        </div>
      </div>

      {/* Engine breakdown table */}
      {byEngine.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Engine</TableHead>
              <TableHead>Prompt Tokens</TableHead>
              <TableHead>Completion Tokens</TableHead>
              <TableHead>LLM Cost</TableHead>
              <TableHead>Skills Invoked</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {byEngine.map((e) => (
              <TableRow key={e.engine_id}>
                <TableCell className="font-medium">{e.engine_id}</TableCell>
                <TableCell>{fmtNum(e.tokens_prompt)}</TableCell>
                <TableCell>{fmtNum(e.tokens_completion)}</TableCell>
                <TableCell>{fmtUsd(Number(e.llm_cost_usd))}</TableCell>
                <TableCell>{fmtNum(e.skills_invoked)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

// ─── Connectors Tab (enhanced with diagnostics) ─────────────────────

function ConnectorsTab({ connectors }: { connectors: AdminConnector[] }) {
  if (!connectors.length) return <EmptyState msg="No connectors configured" />;

  // Status donut
  const statusCounts: Record<string, number> = {};
  const staleCount = connectors.filter((c) => isConnectorStale(c.status, c.updated_at)).length;
  for (const c of connectors) {
    // Compute effective status (connected but >24h = stale)
    const effective = isConnectorStale(c.status, c.updated_at) && c.status === 'connected' ? 'stale' : (c.status ?? 'unknown');
    statusCounts[effective] = (statusCounts[effective] ?? 0) + 1;
  }

  const STATUS_DONUT_COLORS: Record<string, string> = {
    connected: '#22c55e',
    stale: '#f59e0b',
    expired: '#f59e0b',
    error: '#ef4444',
    unknown: '#94a3b8',
    disconnected: '#94a3b8',
  };

  const donutData = Object.entries(statusCounts).map(([name, y]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    y,
    color: STATUS_DONUT_COLORS[name] ?? '#94a3b8',
  }));

  const donutOpts: Highcharts.Options = {
    chart: { type: 'pie', height: 220 },
    title: { text: undefined },
    plotOptions: { pie: { innerSize: '55%', dataLabels: { format: '{point.name}: {point.y}' } } },
    series: [{ name: 'Count', data: donutData, type: 'pie' }],
    credits: { enabled: false },
  };

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 max-w-lg">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
          <p className="text-2xl font-bold text-white/95">{connectors.length}</p>
          <p className="text-[10px] text-white/50 uppercase tracking-wider mt-1">Total</p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
          <p className="text-2xl font-bold text-emerald-300">{connectors.filter((c) => c.status === 'connected' && !isConnectorStale(c.status, c.updated_at)).length}</p>
          <p className="text-[10px] text-emerald-400/70 uppercase tracking-wider mt-1">Healthy</p>
        </div>
        <div className={`rounded-xl border p-4 text-center ${staleCount > 0 ? 'border-amber-500/20 bg-amber-500/5' : 'border-white/10 bg-white/5'}`}>
          <p className={`text-2xl font-bold ${staleCount > 0 ? 'text-amber-300' : 'text-white/50'}`}>{staleCount}</p>
          <p className={`text-[10px] uppercase tracking-wider mt-1 ${staleCount > 0 ? 'text-amber-400/70' : 'text-white/40'}`}>Stale / Error</p>
        </div>
      </div>

      <div className="max-w-xs rounded-xl border border-white/10 bg-white/5 p-4">
        <HighchartsReact highcharts={Highcharts} options={donutOpts} />
      </div>

      {/* Stale connectors warning */}
      {staleCount > 0 && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-medium text-amber-300">
              {staleCount} connector{staleCount !== 1 ? 's' : ''} need{staleCount === 1 ? 's' : ''} attention
            </p>
            <p className="text-[10px] text-white/40 mt-0.5">
              Connectors marked as stale have not been updated in over 24 hours, have expired credentials, or returned API errors. Affected agencies should re-sync or reconnect.
            </p>
          </div>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Agency</TableHead>
            <TableHead>Platform</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Advertisers</TableHead>
            <TableHead>Connected</TableHead>
            <TableHead>Last Updated</TableHead>
            <TableHead>Freshness</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {connectors.map((c) => {
            const stale = isConnectorStale(c.status, c.updated_at);
            const effectiveStatus = stale && c.status === 'connected' ? 'stale' : c.status;
            return (
              <TableRow key={c.id} className={stale ? 'bg-amber-500/5' : ''}>
                <TableCell className="text-xs">{c.agency_id}</TableCell>
                <TableCell className="font-medium">{c.platform}</TableCell>
                <TableCell className="text-xs">{c.connection_type}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[effectiveStatus] ?? 'bg-white/10 text-white/60'}`}>
                    {stale && <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />}
                    {effectiveStatus}
                  </span>
                </TableCell>
                <TableCell>{c.advertiser_count}</TableCell>
                <TableCell className="text-xs text-white/50">{fmtDate(c.connected_at)}</TableCell>
                <TableCell className="text-xs text-white/50">{fmtDate(c.updated_at)}</TableCell>
                <TableCell>
                  <span className={`text-[10px] font-medium ${stale ? 'text-amber-300' : 'text-emerald-300'}`}>
                    {timeAgo(c.updated_at)}
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Federation Tab ──────────────────────────────────────────────────

function FederationTab({ data }: { data: FederationData | null }) {
  if (!data) return <LoadingState />;

  const { peers, count_by_day, discovered, log } = data;

  // Timeline chart
  const sortedDays = [...(count_by_day ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  const timelineOpts: Highcharts.Options = {
    chart: { type: 'column', height: 200 },
    title: { text: undefined },
    xAxis: { categories: sortedDays.map((d) => d.date.slice(5)), labels: { style: { fontSize: '10px' } } },
    yAxis: { title: { text: undefined }, allowDecimals: false },
    plotOptions: { column: { stacking: 'normal', borderRadius: 2, borderWidth: 0 } },
    colors: ['#6366f1', '#f59e0b'],
    series: [
      { name: 'Inbound', data: sortedDays.map((d) => d.inbound), type: 'column' },
      { name: 'Outbound', data: sortedDays.map((d) => d.outbound), type: 'column' },
    ],
    credits: { enabled: false },
  };

  return (
    <div className="space-y-6">
      {/* Discovered agents */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-white/70">Discovered Agents ({discovered?.length ?? 0})</h3>
        {discovered?.length ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {discovered.map((agent, i) => (
              <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="font-medium text-sm">{String(agent['name'] ?? agent['url'] ?? 'Unknown')}</p>
                <p className="text-xs text-white/50 mt-1">{String(agent['url'] ?? '')}</p>
                {Array.isArray(agent['capabilities']) && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(agent['capabilities'] as string[]).slice(0, 5).map((cap) => (
                      <Badge key={cap} variant="outline" className="text-[10px]">{cap}</Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-white/40">No agents discovered yet. Use Federation to discover remote agents.</p>
        )}
      </div>

      {/* A2A timeline */}
      {sortedDays.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h3 className="mb-2 text-sm font-semibold text-white/70">A2A Calls (30 days)</h3>
          <HighchartsReact highcharts={Highcharts} options={timelineOpts} />
        </div>
      )}

      {/* Peer summary */}
      {peers?.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-white/70">Peer Summary</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Peer</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Total Calls</TableHead>
                <TableHead>Success</TableHead>
                <TableHead>Failed</TableHead>
                <TableHead>Last Call</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {peers.map((p, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-xs">{String(p['peer_url'] ?? '')}</TableCell>
                  <TableCell>{String(p['peer_name'] ?? '\u2014')}</TableCell>
                  <TableCell>{String(p['total'] ?? 0)}</TableCell>
                  <TableCell className="text-emerald-300">{String(p['success'] ?? 0)}</TableCell>
                  <TableCell className="text-red-400">{String(p['failed'] ?? 0)}</TableCell>
                  <TableCell className="text-xs text-white/50">{fmtDate(String(p['last_call'] ?? ''))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Recent log */}
      {log?.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-white/70">Recent Interactions</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Direction</TableHead>
                <TableHead>Peer</TableHead>
                <TableHead>Engine</TableHead>
                <TableHead>Skill</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {log.slice(0, 20).map((entry, i) => (
                <TableRow key={i}>
                  <TableCell><Badge variant="outline" className="text-[10px]">{String(entry['direction'])}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{String(entry['peer_url'] ?? '').slice(0, 30)}</TableCell>
                  <TableCell className="text-xs">{String(entry['engine_id'] ?? '\u2014')}</TableCell>
                  <TableCell className="text-xs">{String(entry['skill_id'] ?? '\u2014')}</TableCell>
                  <TableCell><span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[String(entry['status'])] ?? 'bg-white/10 text-white/60'}`}>{String(entry['status'])}</span></TableCell>
                  <TableCell className="text-xs">{entry['duration_ms'] ? fmtDuration(Number(entry['duration_ms'])) : '\u2014'}</TableCell>
                  <TableCell className="text-xs text-white/50">{fmtDate(String(entry['created_at'] ?? ''))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ─── Shared UI components ────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-20">
      <RefreshCw className="h-6 w-6 animate-spin text-white/40" />
    </div>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div className="flex items-center justify-center py-20">
      <p className="text-sm text-white/40">{msg}</p>
    </div>
  );
}

// ─── Quotas Tab ──────────────────────────────────────────────────────

function QuotasTab({ requests, onRefresh }: { requests: AdminQuotaRequest[]; onRefresh: () => void }) {
  const [grantInput, setGrantInput] = useState<Record<string, number>>({});

  const handleApprove = async (id: string) => {
    const amount = grantInput[id] ?? (requests.find((r) => r.id === id)?.requested_brand_count ?? 8);
    await approveQuotaRequest(id, amount);
    onRefresh();
  };

  const handleDeny = async (id: string) => {
    await denyQuotaRequest(id, 'Denied by admin');
    onRefresh();
  };

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-semibold text-white/70">Pending Quota Requests ({requests.length})</h3>
      {requests.length === 0 ? (
        <p className="text-sm text-white/40 py-8 text-center">No pending requests</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agency</TableHead>
              <TableHead>Current</TableHead>
              <TableHead>Requested</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Grant</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.agency_id}</TableCell>
                <TableCell className="text-xs">{r.current_brand_count}</TableCell>
                <TableCell>{r.requested_brand_count}</TableCell>
                <TableCell className="text-xs text-white/50 max-w-48 truncate">{r.reason ?? '\u2014'}</TableCell>
                <TableCell>
                  <input
                    type="number"
                    min={1}
                    value={grantInput[r.id] ?? r.requested_brand_count}
                    onChange={(e) => setGrantInput({ ...grantInput, [r.id]: Number(e.target.value) })}
                    className="w-16 rounded border border-white/10 px-2 py-1 text-sm text-center"
                  />
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <button onClick={() => void handleApprove(r.id)} className="rounded bg-emerald-500/80 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-500/80">Approve</button>
                    <button onClick={() => void handleDeny(r.id)} className="rounded bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-400 hover:bg-red-200">Deny</button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

// ─── Pipeline Health Tab ─────────────────────────────────────────────

function StageStatusIcon({ status }: { status: 'pass' | 'warn' | 'fail' }) {
  if (status === 'pass') return <CheckCircle2 className="h-5 w-5 text-emerald-400" />;
  if (status === 'warn') return <AlertTriangle className="h-5 w-5 text-amber-400" />;
  return <XCircle className="h-5 w-5 text-red-400" />;
}

function stageColorClasses(status: 'pass' | 'warn' | 'fail') {
  if (status === 'pass') return 'bg-emerald-500/10 border-emerald-500/30';
  if (status === 'warn') return 'bg-amber-500/10 border-amber-500/30';
  return 'bg-red-500/10 border-red-500/30';
}

function overallStatusBadge(status: 'healthy' | 'degraded' | 'critical') {
  if (status === 'healthy') return { text: 'Healthy', classes: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
  if (status === 'degraded') return { text: 'Degraded', classes: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
  return { text: 'Critical', classes: 'bg-red-500/20 text-red-300 border-red-500/30' };
}

function PipelineHealthTab({ data, onRefresh, refreshing }: {
  data: PipelineHealthCheck | null;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const [expandedStages, setExpandedStages] = useState<Set<string>>(new Set());

  const toggleStage = (name: string) => {
    setExpandedStages((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  if (!data) return <LoadingState />;

  const badge = overallStatusBadge(data.status);
  const allPass = data.stages.every((s) => s.status === 'pass');

  return (
    <div className="space-y-6">
      {/* Summary Banner */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${badge.classes}`}>
              {data.status === 'healthy' && <CheckCircle2 className="h-4 w-4" />}
              {data.status === 'degraded' && <AlertTriangle className="h-4 w-4" />}
              {data.status === 'critical' && <XCircle className="h-4 w-4" />}
              {badge.text}
            </div>
            <div className="flex items-center gap-4 text-xs text-white/50">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                {data.summary.passed} passed
              </span>
              <span className="flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                {data.summary.warnings} warnings
              </span>
              <span className="flex items-center gap-1">
                <XCircle className="h-3.5 w-3.5 text-red-400" />
                {data.summary.failures} failures
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-xs text-white/40">
              <Clock className="h-3.5 w-3.5" />
              {fmtDate(data.timestamp)}
            </span>
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 rounded-lg border border-[#00F5FF]/30 bg-[#00F5FF]/10 px-3 py-1.5 text-sm font-medium text-[#00F5FF] hover:bg-[#00F5FF]/20 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Run Health Check
            </button>
          </div>
        </div>
      </div>

      {/* Pipeline Stages Visualization - horizontal flow */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-6">
        <h3 className="mb-5 text-sm font-semibold text-white/70">Pipeline Stages</h3>
        <div className="flex items-center gap-0 overflow-x-auto pb-2">
          {data.stages.map((stage, idx) => (
            <div key={stage.name} className="flex items-center shrink-0">
              {/* Stage node */}
              <button
                onClick={() => toggleStage(stage.name)}
                className={`relative flex flex-col items-center justify-center rounded-xl border px-4 py-4 w-[140px] transition-all hover:scale-[1.03] cursor-pointer ${stageColorClasses(stage.status)}`}
              >
                <StageStatusIcon status={stage.status} />
                <span className="mt-2 text-xs font-semibold text-white/90 text-center leading-tight">{stage.name}</span>
                <span className="mt-1 text-[10px] text-white/40 font-mono">{fmtDuration(stage.duration_ms)}</span>
                <span className="mt-1.5 text-[10px] text-white/30">
                  {stage.checks.length} check{stage.checks.length !== 1 ? 's' : ''}
                </span>
                {/* Expand indicator */}
                <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2">
                  {expandedStages.has(stage.name) ? (
                    <ChevronDown className="h-3 w-3 text-white/40" />
                  ) : (
                    <ChevronRight className="h-3 w-3 text-white/30" />
                  )}
                </div>
              </button>

              {/* Connecting line */}
              {idx < data.stages.length - 1 && (
                <div className={`h-px w-8 shrink-0 ${allPass ? 'bg-emerald-500/40' : 'bg-white/20'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Expanded stage details */}
      {data.stages.map((stage) => {
        if (!expandedStages.has(stage.name)) return null;
        return (
          <StageDetail key={stage.name} stage={stage} />
        );
      })}
    </div>
  );
}

function StageDetail({ stage }: {
  stage: PipelineHealthCheck['stages'][number];
}) {
  const [expandedChecks, setExpandedChecks] = useState<Set<string>>(new Set());

  const toggleCheck = (name: string) => {
    setExpandedChecks((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  return (
    <div className={`rounded-xl border p-4 ${stageColorClasses(stage.status)}`}>
      <div className="flex items-center gap-2 mb-3">
        <StageStatusIcon status={stage.status} />
        <h4 className="text-sm font-semibold text-white/90">{stage.name}</h4>
        <span className="text-[10px] text-white/40 font-mono ml-auto">{fmtDuration(stage.duration_ms)}</span>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8"></TableHead>
            <TableHead>Check</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Message</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stage.checks.map((check) => {
            const hasDetails = check.details !== undefined && check.details !== null;
            const isExpanded = expandedChecks.has(check.name);
            return (
              <>
                <TableRow
                  key={check.name}
                  className={hasDetails ? 'cursor-pointer hover:bg-white/5' : ''}
                  onClick={() => hasDetails && toggleCheck(check.name)}
                >
                  <TableCell className="w-8 px-2">
                    {hasDetails && (
                      isExpanded
                        ? <ChevronDown className="h-3.5 w-3.5 text-white/40" />
                        : <ChevronRight className="h-3.5 w-3.5 text-white/30" />
                    )}
                  </TableCell>
                  <TableCell className="font-medium text-xs">{check.name}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      check.status === 'pass'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : check.status === 'warn'
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-red-500/20 text-red-300'
                    }`}>
                      {check.status === 'pass' && <CheckCircle2 className="h-3 w-3" />}
                      {check.status === 'warn' && <AlertTriangle className="h-3 w-3" />}
                      {check.status === 'fail' && <XCircle className="h-3 w-3" />}
                      {check.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-white/60">{check.message}</TableCell>
                </TableRow>
                {hasDetails && isExpanded && (
                  <TableRow key={`${check.name}-details`}>
                    <TableCell colSpan={4} className="px-4 py-3">
                      <pre className="rounded-lg bg-black/40 border border-white/5 p-3 text-[11px] text-white/60 overflow-x-auto max-h-60 font-mono">
                        {JSON.stringify(check.details, null, 2)}
                      </pre>
                    </TableCell>
                  </TableRow>
                )}
              </>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Impersonate Banner ──────────────────────────────────────────────

function ImpersonateBanner({ agencyId, onExit }: { agencyId: string; onExit: () => void }) {
  return (
    <div className="flex items-center justify-between bg-red-500/80 px-4 py-2 text-white text-sm">
      <span>Viewing as <strong>{agencyId}</strong> -- impersonation mode</span>
      <button onClick={onExit} className="rounded bg-white/20 px-3 py-1 text-xs font-semibold hover:bg-white/30 transition-colors">
        Exit impersonation
      </button>
    </div>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────

export function SuperAdminDashboard() {
  const [tab, setTab] = useState<TabId>('overview');
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [agencies, setAgencies] = useState<AgencySummary[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [runs, setRuns] = useState<AdminRun[]>([]);
  const [tokens, setTokens] = useState<TokenData | null>(null);
  const [connectors, setConnectors] = useState<AdminConnector[]>([]);
  const [quotaRequests, setQuotaRequests] = useState<AdminQuotaRequest[]>([]);
  const [pendingQuotaCount, setPendingQuotaCount] = useState(0);
  const [federation, setFederation] = useState<FederationData | null>(null);
  const [pipelineHealth, setPipelineHealth] = useState<PipelineHealthCheck | null>(null);
  const [impersonating, setImpersonating] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Check if already impersonating
  useEffect(() => {
    const adminToken = sessionStorage.getItem('plinth_admin_token');
    if (adminToken) {
      // We're impersonating -- show the agency id from storage
      setImpersonating(sessionStorage.getItem('plinth_impersonate_agency') ?? 'unknown');
    }
  }, []);

  // Load data for current tab
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      switch (tab) {
        case 'overview': {
          const data = await getOverview();
          setOverview(data);
          break;
        }
        case 'agencies': {
          const data = await getAgencies();
          setAgencies(data.agencies);
          break;
        }
        case 'users': {
          const data = await getUsers();
          setUsers(data.users as AdminUser[]);
          break;
        }
        case 'runs': {
          const data = await getRuns(100);
          setRuns(data.runs);
          break;
        }
        case 'tokens': {
          const data = await getTokens(30);
          setTokens(data);
          break;
        }
        case 'connectors': {
          const data = await getConnectors();
          setConnectors(data.connectors);
          break;
        }
        case 'federation': {
          const data = await getFederation();
          setFederation(data);
          break;
        }
        case 'quotas': {
          const data = await getAdminQuotaRequests();
          setQuotaRequests(data.requests);
          setPendingQuotaCount(data.requests.filter((r) => r.status === 'pending').length);
          break;
        }
        case 'pipeline': {
          const data = await getPipelineHealth();
          setPipelineHealth(data);
          break;
        }
      }
    } catch (err) {
      console.error('[admin] Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleImpersonate = async (agencyId: string) => {
    if (!confirm(`Impersonate agency "${agencyId}"? You'll get a 15-minute scoped token.`)) return;
    try {
      const result = await impersonateAgency(agencyId);
      // Store current admin token
      const currentToken = localStorage.getItem('plinth_token');
      if (currentToken) sessionStorage.setItem('plinth_admin_token', currentToken);
      sessionStorage.setItem('plinth_impersonate_agency', agencyId);
      // Switch to impersonate token
      localStorage.setItem('plinth_token', result.token);
      setImpersonating(agencyId);
      // Navigate to app home
      window.location.href = '/app';
    } catch (err) {
      alert('Impersonation failed: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleExitImpersonate = () => {
    const adminToken = sessionStorage.getItem('plinth_admin_token');
    if (adminToken) {
      localStorage.setItem('plinth_token', adminToken);
      sessionStorage.removeItem('plinth_admin_token');
      sessionStorage.removeItem('plinth_impersonate_agency');
      setImpersonating(null);
      window.location.href = '/app/admin';
    }
  };

  const handleDeactivateUser = async (id: string) => {
    if (!confirm('Deactivate this user?')) return;
    await deactivateUser(id);
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, status: 'deactivated' } : u));
  };

  const handleReactivateUser = async (id: string) => {
    await reactivateUser(id);
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, status: 'active' } : u));
  };

  const handleDeleteAgency = async (id: string) => {
    if (!confirm(`Delete agency "${id}" and all its connections? This cannot be undone.`)) return;
    await deleteAgency(id);
    setAgencies((prev) => prev.filter((a) => a.agency_id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Impersonate banner */}
      {impersonating && <ImpersonateBanner agencyId={impersonating} onExit={handleExitImpersonate} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white/95">Super Admin</h2>
          <p className="text-sm text-white/50">System-wide visibility and control</p>
        </div>
        <button onClick={() => void loadData()} className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/60 hover:bg-white/5 transition-colors">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
              tab === t.id
                ? 'border-[#02c98d] text-[#02c98d]'
                : 'border-transparent text-white/50 hover:text-white/70 hover:border-white/15'
            }`}
          >
            <t.Icon className="h-4 w-4" />
            {t.label}
            {t.id === 'quotas' && pendingQuotaCount > 0 && (
              <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500/100 px-1.5 text-[10px] font-bold text-white">
                {pendingQuotaCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {tab === 'overview' && <OverviewTab data={overview} />}
        {tab === 'agencies' && <AgenciesTab agencies={agencies} onImpersonate={handleImpersonate} onDelete={handleDeleteAgency} />}
        {tab === 'users' && <UsersTab users={users} onDeactivate={handleDeactivateUser} onReactivate={handleReactivateUser} />}
        {tab === 'runs' && (loading ? <LoadingState /> : <RunsTab runs={runs} />)}
        {tab === 'tokens' && <TokensTab data={tokens} />}
        {tab === 'connectors' && (loading ? <LoadingState /> : <ConnectorsTab connectors={connectors} />)}
        {tab === 'federation' && <FederationTab data={federation} />}
        {tab === 'quotas' && <QuotasTab requests={quotaRequests} onRefresh={() => void loadData()} />}
        {tab === 'pipeline' && <PipelineHealthTab data={pipelineHealth} onRefresh={() => void loadData()} refreshing={loading} />}
      </div>
    </div>
  );
}
