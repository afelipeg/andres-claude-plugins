'use client';

import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

export interface FunnelStage {
  label: string;
  value: number;
  pct_of_previous?: number;
}

export interface FunnelData {
  stages: FunnelStage[];
}

interface FunnelChartProps {
  data: FunnelData;
  options?: Record<string, unknown>;
}

const GRADIENT_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4'];

const formatCompact = (v: number): string => {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return v.toLocaleString();
};

export function FunnelChart({ data }: FunnelChartProps) {
  const chartData = useMemo(() => {
    if (!data?.stages?.length) return [];

    const maxVal = Math.max(...data.stages.map(s => s.value));

    return data.stages.map((stage, i) => {
      const pctOfFirst = data.stages[0].value > 0
        ? (stage.value / data.stages[0].value) * 100
        : 0;
      const pctOfPrev = stage.pct_of_previous ??
        (i > 0 && data.stages[i - 1].value > 0
          ? (stage.value / data.stages[i - 1].value) * 100
          : 100);

      return {
        ...stage,
        pctOfFirst,
        pctOfPrev,
        fill: GRADIENT_COLORS[i % GRADIENT_COLORS.length],
      };
    });
  }, [data]);

  if (!chartData.length) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500 text-sm">
        No funnel data available
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Visual funnel using horizontal bars */}
      <ResponsiveContainer width="100%" height={Math.max(280, chartData.length * 64 + 40)}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 10, right: 80, left: 110, bottom: 10 }}
          barCategoryGap="25%"
        >
          <XAxis
            type="number"
            tick={{ fill: '#a1a1aa', fontSize: 11 }}
            axisLine={{ stroke: '#27272a' }}
            tickLine={false}
            tickFormatter={formatCompact}
          />
          <YAxis
            type="category"
            dataKey="label"
            tick={{ fill: '#a1a1aa', fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={100}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = payload[0].payload;
              return (
                <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-3 shadow-xl text-sm">
                  <p className="font-medium text-zinc-200">{d.label}</p>
                  <p className="text-zinc-400 mt-1">
                    Value: <span className="text-zinc-100">{formatCompact(d.value)}</span>
                  </p>
                  <p className="text-zinc-400">
                    vs Previous: <span className="text-zinc-100">{d.pctOfPrev.toFixed(1)}%</span>
                  </p>
                  <p className="text-zinc-400">
                    vs Top: <span className="text-zinc-100">{d.pctOfFirst.toFixed(1)}%</span>
                  </p>
                </div>
              );
            }}
            cursor={{ fill: 'rgba(255,255,255,0.03)' }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive animationDuration={600}>
            {chartData.map((entry, i) => (
              <Cell key={`cell-${i}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Conversion rates between stages */}
      <div className="px-4 mt-2 space-y-1">
        {chartData.slice(1).map((stage, i) => (
          <div key={stage.label} className="flex items-center gap-2 text-xs text-zinc-500">
            <span className="text-zinc-600">{chartData[i].label}</span>
            <span className="text-zinc-700">-&gt;</span>
            <span className="text-zinc-600">{stage.label}:</span>
            <span className={`font-medium tabular-nums ${stage.pctOfPrev >= 50 ? 'text-emerald-500' : stage.pctOfPrev >= 25 ? 'text-amber-500' : 'text-red-500'}`}>
              {stage.pctOfPrev.toFixed(1)}% conversion
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
