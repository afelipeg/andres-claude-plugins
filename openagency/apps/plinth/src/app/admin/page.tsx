'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  Building2,
  Tags,
  Play,
  DollarSign,
  AlertCircle,
  Clock,
  User,
  Zap,
} from 'lucide-react';

// ---------- Types ----------

interface KpiData {
  total_agencies: number;
  active_brands: number;
  pipeline_runs_today: number;
  revenue: number;
}

interface PipelinePoint {
  date: string;
  runs: number;
  success: number;
  failed: number;
}

interface EngineUsage {
  engine: string;
  usage: number;
}

interface AgencyUsage {
  agency: string;
  usage: number;
}

interface ErrorRatePoint {
  date: string;
  rate: number;
}

interface ActivityEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  detail: string;
}

interface DashboardData {
  kpis: KpiData;
  pipeline_runs: PipelinePoint[];
  engine_usage: EngineUsage[];
  top_agencies: AgencyUsage[];
  error_rate: ErrorRatePoint[];
  recent_activity: ActivityEntry[];
}

// ---------- Constants ----------

const CHART_COLORS = {
  primary: 'hsl(160, 84%, 39%)',
  secondary: 'hsl(210, 70%, 50%)',
  tertiary: 'hsl(40, 90%, 50%)',
  quaternary: 'hsl(280, 65%, 60%)',
  destructive: 'hsl(0, 70%, 50%)',
  grid: '#27272a',
  tick: '#a1a1aa',
};

const PIE_COLORS = [
  CHART_COLORS.primary,
  CHART_COLORS.secondary,
  CHART_COLORS.tertiary,
  CHART_COLORS.quaternary,
  CHART_COLORS.destructive,
];

// ---------- Sub-components ----------

function AdminTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-3 shadow-xl text-sm">
      <p className="font-medium text-zinc-200 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="text-zinc-400">
          {p.name || p.dataKey}:{' '}
          <span className="text-zinc-100 font-medium">
            {typeof p.value === 'number'
              ? p.dataKey === 'rate'
                ? `${p.value.toFixed(2)}%`
                : p.value.toLocaleString()
              : p.value}
          </span>
        </p>
      ))}
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', color)}>
          <Icon className="h-4.5 w-4.5 text-white" />
        </div>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}

