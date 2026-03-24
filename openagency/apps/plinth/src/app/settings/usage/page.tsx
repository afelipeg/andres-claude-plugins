'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  CalendarDays,
  AlertCircle,
  Zap,
  Coins,
  Wrench,
  Activity,
} from 'lucide-react';

interface DailyCost {
  date: string;
  cost: number;
  conversations: number;
}

interface TokenUsage {
  date: string;
  input_tokens: number;
  output_tokens: number;
}

interface ToolInvocation {
  tool: string;
  count: number;
}

interface UsageData {
  daily_costs: DailyCost[];
  token_usage: TokenUsage[];
  tool_invocations: ToolInvocation[];
  quota: {
    used: number;
    limit: number;
  };
}

const DATE_RANGES = [
  { label: '7d', days: 7 },
  { label: '14d', days: 14 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
] as const;

const CHART_COLORS = {
  primary: 'hsl(160, 84%, 39%)',
  secondary: 'hsl(210, 70%, 50%)',
  tertiary: 'hsl(40, 90%, 50%)',
  grid: '#27272a',
  tick: '#a1a1aa',
};

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-3 shadow-xl text-sm">
      <p className="font-medium text-zinc-200 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="text-zinc-400">
          {p.name || p.dataKey}:{' '}
          <span className="text-zinc-100 font-medium">
            {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
          </span>
        </p>
      ))}
    </div>
  );
}

function QuotaCard({
  icon: Icon,
  label,
  used,
  limit,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  used: number;
  limit: number;
}) {
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const isCritical = pct > 90;
  const isWarning = pct > 70;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-end justify-between mb-2">
        <span className="text-2xl font-bold text-foreground">
          {used.toLocaleString()}
        </span>
        <span className="text-sm text-muted-foreground">
          / {limit.toLocaleString()}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            isCritical ? 'bg-red-500' : isWarning ? 'bg-yellow-500' : 'bg-primary'
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function SkeletonChart() {
  return (
    <div className="rounded-xl border border-border bg-card p-6 animate-pulse">
      <div className="h-5 w-40 rounded bg-muted mb-4" />
      <div className="h-64 rounded bg-muted" />
    </div>
  );
}

export default function UsagePage() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [range, setRange] = useState<number>(30);

  const getToken = useCallback(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('plinth_token') || '';
    }
    return '';
  }, []);

  useEffect(() => {
    async function fetchUsage() {
      setLoading(true);
      try {
        const res = await fetch(`/api/v1/consumption/usage?days=${range}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (!res.ok) throw new Error('Failed to load usage data');
        setData(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load usage data');
      } finally {
        setLoading(false);
      }
    }
    fetchUsage();
  }, [range, getToken]);

  // Sort tool invocations descending
  const sortedTools = useMemo(
    () =>
      [...(data?.tool_invocations || [])].sort((a, b) => b.count - a.count).slice(0, 15),
    [data]
  );

  if (error && !data) {
    return (
      <div className="max-w-5xl">
        <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-6 flex items-center gap-3 text-sm text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header + date range */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Usage & Consumption
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            SDK costs, token usage, and tool invocations
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border p-1">
          {DATE_RANGES.map((r) => (
            <button
              key={r.days}
              onClick={() => setRange(r.days)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                range === r.days
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {r.days === DATE_RANGES[0].days && (
                <CalendarDays className="h-3 w-3" />
              )}
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quota cards */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="h-28 rounded-xl border border-border bg-card animate-pulse" />
          <div className="h-28 rounded-xl border border-border bg-card animate-pulse" />
        </div>
      ) : (
        data?.quota && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <QuotaCard
              icon={Zap}
              label="API Quota"
              used={data.quota.used}
              limit={data.quota.limit}
            />
            <QuotaCard
              icon={Activity}
              label="Conversations"
              used={
                data.daily_costs?.reduce((sum, d) => sum + d.conversations, 0) || 0
              }
              limit={data.quota.limit}
            />
          </div>
        )
      )}

      {/* Cost per conversation by day */}
      {loading ? (
        <SkeletonChart />
      ) : (
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Coins className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">
              SDK Cost per Day
            </h3>
          </div>
          {data?.daily_costs?.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={data.daily_costs}
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
                  tickFormatter={(v: number) => `$${v}`}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar
                  dataKey="cost"
                  name="Cost ($)"
                  fill={CHART_COLORS.primary}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-zinc-500 text-sm">
              No cost data for this period
            </div>
          )}
        </div>
      )}

      {/* Token usage area chart */}
      {loading ? (
        <SkeletonChart />
      ) : (
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">
              Token Usage Over Time
            </h3>
          </div>
          {data?.token_usage?.length ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart
                data={data.token_usage}
                margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
              >
                <defs>
                  <linearGradient id="inputGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="outputGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.secondary} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART_COLORS.secondary} stopOpacity={0} />
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
                  tickFormatter={(v: number) => {
                    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
                    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
                    return `${v}`;
                  }}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Area
                  type="monotone"
                  dataKey="input_tokens"
                  name="Input Tokens"
                  stroke={CHART_COLORS.primary}
                  fill="url(#inputGrad)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="output_tokens"
                  name="Output Tokens"
                  stroke={CHART_COLORS.secondary}
                  fill="url(#outputGrad)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-zinc-500 text-sm">
              No token data for this period
            </div>
          )}
          {/* Legend */}
          <div className="flex items-center gap-4 mt-3 text-xs text-zinc-400">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm inline-block" style={{ backgroundColor: CHART_COLORS.primary }} />
              Input Tokens
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm inline-block" style={{ backgroundColor: CHART_COLORS.secondary }} />
              Output Tokens
            </span>
          </div>
        </div>
      )}

      {/* Tool invocations horizontal bar */}
      {loading ? (
        <SkeletonChart />
      ) : (
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Wrench className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">
              Tool Invocations
            </h3>
          </div>
          {sortedTools.length ? (
            <ResponsiveContainer width="100%" height={Math.max(sortedTools.length * 36, 200)}>
              <BarChart
                data={sortedTools}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
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
                  dataKey="tool"
                  tick={{ fill: CHART_COLORS.tick, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={110}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar
                  dataKey="count"
                  name="Invocations"
                  fill={CHART_COLORS.tertiary}
                  radius={[0, 4, 4, 0]}
                  maxBarSize={24}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-zinc-500 text-sm">
              No tool invocation data
            </div>
          )}
        </div>
      )}
    </div>
  );
}
