import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface ChannelBarChartProps {
  data: Array<{ name: string; current: number; optimized: number }>;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export function ChannelBarChart({ data }: ChannelBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={340}>
      <BarChart data={data} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} />
        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={fmt} />
        <Tooltip
          formatter={(value: number) => fmt(value)}
          contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
        />
        <Legend />
        <Bar dataKey="current" name="Current" fill="#94a3b8" radius={[4, 4, 0, 0]} />
        <Bar dataKey="optimized" name="Optimized" fill="#0077e6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
