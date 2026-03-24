'use client';

import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { cn } from '@/lib/utils';

export interface ShapleyChannel {
  channel: string;
  shapley_share_pct: number;
  last_click_share_pct: number;
  credit_status: 'under-credited' | 'over-credited' | 'fair';
}

export interface ShapleyData {
  channels: ShapleyChannel[];
}

interface ShapleyChartProps {
  data: ShapleyData;
  options?: Record<string, unknown>;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  'under-credited': { label: 'Under-credited', bg: 'bg-red-500/15', text: 'text-red-400' },
  'over-credited': { label: 'Over-credited', bg: 'bg-amber-500/15', text: 'text-amber-400' },
  'fair': { label: 'Fair', bg: 'bg-emerald-500/15', text: 'text-emerald-400' },
};

export function ShapleyChart({ data }: ShapleyChartProps) {
  const chartData = useMemo(() => {
    if (!data?.channels?.length) return [];
    return [...data.channels].sort((a, b) => b.shapley_share_pct - a.shapley_share_pct);
  }, [data]);

  if (!chartData.length) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500 text-sm">
        No Shapley attribution data available
      </div>
    );
  }

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 50 + 60)}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 10, right: 30, left: 100, bottom: 10 }}
          barCategoryGap="30%"
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: '#a1a1aa', fontSize: 11 }}
            axisLine={{ stroke: '#27272a' }}
            tickLine={false}
            tickFormatter={(v) => `${v}%`}
            domain={[0, 'auto']}
          />
          <YAxis
            type="category"
            dataKey="channel"
            tick={{ fill: '#a1a1aa', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={90}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0]?.payload as ShapleyChannel;
              if (!d) return null;
              const diff = d.shapley_share_pct - d.last_click_share_pct;
              return (
                <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-3 shadow-xl text-sm">
                  <p className="font-medium text-zinc-200">{d.channel}</p>
                  <p className="text-zinc-400 mt-1">
                    Shapley: <span className="text-emerald-400">{d.shapley_share_pct.toFixed(1)}%</span>
                  </p>
                  <p className="text-zinc-400">
                    Last-click: <span className="text-blue-400">{d.last_click_share_pct.toFixed(1)}%</span>
                  </p>
                  <p className="text-zinc-400 mt-1">
                    Delta: <span className={diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-red-400' : 'text-zinc-300'}>
                      {diff > 0 ? '+' : ''}{diff.toFixed(1)}pp
                    </span>
                  </p>
                </div>
              );
            }}
            cursor={{ fill: 'rgba(255,255,255,0.03)' }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, color: '#a1a1aa' }}
            iconType="rect"
            iconSize={10}
          />
          <Bar
            dataKey="shapley_share_pct"
            name="Shapley"
            fill="#10b981"
            radius={[0, 3, 3, 0]}
            barSize={14}
            isAnimationActive
            animationDuration={600}
          />
          <Bar
            dataKey="last_click_share_pct"
            name="Last-click"
            fill="#3b82f6"
            radius={[0, 3, 3, 0]}
            barSize={14}
            isAnimationActive
            animationDuration={600}
          />
        </BarChart>
      </ResponsiveContainer>

      {/* Credit status badges */}
      <div className="flex flex-wrap gap-2 mt-3 px-4">
        {chartData.map((ch) => {
          const cfg = STATUS_CONFIG[ch.credit_status] || STATUS_CONFIG['fair'];
          return (
            <span
              key={ch.channel}
              className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', cfg.bg, cfg.text)}
            >
              {ch.channel}: {cfg.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
