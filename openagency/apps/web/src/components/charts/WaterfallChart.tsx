import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { WaterfallStage } from '@openagency/types';

interface WaterfallChartProps {
  stages: WaterfallStage[];
  grossSpend: number;
  productiveSpend: number;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export function WaterfallChart({ stages, grossSpend, productiveSpend }: WaterfallChartProps) {
  const data = [
    {
      name: 'Gross Spend',
      value: grossSpend,
      base: 0,
      fill: '#3b82f6',
      isTotal: true,
    },
    ...stages.map((s) => ({
      name: s.label,
      value: s.waste_amount,
      base: s.remaining,
      fill: s.vs_benchmark === 'above' ? '#ef4444' : '#f59e0b',
      isTotal: false,
      pct: s.waste_pct,
      benchmark: s.benchmark_pct,
      vsBenchmark: s.vs_benchmark,
    })),
    {
      name: 'Productive',
      value: productiveSpend,
      base: 0,
      fill: '#22c55e',
      isTotal: true,
    },
  ];

  return (
    <ResponsiveContainer width="100%" height={380}>
      <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: '#64748b' }}
          angle={-20}
          textAnchor="end"
          height={60}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#64748b' }}
          tickFormatter={fmt}
        />
        <Tooltip
          formatter={(value: number) => fmt(value)}
          labelStyle={{ fontWeight: 600 }}
          contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
        />
        <ReferenceLine y={0} stroke="#e2e8f0" />
        {/* Invisible base bar to create waterfall effect */}
        <Bar dataKey="base" stackId="a" fill="transparent" />
        <Bar dataKey="value" stackId="a" radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
