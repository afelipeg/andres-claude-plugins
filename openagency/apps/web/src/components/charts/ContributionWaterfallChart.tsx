import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Cell, ResponsiveContainer,
} from 'recharts';
import type { ContributionEntry } from '@openagency/types';

const COLORS = ['#94a3b8', '#0077e6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

interface Props {
  entries: ContributionEntry[];
  totalKpi: number;
}

function fmtK(n: number): string {
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(0)}K` : n.toFixed(0);
}

export function ContributionWaterfallChart({ entries, totalKpi }: Props) {
  // Build waterfall: invisible base + visible bar
  let cumulative = 0;
  const data = entries.map((e, i) => {
    const base = cumulative;
    cumulative += e.contribution;
    return {
      name: e.channel,
      base,
      value: e.contribution,
      pct: e.contribution_pct,
      colorIdx: i,
    };
  });

  // Add total bar
  data.push({
    name: 'Total KPI',
    base: 0,
    value: totalKpi,
    pct: 100,
    colorIdx: -1,
  });

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        <XAxis dataKey="name" fontSize={10} interval={0} angle={-20} textAnchor="end" height={60} />
        <YAxis tickFormatter={fmtK} stroke="#9ca3af" fontSize={11} />
        <Tooltip
          formatter={(val: number, name: string) => {
            if (name === 'base') return [null, null];
            return [`$${val.toLocaleString()}`, 'Contribution'];
          }}
        />
        <Bar dataKey="base" stackId="a" fill="transparent" />
        <Bar dataKey="value" stackId="a" radius={[4, 4, 0, 0]}>
          {data.map((d, i) => (
            <Cell
              key={i}
              fill={d.colorIdx === -1 ? '#111827' : (COLORS[d.colorIdx % COLORS.length] ?? '#94a3b8')}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
