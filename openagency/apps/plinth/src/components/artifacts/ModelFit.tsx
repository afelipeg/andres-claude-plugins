'use client';

import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export interface ModelFitData {
  periods: string[];
  actual: number[];
  predicted: number[];
}

interface ModelFitProps {
  data: ModelFitData;
  options?: Record<string, unknown>;
}

const formatCompact = (v: number): string => {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toFixed(0);
};

export function ModelFit({ data }: ModelFitProps) {
  const chartData = useMemo(() => {
    if (!data?.periods?.length) return [];
    return data.periods.map((period, i) => ({
      period,
      actual: data.actual[i] ?? 0,
      predicted: data.predicted[i] ?? 0,
    }));
  }, [data]);

  const stats = useMemo(() => {
    if (!chartData.length) return null;
    const n = chartData.length;
    const errors = chartData.map(d => d.actual - d.predicted);
    const ssRes = errors.reduce((sum, e) => sum + e * e, 0);
    const meanActual = chartData.reduce((sum, d) => sum + d.actual, 0) / n;
    const ssTot = chartData.reduce((sum, d) => sum + (d.actual - meanActual) ** 2, 0);
    const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
    const mape = chartData.reduce((sum, d) => {
      return sum + (d.actual !== 0 ? Math.abs((d.actual - d.predicted) / d.actual) : 0);
    }, 0) / n * 100;
    return { r2, mape };
  }, [chartData]);

  if (!chartData.length) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500 text-sm">
        No model fit data available
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Stats badges */}
      {stats && (
        <div className="flex items-center gap-4 mb-4 px-1">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-zinc-500">R-squared:</span>
            <span className={`font-mono font-medium ${stats.r2 >= 0.8 ? 'text-emerald-400' : stats.r2 >= 0.6 ? 'text-yellow-400' : 'text-red-400'}`}>
              {stats.r2.toFixed(3)}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-zinc-500">MAPE:</span>
            <span className={`font-mono font-medium ${stats.mape <= 10 ? 'text-emerald-400' : stats.mape <= 20 ? 'text-yellow-400' : 'text-red-400'}`}>
              {stats.mape.toFixed(1)}%
            </span>
          </div>
        </div>
      )}

      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={chartData} margin={{ top: 10, right: 20, left: 20, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis
            dataKey="period"
            tick={{ fill: '#a1a1aa', fontSize: 11 }}
            axisLine={{ stroke: '#27272a' }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={formatCompact}
            tick={{ fill: '#a1a1aa', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-3 shadow-xl text-sm">
                  <p className="text-zinc-400 mb-1.5">{label}</p>
                  {payload.map((p: any, i: number) => (
                    <p key={i} style={{ color: p.color }} className="text-zinc-200">
                      {p.name}: {formatCompact(p.value)}
                    </p>
                  ))}
                </div>
              );
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, color: '#a1a1aa' }}
            iconType="line"
            iconSize={12}
          />
          <Line
            type="monotone"
            dataKey="actual"
            stroke="#10b981"
            strokeWidth={2}
            dot={false}
            name="Actual"
            isAnimationActive
            animationDuration={600}
          />
          <Line
            type="monotone"
            dataKey="predicted"
            stroke="#3b82f6"
            strokeWidth={2}
            strokeDasharray="6 3"
            dot={false}
            name="Predicted"
            isAnimationActive
            animationDuration={600}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