function PieLegend({ data }: { data: EngineUsage[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2">
      {data.map((d, i) => (
        <span key={d.engine} className="flex items-center gap-1.5 text-xs text-zinc-400">
          <span
            className="h-2.5 w-2.5 rounded-sm inline-block"
            style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
          />
          {d.engine}
        </span>
      ))}
    </div>
  );
}

function SkeletonKpi() {
  return <div className="h-28 rounded-xl border border-border bg-card animate-pulse" />;
}

function SkeletonChart() {
  return (
    <div className="rounded-xl border border-border bg-card p-6 animate-pulse">
      <div className="h-5 w-40 rounded bg-muted mb-4" />
      <div className="h-64 rounded bg-muted" />
    </div>
  );
}

// ---------- Page ----------

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const getToken = useCallback(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('plinth_token') || '';
    }
    return '';
  }, []);

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await fetch('/api/v1/admin/dashboard', {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (res.status === 403) {
          setError('Access denied. Admin role required.');
          return;
        }
        if (!res.ok) throw new Error('Failed to load admin dashboard');
        setData(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, [getToken]);

  if (error) {
    return (
      <div className="max-w-6xl">
        <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-6 flex items-center gap-3 text-sm text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      </div>
    );
  }

  const formatCurrency = (v: number) => {
    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
    return `$${v.toFixed(0)}`;
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="max-w-6xl space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          <>
            <SkeletonKpi />
            <SkeletonKpi />
            <SkeletonKpi />
            <SkeletonKpi />
          </>
        ) : (
          <>
            <KpiCard
              icon={Building2}
              label="Total Agencies"
              value={data?.kpis.total_agencies.toLocaleString() ?? '0'}
              color="bg-blue-600"
            />
            <KpiCard
              icon={Tags}
              label="Active Brands"
              value={data?.kpis.active_brands.toLocaleString() ?? '0'}
              color="bg-emerald-600"
            />
            <KpiCard
              icon={Play}
              label="Pipeline Runs (Today)"
              value={data?.kpis.pipeline_runs_today.toLocaleString() ?? '0'}
              color="bg-amber-600"
            />
            <KpiCard
              icon={DollarSign}
              label="Revenue"
              value={formatCurrency(data?.kpis.revenue ?? 0)}
              color="bg-purple-600"
            />
          </>
        )}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Pipeline runs over time */}
        {loading ? (
          <SkeletonChart />
        ) : (
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">
              Pipeline Runs (30 days)
            </h3>
            {data?.pipeline_runs?.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart
                  data={data.pipeline_runs}
                  margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                >
                  <defs>
                    <linearGradient id="successGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="failedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.destructive} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={CHART_COLORS.destructive} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={CHART_COLORS.grid}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: CHART_COLORS.tick, fontSize: 11 }}
                    axisLine={{ stroke: CHART_COLORS.grid }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: CHART_COLORS.tick, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<AdminTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <Area
                    type="monotone"
                    dataKey="success"
                    name="Success"
                    stroke={CHART_COLORS.primary}
                    fill="url(#successGrad)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="failed"
                    name="Failed"
                    stroke={CHART_COLORS.destructive}
                    fill="url(#failedGrad)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-zinc-500 text-sm">
                No pipeline data
              </div>
            )}
          </div>
        )}

        {/* Engine usage pie chart */}
        {loading ? (
          <SkeletonChart />
        ) : (
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">
              Engine Usage Distribution
            </h3>
            {data?.engine_usage?.length ? (
              <>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={data.engine_usage}
                      dataKey="usage"
                      nameKey="engine"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      innerRadius={50}
                      strokeWidth={0}
                      paddingAngle={2}
                    >
                      {data.engine_usage.map((_, i) => (
                        <Cell
                          key={`cell-${i}`}
                          fill={PIE_COLORS[i % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<AdminTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <PieLegend data={data.engine_usage} />
              </>
            ) : (
              <div className="flex items-center justify-center h-64 text-zinc-500 text-sm">
                No engine usage data
              </div>
            )}
          </div>
        )}
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top agencies */}
        {loading ? (
          <SkeletonChart />
        ) : (
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">
              Top Agencies by Usage
            </h3>
            {data?.top_agencies?.length ? (
              <ResponsiveContainer
                width="100%"
                height={Math.max(data.top_agencies.length * 40, 200)}
              >
                <BarChart
                  data={data.top_agencies}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={CHART_COLORS.grid}
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tick={{ fill: CHART_COLORS.tick, fontSize: 11 }}
                    axisLine={{ stroke: CHART_COLORS.grid }}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="agency"
                    tick={{ fill: CHART_COLORS.tick, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={90}
                  />
                  <Tooltip content={<AdminTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <Bar
                    dataKey="usage"
                    name="Usage"
                    fill={CHART_COLORS.secondary}
                    radius={[0, 4, 4, 0]}
                    maxBarSize={28}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-48 text-zinc-500 text-sm">
                No agency data
              </div>
            )}
          </div>
        )}

        {/* Error rate */}
        {loading ? (
          <SkeletonChart />
        ) : (
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">Error Rate</h3>
            {data?.error_rate?.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart
                  data={data.error_rate}
                  margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={CHART_COLORS.grid}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: CHART_COLORS.tick, fontSize: 11 }}
                    axisLine={{ stroke: CHART_COLORS.grid }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: CHART_COLORS.tick, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `${v}%`}
                    domain={[0, 'auto']}
                  />
                  <Tooltip content={<AdminTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)' }} />
                  <Line
                    type="monotone"
                    dataKey="rate"
                    name="Error %"
                    stroke={CHART_COLORS.destructive}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, stroke: CHART_COLORS.destructive, fill: '#18181b' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-zinc-500 text-sm">
                No error rate data
              </div>
            )}
          </div>
        )}
      </div>

      {/* Recent activity feed */}
      {loading ? (
        <div className="rounded-xl border border-border bg-card p-6 animate-pulse">
          <div className="h-5 w-36 rounded bg-muted mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 rounded bg-muted" />
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">
            Recent Activity
          </h3>
          {data?.recent_activity?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-3 pr-4 font-medium text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        Time
                      </div>
                    </th>
                    <th className="pb-3 pr-4 font-medium text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5" />
                        User
                      </div>
                    </th>
                    <th className="pb-3 pr-4 font-medium text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Zap className="h-3.5 w-3.5" />
                        Action
                      </div>
                    </th>
                    <th className="pb-3 font-medium text-muted-foreground">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_activity.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-b border-border/50 last:border-0"
                    >
                      <td className="py-3 pr-4 whitespace-nowrap text-muted-foreground">
                        {formatTime(entry.timestamp)}
                      </td>
                      <td className="py-3 pr-4 whitespace-nowrap text-foreground font-medium">
                        {entry.user}
                      </td>
                      <td className="py-3 pr-4">
                        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                          {entry.action}
                        </span>
                      </td>
                      <td className="py-3 text-muted-foreground truncate max-w-xs">
                        {entry.detail}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8 text-zinc-500 text-sm">
              No recent activity
            </div>
          )}
        </div>
      )}
    </div>
  );
}
