// ─── Super Admin Dashboard ─────────────────────────────────────────
// 7-tab dashboard for super_admin (dedalo@polanyi.tech).
// Overview · Agencies · Users · Pipeline Runs · Token & Cost · Connectors · Federation

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
  type AdminOverview,
  type AgencySummary,
  type AdminUser,
  type AdminRun,
  type TokenData,
  type AdminConnector,
  type FederationData,
  type AdminQuotaRequest,
} from '../api/admin';

// ─── Helpers ─────────────────────────────────────────────────────────

function fmtUsd(n: number): string {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtNum(n: number): string {
  return n.toLocaleString('en-US');
}

function fmtDate(s: string | null): string {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  agency_admin: 'Admin',
  account_manager: 'Manager',
  viewer: 'Viewer',
  admin: 'Admin',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  invited: 'bg-blue-100 text-blue-700',
  deactivated: 'bg-red-100 text-red-700',
  completed: 'bg-emerald-100 text-emerald-700',
  running: 'bg-blue-100 text-blue-700',
  failed: 'bg-red-100 text-red-700',
  success: 'bg-emerald-100 text-emerald-700',
  timeout: 'bg-amber-100 text-amber-700',
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
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-zinc-900">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
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
      <StatCard label="Agencies" value={fmtNum(data.total_agencies)} Icon={Building2} color="bg-blue-100 text-blue-600" />
      <StatCard label="Users" value={fmtNum(data.total_users)} sub={`${data.active_users} active`} Icon={Users} color="bg-violet-100 text-violet-600" />
      <StatCard label="Runs Today" value={fmtNum(data.runs_today)} Icon={Zap} color="bg-emerald-100 text-emerald-600" />
      <StatCard label="Runs MTD" value={fmtNum(data.runs_mtd)} Icon={Activity} color="bg-cyan-100 text-cyan-600" />
      <StatCard label="LLM Cost MTD" value={fmtUsd(data.llm_cost_mtd)} Icon={DollarSign} color="bg-amber-100 text-amber-600" />
      <StatCard label="Outcome Fees MTD" value={fmtUsd(data.outcome_fees_mtd)} Icon={DollarSign} color="bg-emerald-100 text-emerald-600" />
      <StatCard label="A2A Calls MTD" value={fmtNum(data.a2a_calls_mtd)} Icon={Globe} color="bg-indigo-100 text-indigo-600" />
      <StatCard label="Stale Connectors" value={data.stale_connectors} sub={`of ${data.total_connectors}`} Icon={AlertTriangle} color={data.stale_connectors > 0 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'} />
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
            <TableCell className="text-xs text-gray-500">{fmtDate(a.last_activity)}</TableCell>
            <TableCell>
              <div className="flex gap-1">
                <button onClick={() => onImpersonate(a.agency_id)} className="rounded p-1 text-gray-400 hover:bg-blue-50 hover:text-blue-600" title="Impersonate">
                  <Eye className="h-4 w-4" />
                </button>
                <button onClick={() => onDelete(a.agency_id)} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600" title="Delete">
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
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm">
          <option value="">All roles</option>
          <option value="super_admin">Super Admin</option>
          <option value="agency_admin">Admin</option>
          <option value="account_manager">Manager</option>
          <option value="viewer">Viewer</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm">
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
              <TableCell className="font-medium">{u.name || '—'}</TableCell>
              <TableCell className="text-xs">{u.email}</TableCell>
              <TableCell><Badge variant="outline" className="text-xs">{ROLE_LABELS[u.role] ?? u.role}</Badge></TableCell>
              <TableCell><span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[u.status] ?? 'bg-gray-100 text-gray-600'}`}>{u.status}</span></TableCell>
              <TableCell className="text-xs text-gray-500">{fmtDate(u.last_login_at)}</TableCell>
              <TableCell className="text-xs text-gray-500">{fmtDate(u.created_at)}</TableCell>
              <TableCell>
                {u.status === 'active' ? (
                  <button onClick={() => onDeactivate(u.id)} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600" title="Deactivate">
                    <UserX className="h-4 w-4" />
                  </button>
                ) : u.status === 'deactivated' ? (
                  <button onClick={() => onReactivate(u.id)} className="rounded p-1 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600" title="Reactivate">
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
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm">
          <option value="">All status</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="running">Running</option>
        </select>
        <span className="text-xs text-gray-400">{filtered.length} runs</span>
      </div>

      {days.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
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
              <TableCell className="text-xs">{r.client_id ?? '—'}</TableCell>
              <TableCell><span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[r.status] ?? 'bg-gray-100 text-gray-600'}`}>{r.status}</span></TableCell>
              <TableCell className="text-xs text-gray-500">{fmtDate(r.started_at)}</TableCell>
              <TableCell className="text-xs">{fmtDuration(r.total_duration_ms)}</TableCell>
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
        <StatCard label="Tokens (Prompt)" value={fmtNum(Number(mtd['tokens_prompt'] ?? 0))} Icon={Zap} color="bg-indigo-100 text-indigo-600" />
        <StatCard label="Tokens (Completion)" value={fmtNum(Number(mtd['tokens_completion'] ?? 0))} Icon={Zap} color="bg-amber-100 text-amber-600" />
        <StatCard label="LLM Cost MTD" value={fmtUsd(Number(mtd['llm_cost_usd'] ?? 0))} Icon={DollarSign} color="bg-red-100 text-red-600" />
        <StatCard label="Outcome Fees MTD" value={fmtUsd(Number(mtd['outcome_fees_usd'] ?? 0))} Icon={DollarSign} color="bg-emerald-100 text-emerald-600" />
      </div>

      {/* Charts */}
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <HighchartsReact highcharts={Highcharts} options={areaOpts} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <HighchartsReact highcharts={Highcharts} options={donutOpts} />
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
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

// ─── Connectors Tab ──────────────────────────────────────────────────

function ConnectorsTab({ connectors }: { connectors: AdminConnector[] }) {
  if (!connectors.length) return <EmptyState msg="No connectors configured" />;

  // Status donut
  const statusCounts: Record<string, number> = {};
  for (const c of connectors) {
    const s = c.status ?? 'unknown';
    statusCounts[s] = (statusCounts[s] ?? 0) + 1;
  }

  const donutOpts: Highcharts.Options = {
    chart: { type: 'pie', height: 220 },
    title: { text: undefined },
    plotOptions: { pie: { innerSize: '55%', dataLabels: { format: '{point.name}: {point.y}' } } },
    colors: ['#22c55e', '#ef4444', '#f59e0b', '#94a3b8'],
    series: [{ name: 'Count', data: Object.entries(statusCounts).map(([name, y]) => ({ name, y })), type: 'pie' }],
    credits: { enabled: false },
  };

  return (
    <div className="space-y-4">
      <div className="max-w-xs rounded-xl border border-gray-200 bg-white p-4">
        <HighchartsReact highcharts={Highcharts} options={donutOpts} />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Agency</TableHead>
            <TableHead>Platform</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Advertisers</TableHead>
            <TableHead>Last Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {connectors.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="text-xs">{c.agency_id}</TableCell>
              <TableCell className="font-medium">{c.platform}</TableCell>
              <TableCell className="text-xs">{c.connection_type}</TableCell>
              <TableCell><span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[c.status] ?? 'bg-gray-100 text-gray-600'}`}>{c.status}</span></TableCell>
              <TableCell>{c.advertiser_count}</TableCell>
              <TableCell className="text-xs text-gray-500">{fmtDate(c.updated_at)}</TableCell>
            </TableRow>
          ))}
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
        <h3 className="mb-2 text-sm font-semibold text-gray-700">Discovered Agents ({discovered?.length ?? 0})</h3>
        {discovered?.length ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {discovered.map((agent, i) => (
              <div key={i} className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="font-medium text-sm">{String(agent['name'] ?? agent['url'] ?? 'Unknown')}</p>
                <p className="text-xs text-gray-500 mt-1">{String(agent['url'] ?? '')}</p>
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
          <p className="text-xs text-gray-400">No agents discovered yet. Use Federation to discover remote agents.</p>
        )}
      </div>

      {/* A2A timeline */}
      {sortedDays.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="mb-2 text-sm font-semibold text-gray-700">A2A Calls (30 days)</h3>
          <HighchartsReact highcharts={Highcharts} options={timelineOpts} />
        </div>
      )}

      {/* Peer summary */}
      {peers?.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-700">Peer Summary</h3>
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
                  <TableCell className="font-mono text-xs">{p.peer_url}</TableCell>
                  <TableCell>{p.peer_name ?? '—'}</TableCell>
                  <TableCell>{p.total}</TableCell>
                  <TableCell className="text-emerald-600">{p.success}</TableCell>
                  <TableCell className="text-red-600">{p.failed}</TableCell>
                  <TableCell className="text-xs text-gray-500">{fmtDate(p.last_call)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Recent log */}
      {log?.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-700">Recent Interactions</h3>
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
                  <TableCell className="text-xs">{String(entry['engine_id'] ?? '—')}</TableCell>
                  <TableCell className="text-xs">{String(entry['skill_id'] ?? '—')}</TableCell>
                  <TableCell><span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[String(entry['status'])] ?? 'bg-gray-100 text-gray-600'}`}>{String(entry['status'])}</span></TableCell>
                  <TableCell className="text-xs">{entry['duration_ms'] ? fmtDuration(Number(entry['duration_ms'])) : '—'}</TableCell>
                  <TableCell className="text-xs text-gray-500">{fmtDate(String(entry['created_at'] ?? ''))}</TableCell>
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
      <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
    </div>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div className="flex items-center justify-center py-20">
      <p className="text-sm text-gray-400">{msg}</p>
    </div>
  );
}

