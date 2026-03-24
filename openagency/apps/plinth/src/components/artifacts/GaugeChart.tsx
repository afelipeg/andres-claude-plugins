'use client';

import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

export interface GaugeData {
  value: number;
  label: string;
  max?: number;
}

interface GaugeChartProps {
  data: GaugeData;
  options?: Record<string, unknown>;
}

const getGaugeColor = (value: number, max: number): string => {
  const pct = (value / max) * 100;
  if (pct > 70) return '#10b981';
  if (pct > 40) return '#f59e0b';
  return '#ef4444';
};

const getGaugeLabel = (value: number, max: number): string => {
  const pct = (value / max) * 100;
  if (pct > 70) return 'Good';
  if (pct > 40) return 'Fair';
  return 'Poor';
};

export function GaugeChart({ data }: GaugeChartProps) {
  if (data?.value === undefined || data?.value === null) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500 text-sm">
        No gauge data available
      </div>
    );
  }

  const max = data.max ?? 100;
  const value = Math.min(Math.max(data.value, 0), max);
  const color = getGaugeColor(value, max);
  const qualityLabel = getGaugeLabel(value, max);

  // Create a semicircle gauge using PieChart
  // We use startAngle=180 and endAngle=0 for a half-circle
  const filledAngle = (value / max) * 180;

  const gaugeData = [
    { name: 'value', value: value },
    { name: 'remainder', value: max - value },
  ];

  return (
    <div className="w-full flex flex-col items-center">
      <div className="relative" style={{ width: 260, height: 160 }}>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            {/* Background track */}
            <Pie
              data={[{ value: 1 }]}
              cx="50%"
              cy="85%"
              innerRadius={80}
              outerRadius={110}
              startAngle={180}
              endAngle={0}
              paddingAngle={0}
              dataKey="value"
              isAnimationActive={false}
              stroke="none"
            >
              <Cell fill="#27272a" />
            </Pie>
            {/* Filled arc */}
            <Pie
              data={gaugeData}
              cx="50%"
              cy="85%"
              innerRadius={80}
              outerRadius={110}
              startAngle={180}
              endAngle={0}
              paddingAngle={0}
              dataKey="value"
              isAnimationActive
              animationDuration={800}
              stroke="none"
            >
              <Cell fill={color} />
              <Cell fill="transparent" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-2" style={{ pointerEvents: 'none' }}>
          <span className="text-3xl font-bold tabular-nums text-zinc-100">
            {value % 1 === 0 ? value : value.toFixed(1)}
          </span>
          <span className="text-xs font-medium mt-0.5" style={{ color }}>
            {qualityLabel}
          </span>
        </div>
      </div>

      {/* Label */}
      <p className="text-sm text-zinc-400 mt-1 text-center">
        {data.label}
      </p>
      <p className="text-[10px] text-zinc-600 mt-0.5">
        out of {max}
      </p>
    </div>
  );
}
