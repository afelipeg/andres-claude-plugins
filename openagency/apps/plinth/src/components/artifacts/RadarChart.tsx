'use client';

import React from 'react';
import {
  RadarChart as RechartsRadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

export interface RadarDimension {
  name: string;
  score: number;
}

export interface RadarData {
  dimensions: RadarDimension[];
}

interface RadarChartProps {
  data: RadarData;
  options?: Record<string, unknown>;
}

const getScoreColor = (score: number): string => {
  if (score >= 70) return '#10b981';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
};

export function RadarChart({ data }: RadarChartProps) {
  if (!data?.dimensions?.length) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500 text-sm">
        No radar data available
      </div>
    );
  }

  const avgScore = data.dimensions.reduce((sum, d) => sum + d.score, 0) / data.dimensions.length;
  const avgColor = getScoreColor(avgScore);

  return (
    <div className="w-full">
      <div className="flex items-center justify-center">
        <ResponsiveContainer width="100%" height={350}>
          <RechartsRadarChart cx="50%" cy="50%" outerRadius="70%" data={data.dimensions}>
            <PolarGrid stroke="#27272a" />
            <PolarAngleAxis
              dataKey="name"
              tick={{ fill: '#a1a1aa', fontSize: 11 }}
              tickLine={false}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fill: '#52525b', fontSize: 9 }}
              tickCount={5}
              axisLine={false}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null;
                const d = payload[0].payload as RadarDimension;
                const color = getScoreColor(d.score);
                return (
                  <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-3 shadow-xl text-sm">
                    <p className="font-medium text-zinc-200">{d.name}</p>
                    <p className="mt-1" style={{ color }}>
                      Score: {d.score}/100
                    </p>
                  </div>
                );
              }}
            />
            <Radar
              name="Quality"
              dataKey="score"
              stroke="#10b981"
              fill="#10b981"
              fillOpacity={0.2}
              strokeWidth={2}
              isAnimationActive
              animationDuration={600}
            />
          </RechartsRadarChart>
        </ResponsiveContainer>
      </div>

      {/* Dimension scores */}
      <div className="flex flex-wrap items-center justify-center gap-4 mt-2 px-4">
        {data.dimensions.map((dim) => {
          const color = getScoreColor(dim.score);
          return (
            <div key={dim.name} className="text-center">
              <p className="text-xs text-zinc-500">{dim.name}</p>
              <p className="text-lg font-semibold tabular-nums" style={{ color }}>
                {dim.score}
              </p>
            </div>
          );
        })}
        <div className="text-center border-l border-zinc-800 pl-4">
          <p className="text-xs text-zinc-500">Average</p>
          <p className="text-lg font-semibold tabular-nums" style={{ color: avgColor }}>
            {avgScore.toFixed(0)}
          </p>
        </div>
      </div>
    </div>
  );
}
