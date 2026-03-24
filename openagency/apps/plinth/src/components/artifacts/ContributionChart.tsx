'use client';

import React, { useMemo } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export interface ChannelContribution {
  channel: string;
  contribution: number;
  contribution_pct: number;
}

export interface ContributionTimePoint {
  period: string;
  [channel: string]: string | number;
}

export interface ContributionData {
  channels: ChannelContribution[];
  baseline?: number;
  time_series?: ContributionTimePoint[];
}

interface ContributionChartProps {
  data: ContributionData;
  options?: Record<string, unknown>;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#f97316'];

const formatCompact = (v: number): string => {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-3 shadow-xl text-sm max-w-xs">
      {label && <p className="text-zinc-400 mb-1.5">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} className="flex items-center gap-2 text-zinc-200">
          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: p.color }} />
          {p.name}: {typeof p.value === 'number' ? formatCompact(p.value) : p.value}
        </p>
      ))}
    </div>
  );
};

const PieTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-3 shadow-xl text-sm">
      <p className="text-zinc-200 font-medium">{d.channel}</p>
      <p className="text-zinc-400">
        {formatCompact(d.contribution)} ({d.contribution_pct.toFixed(1)}%)
      </p>
    </div>
  );
};

const renderCustomPieLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, contribution_pct, channel }: any) => {
  if (contribution_pct < 5) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={500}>
      {contribution_pct.toFixed(0)}%
    </text>
  );
};

function ContributionArea({ data }: { data: ContributionData }) {
  const timeSeries = data.time_series;
  if (!timeSeries?.length) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500 text-sm">
        No time series data for area chart
      </div>
    );
  }

  const channelNames = data.channels.map(c => c.channel);

  return (
    <ResponsiveContainer width="100%" height={380}>
      <AreaChart data={timeSeries} margin={{ top: 10, right: 20, left: 20, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
        <XAxis
          dataKey="period"
          tick={{ fill: '#a1a1aa', fontSize: 11 }}
          axisLine={{ stroke: '#27272a' }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={formatCompact}
          tick={{ fill: '#a1a1aa', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 11, color: '#a1a1aa' }}
          iconType="circle"
          iconSize={8}
        />
        {channelNames.map((ch, i) => (
          <Area
            key={ch}
            type="monotone"
            dataKey={ch}
            stackId="1"
            stroke={COLORS[i % COLORS.length]}
            fill={COLORS[i % COLORS.length]}
            fillOpacity={0.6}
            name={ch}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

function ContributionWaterfall({ data }: { data: ContributionData }) {
  const chartData = useMemo(() => {
    if (!data?.channels?.length) return [];

    const bars: { name: string; value: number; base: number; fill: string }[] = [];
    let runningTotal = data.baseline ?? 0;

    if (data.baseline !== undefined) {
      bars.push({
        name: 'Baseline',
        value: data.baseline,
        base: 0,
        fill: '#6b7280',
      });
    }

    for (let i = 0; i < data.channels.length; i++) {
      const ch = data.channels[i];
      bars.push({
        name: ch.channel,
        value: ch.contribution,
        base: runningTotal,
        fill: COLORS[i % COLORS.length],
      });
      runningTotal += ch.contribution;
    }

    bars.push({
      name: 'Total',
      value: runningTotal,
      base: 0,
      fill: '#10b981',
    });

    return bars;
  }, [data]);

  if (!chartData.length) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500 text-sm">
        No contribution data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={380}>
      <BarChart data={chartData} margin={{ top: 10, right: 20, left: 20, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fill: '#a1a1aa', fontSize: 11 }}
          axisLine={{ stroke: '#27272a' }}
          tickLine={false}
          angle={-25}
          textAnchor="end"
          height={60}
        />
        <YAxis
          tickFormatter={formatCompact}
          tick={{ fill: '#a1a1aa', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="base" stackId="stack" fill="transparent" isAnimationActive={false} />
        <Bar dataKey="value" stackId="stack" radius={[3, 3, 0, 0]}>
          {chartData.map((entry, i) => (
            <Cell key={`cell-${i}`} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function ContributionPie({ data }: { data: ContributionData }) {
  if (!data?.channels?.length) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500 text-sm">
        No contribution data available
      </div>
    );
  }

  return (
    <div className="flex items-center">
      <ResponsiveContainer width="60%" height={320}>
        <PieChart>
          <Pie
            data={data.channels}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={120}
            paddingAngle={2}
            dataKey="contribution"
            nameKey="channel"
            label={renderCustomPieLabel}
            labelLine={false}
            isAnimationActive
            animationDuration={600}
          >
            {data.channels.map((_, i) => (
              <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} stroke="#09090b" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip content={<PieTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="w-[40%] space-y-2 pl-4">
        {data.channels.map((ch, i) => (
          <div key={ch.channel} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 text-zinc-300">
              <span
                className="w-2.5 h-2.5 rounded-full inline-block"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              {ch.channel}
            </span>
            <span className="text-zinc-400 tabular-nums">{ch.contribution_pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ContributionChart({ data, options }: ContributionChartProps) {
  const mode = (options?.mode as string) || 'pie';

  if (!data?.channels?.length && !data?.time_series?.length) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500 text-sm">
        No contribution data available
      </div>
    );
  }

  switch (mode) {
    case 'area':
      return <ContributionArea data={data} />;
    case 'waterfall':
      return <ContributionWaterfall data={data} />;
    case 'pie':
    default:
      return <ContributionPie data={data} />;
  }
}
