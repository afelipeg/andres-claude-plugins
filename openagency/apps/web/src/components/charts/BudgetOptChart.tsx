import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';

interface ReallocationItem {
  channel: string;
  current_spend: number;
  optimized_spend: number;
  delta: number;
  direction: 'increase' | 'decrease';
}

interface Props {
  reallocation: ReallocationItem[];
  kpiLiftPct: number;
}

function fmtK(n: number): string {
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(0)}K` : n.toFixed(0);
}

export function BudgetOptChart({ reallocation, kpiLiftPct }: Props) {
  const data = reallocation.map((item) => ({
    channel: item.channel,
    current: item.current_spend,
    optimized: item.optimized_spend,
    delta: item.delta,
    direction: item.direction,
  }));

  return (
    <div>
      {/* KPI uplift badge */}
      <div className="mb-4 flex items-center gap-2">
        <span className="inline-flex items-center rounded-lg bg-green-100 px-3 py-1 text-sm font-semibold text-green-700">
          {kpiLiftPct > 0 ? '+' : ''}{kpiLiftPct.toFixed(1)}% KPI Uplift
        </span>
        <span className="text-xs text-gray-500">from optimal reallocation</span>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis dataKey="channel" fontSize={11} stroke="#9ca3af" />
          <YAxis tickFormatter={fmtK} stroke="#9ca3af" fontSize={11} />
          <Tooltip
            formatter={(val: number, name: string) => [
              `$${val.toLocaleString()}`,
              name === 'current' ? 'Current' : 'Optimized',
            ]}
          />
          <Legend />
          <Bar dataKey="current" fill="#94a3b8" name="Current" radius={[4, 4, 0, 0]} barSize={20} />
          <Bar dataKey="optimized" fill="#0077e6" name="Optimized" radius={[4, 4, 0, 0]} barSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
