'use client';

import React, { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceDot,
  ComposedChart,
} from 'recharts';

export interface ResponseCurvePoint {
  spend: number;
  response: number;
  lower_ci?: number;
  upper_ci?: number;
}

export interface ChannelCurve {
  channel: string;
  points: ResponseCurvePoint[];
  current_spend: number;
  current_response: number;
}

export interface ResponseCurvesData {
  channels: ChannelCurve[];
}

interface ResponseCurvesProps {
  data: ResponseCurvesData;
  options?: Record<string, unknown>;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#f97316'];

const formatCompact = (v: number): string => {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toFixed(0);
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-3 shadow-xl text-sm">
      <p className="text-zinc-400 mb-1.5">Spend: ${formatCompact(label)}</p>
      {payload.map((p: any, i: number) => {
        if (p.dataKey.includes('_ci_')) return null;
        return (
          <p key={i} className="text-zinc-200" style={{ color: p.color }}>
            {p.name}: {formatCompact(p.value)}
          </p>
        );
      })}
    </div>
  );
};

export function ResponseCurves({ data }: ResponseCurvesProps) {
  const [activeChannels, setActiveChannels] = useState<Set<string>>(new Set());

  const { mergedData, channelNames } = useMemo(() => {
    if (!data?.channels?.length) return { mergedData: [], channelNames: [] };

    const names = data.channels.map(c => c.channel);

    // Initialize all channels as active
    if (activeChannels.size === 0) {
      // We'll handle this in the render
    }

    // Merge all channel points into a unified dataset keyed by spend
    const spendMap = new Map<number, Record<string, number>>();

    for (const ch of data.channels) {
      for (const pt of ch.points) {
        if (!spendMap.has(pt.spend)) {
          spendMap.set(pt.spend, { spend: pt.spend });
        }
        const row = spendMap.get(pt.spend)!;
        row[ch.channel] = pt.response;
        if (pt.lower_ci !== undefined) row[`${ch.channel}_ci_lower`] = pt.lower_ci;
        if (pt.upper_ci !== undefined) row[`${ch.channel}_ci_upper`] = pt.upper_ci;
      }
    }

    const merged = Array.from(spendMap.values()).sort((a, b) => a.spend - b.spend);
    return { mergedData: merged, channelNames: names };
  }, [data]);

  // Initialize active channels on first render
  const effectiveActive = activeChannels.size > 0 ? activeChannels : new Set(channelNames);

  if (!mergedData.length) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500 text-sm">
        No response curve data available
      </div>
    );
  }

  const hasCIBands = data.channels.some(ch => ch.points.some(p => p.lower_ci !== undefined));

  const toggleChannel = (channel: string) => {
    setActiveChannels(prev => {
      const next = new Set(prev.size > 0 ? prev : channelNames);
      if (next.has(channel)) {
        if (next.size > 1) next.delete(channel);
      } else {
        next.add(channel);
      }
      return next;
    });
  };

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={380}>
        <ComposedChart data={mergedData} margin={{ top: 10, right: 20, left: 20, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis
            dataKey="spend"
            tickFormatter={(v) => `$${formatCompact(v)}`}
            tick={{ fill: '#a1a1aa', fontSize: 11 }}
            axisLine={{ stroke: '#27272a' }}
            tickLine={false}
            label={{ value: 'Spend', position: 'insideBottom', offset: -5, fill: '#71717a', fontSize: 11 }}
          />
          <YAxis
            tickFormatter={formatCompact}
            tick={{ fill: '#a1a1aa', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            label={{ value: 'Response', angle: -90, position: 'insideLeft', fill: '#71717a', fontSize: 11 }}
          />
          <Tooltip content={<CustomTooltip />} />

          {channelNames.map((ch, i) => {
            const color = COLORS[i % COLORS.length];
            const isActive = effectiveActive.has(ch);
            if (!isActive) return null;

            return (
              <React.Fragment key={ch}>
                {/* CI band */}
                {hasCIBands && (
                  <Area
                    type="monotone"
                    dataKey={`${ch}_ci_upper`}
                    stroke="none"
                    fill={color}
                    fillOpacity={0.1}
                    isAnimationActive={false}
                    dot={false}
                    activeDot={false}
                    legendType="none"
                    name={`${ch} CI`}
                  />
                )}
                {/* Main response line */}
                <Line
                  type="monotone"
                  dataKey={ch}
                  stroke={color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: color }}
                  name={ch}
                  isAnimationActive
                  animationDuration={600}
                />
              </React.Fragment>
            );
          })}

          {/* Current investment markers */}
          {data.channels.map((ch, i) => {
            const color = COLORS[i % COLORS.length];
            if (!effectiveActive.has(ch.channel)) return null;
            return (
              <ReferenceDot
                key={`marker-${ch.channel}`}
                x={ch.current_spend}
                y={ch.current_response}
                r={6}
                fill={color}
                stroke="#18181b"
                strokeWidth={2}
                isFront
              />
            );
          })}
        </ComposedChart>
      </ResponsiveContainer>

      {/* Channel toggles */}
      <div className="flex flex-wrap items-center gap-3 mt-3 px-4">
        {channelNames.map((ch, i) => {
          const color = COLORS[i % COLORS.length];
          const isActive = effectiveActive.has(ch);
          return (
            <button
              key={ch}
              onClick={() => toggleChannel(ch)}
              className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-md transition-colors ${
                isActive ? 'bg-zinc-800 text-zinc-200' : 'bg-zinc-900 text-zinc-600'
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full inline-block"
                style={{ backgroundColor: isActive ? color : '#52525b' }}
              />
              {ch}
            </button>
          );
        })}
      </div>

      <p className="text-[10px] text-zinc-600 mt-2 px-4">
        Dots mark current investment levels. Click channels to toggle.
      </p>
    </div>
  );
}