// ─── Quotas Tab ──────────────────────────────────────────────────────

function QuotasTab({ requests, onRefresh }: { requests: AdminQuotaRequest[]; onRefresh: () => void }) {
  const [grantInput, setGrantInput] = useState<Record<string, number>>({});

  const handleApprove = async (id: string) => {
    const amount = grantInput[id] ?? (requests.find((r) => r.id === id)?.extra_runs_requested ?? 8);
    await approveQuotaRequest(id, amount);
    onRefresh();
  };

  const handleDeny = async (id: string) => {
    await denyQuotaRequest(id);
    onRefresh();
  };

  return (
    <div className="space-y-6">
      <h3 className="text-sm font-semibold text-gray-700">Pending Quota Requests ({requests.length})</h3>
      {requests.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">No pending requests</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agency</TableHead>
              <TableHead>Requester</TableHead>
              <TableHead>Month</TableHead>
              <TableHead>Requested</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Grant</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.agency_name ?? r.agency_id}</TableCell>
                <TableCell className="text-xs">{r.requester_email ?? r.requested_by}</TableCell>
                <TableCell className="text-xs">{r.month}</TableCell>
                <TableCell>{r.extra_runs_requested}</TableCell>
                <TableCell className="text-xs text-gray-500 max-w-48 truncate">{r.reason ?? '—'}</TableCell>
                <TableCell>
                  <input
                    type="number"
                    min={1}
                    value={grantInput[r.id] ?? r.extra_runs_requested}
                    onChange={(e) => setGrantInput({ ...grantInput, [r.id]: Number(e.target.value) })}
                    className="w-16 rounded border border-gray-200 px-2 py-1 text-sm text-center"
                  />
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <button onClick={() => void handleApprove(r.id)} className="rounded bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700">Approve</button>
                    <button onClick={() => void handleDeny(r.id)} className="rounded bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-200">Deny</button>
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

// ─── Impersonate Banner ──────────────────────────────────────────────

function ImpersonateBanner({ agencyId, onExit }: { agencyId: string; onExit: () => void }) {
  return (
    <div className="flex items-center justify-between bg-red-600 px-4 py-2 text-white text-sm">
      <span>Viewing as <strong>{agencyId}</strong> — impersonation mode</span>
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
  const [impersonating, setImpersonating] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Check if already impersonating
  useEffect(() => {
    const adminToken = sessionStorage.getItem('plinth_admin_token');
    if (adminToken) {
      // We're impersonating — show the agency id from storage
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
          const data = await getUsers({ limit: 200 });
          setUsers(data.users as AdminUser[]);
          break;
        }
        case 'runs': {
          const data = await getRuns({ limit: 100 });
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
          setPendingQuotaCount(data.pending_count);
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
          <h2 className="text-2xl font-bold text-zinc-900">Super Admin</h2>
          <p className="text-sm text-gray-500">System-wide visibility and control</p>
        </div>
        <button onClick={() => void loadData()} className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.id
                ? 'border-[#02c98d] text-[#02c98d]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <t.Icon className="h-4 w-4" />
            {t.label}
            {t.id === 'quotas' && pendingQuotaCount > 0 && (
              <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
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
      </div>
    </div>
  );
}
