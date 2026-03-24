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
  ReferenceLine,
} from 'recharts';

export interface ChannelAdstock {
  channel: string;
  decay_rate: number;
  half_life_weeks: number;
}

export interface AdstockDecayData {
  channels: ChannelAdstock[];
}

interface AdstockDecayProps {
  data: AdstockDecayData;
  options?: Record<string, unknown>;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#f97316'];
const MAX_WEEKS = 16;

export function AdstockDecay({ data }: AdstockDecayProps) {
  const chartData = useMemo(() => {
    if (!data?.channels?.length) return [];

    const points: Record<string, number | string>[] = [];

    for (let t = 0; t <= MAX_WEEKS; t++) {
      const row: Record<string, number | string> = { week: t };
      for (const ch of data.channels) {
        row[ch.channel] = Math.pow(ch.decay_rate, t) * 100;
      }
      points.push(row);
    }

    return points;
  }, [data]);

  if (!chartData.length || !data?.channels?.length) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500 text-sm">
        No adstock decay data available
      </div>
    );
  }

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={chartData} margin={{ top: 10, right: 20, left: 20, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis
            dataKey="week"
            tick={{ fill: '#a1a1aa', fontSize: 11 }}
            axisLine={{ stroke: '#27272a' }}
            tickLine={false}
            label={{ value: 'Weeks', position: 'insideBottom', offset: -5, fill: '#71717a', fontSize: 11 }}
          />
          <YAxis
            tick={{ fill: '#a1a1aa', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            label={{ value: 'Effect Remaining (%)', angle: -90, position: 'insideLeft', fill: '#71717a', fontSize: 11 }}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-3 shadow-xl text-sm">
                  <p className="text-zinc-400 mb-1.5">Week {label}</p>
                  {payload.map((p: any, i: number) => (
                    <p key={i} style={{ color: p.color }}>
                      {p.name}: {Number(p.value).toFixed(1)}%
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
          <ReferenceLine y={50} stroke="#52525b" strokeDasharray="4 4" label={{ value: '50% (half-life)', fill: '#71717a', fontSize: 10, position: 'right' }} />

          {data.channels.map((ch, i) => (
            <Line
              key={ch.channel}
              type="monotone"
              dataKey={ch.channel}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: COLORS[i % COLORS.length] }}
              name={ch.channel}
              isAnimationActive
              animationDuration={600}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      {/* Channel info table */}
      <div className="mt-3 px-4">
        <div className="grid grid-cols-3 gap-2 text-xs">
          <span className="text-zinc-500 font-medium">Channel</span>
          <span className="text-zinc-500 font-medium text-center">Decay Rate</span>
          <span className="text-zinc-500 font-medium text-center">Half-life</span>
          {data.channels.map((ch, i) => (
            <React.Fragment key={ch.channel}>
              <span className="flex items-center gap-1.5 text-zinc-300">
                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                {ch.channel}
              </span>
              <span className="text-zinc-400 text-center tabular-nums">{ch.decay_rate.toFixed(3)}</span>
              <span className="text-zinc-400 text-center tabular-nums">{ch.half_life_weeks.toFixed(1)} wks</span>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
