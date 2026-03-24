'use client';

import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';

export interface WaterfallStage {
  stage: string;
  waste_amount: number;
  waste_pct: number;
}

export interface WaterfallData {
  gross_in: number;
  stages: WaterfallStage[];
  productive_spend: number;
}

interface WaterfallChartProps {
  data: WaterfallData;
  options?: Record<string, unknown>;
}

interface WaterfallBar {
  name: string;
  value: number;
  pct: number;
  base: number;
  fill: string;
  isProductive: boolean;
  isGross: boolean;
}

const formatCurrency = (v: number): string => {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
};

const CustomBar = (props: any) => {
  const { x, y, width, height, fill } = props;
  if (!width || !height) return null;
  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={Math.abs(height)}
      fill={fill}
      rx={3}
      ry={3}
    />
  );
};

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload as WaterfallBar;
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-3 shadow-xl text-sm">
      <p className="font-medium text-zinc-200">{d.name}</p>
      <p className="text-zinc-400 mt-1">
        Amount: <span className="text-zinc-100">{formatCurrency(d.value)}</span>
      </p>
      {!d.isGross && (
        <p className="text-zinc-400">
          {d.isProductive ? 'Of gross' : 'Waste'}: <span className="text-zinc-100">{d.pct.toFixed(1)}%</span>
        </p>
      )}
    </div>
  );
};

export function WaterfallChart({ data }: WaterfallChartProps) {
  const chartData = useMemo(() => {
    if (!data?.gross_in || !data?.stages) return [];

    const bars: WaterfallBar[] = [];
    let runningTotal = data.gross_in;

    bars.push({
      name: 'Gross Spend',
      value: data.gross_in,
      pct: 100,
      base: 0,
      fill: '#3b82f6',
      isProductive: false,
      isGross: true,
    });

    for (const stage of data.stages) {
      const wasteAmt = stage.waste_amount;
      runningTotal -= wasteAmt;
      bars.push({
        name: stage.stage,
        value: wasteAmt,
        pct: stage.waste_pct,
        base: runningTotal,
        fill: '#ef4444',
        isProductive: false,
        isGross: false,
      });
    }

    const productive = data.productive_spend ?? runningTotal;
    bars.push({
      name: 'Productive Spend',
      value: productive,
      pct: (productive / data.gross_in) * 100,
      base: 0,
      fill: '#10b981',
      isProductive: true,
      isGross: false,
    });

    return bars;
  }, [data]);

  if (!chartData.length) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500 text-sm">
        No waterfall data available
      </div>
    );
  }

  const maxVal = data.gross_in * 1.05;

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={380}>
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 20, left: 20, bottom: 20 }}
          barCategoryGap="20%"
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: '#a1a1aa', fontSize: 11 }}
            axisLine={{ stroke: '#27272a' }}
            tickLine={false}
            interval={0}
            angle={-25}
            textAnchor="end"
            height={60}
          />
          <YAxis
            tickFormatter={formatCurrency}
            tick={{ fill: '#a1a1aa', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            domain={[0, maxVal]}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
          <ReferenceLine y={0} stroke="#27272a" />

          {/* Invisible base bar */}
          <Bar dataKey="base" stackId="waterfall" fill="transparent" shape={<CustomBar />} isAnimationActive={false} />

          {/* Visible value bar */}
          <Bar dataKey="value" stackId="waterfall" shape={<CustomBar />} isAnimationActive animationDuration={800}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Summary row */}
      <div className="flex items-center justify-between mt-2 px-4">
        <div className="flex items-center gap-4 text-xs text-zinc-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block" />
            Gross Spend
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block" />
            Waste
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
            Productive
          </span>
        </div>
        <div className="text-xs text-zinc-500">
          Efficiency: <span className="text-emerald-400 font-medium">
            {((data.productive_spend / data.gross_in) * 100).toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}
