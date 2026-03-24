'use client';

import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  ErrorBar,
  ReferenceLine,
} from 'recharts';

export interface ChannelROI {
  channel: string;
  roi: number;
  mroi?: number;
  lower_ci?: number;
  upper_ci?: number;
  spend: number;
  effectiveness?: number;
}

export interface ROIData {
  channels: ChannelROI[];
}

interface ROIChartProps {
  data: ROIData;
  options?: Record<string, unknown>;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#f97316'];

const formatCompact = (v: number): string => {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return typeof v === 'number' ? v.toFixed(2) : String(v);
};

/* ----------------------------------------------------------------
   Error bar custom shape — Recharts ErrorBar renders with path
   ---------------------------------------------------------------- */

function ROIBarChart({ data }: { data: ROIData }) {
  const chartData = useMemo(() => {
    if (!data?.channels?.length) return [];
    return data.channels.map((ch, i) => ({
      ...ch,
      fill: COLORS[i % COLORS.length],
      errorLow: ch.lower_ci !== undefined ? ch.roi - ch.lower_ci : 0,
      errorHigh: ch.upper_ci !== undefined ? ch.upper_ci - ch.roi : 0,
    }));
  }, [data]);

  if (!chartData.length) {
    return <div className="flex items-center justify-center h-64 text-zinc-500 text-sm">No ROI data</div>;
  }

  const hasCI = chartData.some(d => d.errorLow > 0 || d.errorHigh > 0);

  return (
    <ResponsiveContainer width="100%" height={380}>
      <BarChart data={chartData} margin={{ top: 10, right: 20, left: 20, bottom: 40 }} barCategoryGap="25%">
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
        <XAxis
          dataKey="channel"
          tick={{ fill: '#a1a1aa', fontSize: 11 }}
          axisLine={{ stroke: '#27272a' }}
          tickLine={false}
          angle={-25}
          textAnchor="end"
          height={60}
        />
        <YAxis
          tick={{ fill: '#a1a1aa', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          label={{ value: 'ROI', angle: -90, position: 'insideLeft', fill: '#71717a', fontSize: 11 }}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.[0]) return null;
            const d = payload[0].payload;
            return (
              <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-3 shadow-xl text-sm">
                <p className="font-medium text-zinc-200">{d.channel}</p>
                <p className="text-zinc-400">ROI: <span className="text-zinc-100">{d.roi.toFixed(2)}x</span></p>
                {d.lower_ci !== undefined && (
                  <p className="text-zinc-400">CI: [{d.lower_ci.toFixed(2)}, {d.upper_ci.toFixed(2)}]</p>
                )}
                <p className="text-zinc-400">Spend: <span className="text-zinc-100">${formatCompact(d.spend)}</span></p>
              </div>
            );
          }}
          cursor={{ fill: 'rgba(255,255,255,0.03)' }}
        />
        <ReferenceLine y={1} stroke="#52525b" strokeDasharray="4 4" label={{ value: 'Breakeven', fill: '#71717a', fontSize: 10, position: 'right' }} />
        <Bar dataKey="roi" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={600}>
          {chartData.map((entry, i) => (
            <Cell key={`cell-${i}`} fill={entry.fill} />
          ))}
          {hasCI && <ErrorBar dataKey="errorHigh" direction="y" width={6} stroke="#a1a1aa" strokeWidth={1.5} />}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function ROIScatter({ data, xKey, xLabel }: { data: ROIData; xKey: 'mroi' | 'effectiveness'; xLabel: string }) {
  const chartData = useMemo(() => {
    if (!data?.channels?.length) return [];
    return data.channels.map((ch, i) => ({
      ...ch,
      x: ch[xKey] ?? 0,
      y: ch.roi,
      z: ch.spend,
      fill: COLORS[i % COLORS.length],
    }));
  }, [data, xKey]);

  if (!chartData.length) {
    return <div className="flex items-center justify-center h-64 text-zinc-500 text-sm">No ROI data</div>;
  }

  const maxSpend = Math.max(...chartData.map(d => d.z));
  const minSpend = Math.min(...chartData.map(d => d.z));

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={380}>
        <ScatterChart margin={{ top: 10, right: 20, left: 20, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis
            dataKey="x"
            type="number"
            tick={{ fill: '#a1a1aa', fontSize: 11 }}
            axisLine={{ stroke: '#27272a' }}
            tickLine={false}
            name={xLabel}
            label={{ value: xLabel, position: 'insideBottom', offset: -5, fill: '#71717a', fontSize: 11 }}
          />
          <YAxis
            dataKey="y"
            type="number"
            tick={{ fill: '#a1a1aa', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            name="ROI"
            label={{ value: 'ROI', angle: -90, position: 'insideLeft', fill: '#71717a', fontSize: 11 }}
          />
          <ZAxis dataKey="z" range={[80, 600]} name="Spend" />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              return (
                <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-3 shadow-xl text-sm">
                  <p className="font-medium text-zinc-200">{d.channel}</p>
                  <p className="text-zinc-400">ROI: <span className="text-zinc-100">{d.roi.toFixed(2)}x</span></p>
                  <p className="text-zinc-400">{xLabel}: <span className="text-zinc-100">{d.x.toFixed(2)}</span></p>
                  <p className="text-zinc-400">Spend: <span className="text-zinc-100">${formatCompact(d.spend)}</span></p>
                </div>
              );
            }}
          />
          <ReferenceLine y={1} stroke="#52525b" strokeDasharray="4 4" />
          <Scatter data={chartData} isAnimationActive animationDuration={600}>
            {chartData.map((entry, i) => (
              <Cell key={`cell-${i}`} fill={entry.fill} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 mt-2 px-4">
        {chartData.map((ch, i) => (
          <span key={ch.channel} className="flex items-center gap-1.5 text-xs text-zinc-400">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: ch.fill }} />
            {ch.channel}
          </span>
        ))}
      </div>
      <p className="text-[10px] text-zinc-600 mt-1 px-4">Bubble size represents spend volume.</p>
    </div>
  );
}

export function ROIChart({ data, options }: ROIChartProps) {
  const mode = (options?.mode as string) || 'bar';

  if (!data?.channels?.length) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500 text-sm">
        No ROI data available
      </div>
    );
  }

  switch (mode) {
    case 'scatter_mroi':
      return <ROIScatter data={data} xKey="mroi" xLabel="Marginal ROI" />;
    case 'scatter_effectiveness':
      return <ROIScatter data={data} xKey="effectiveness" xLabel="Effectiveness" />;
    case 'bar':
    default:
      return <ROIBarChart data={data} />;
  }
}
