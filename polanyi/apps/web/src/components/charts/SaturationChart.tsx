import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceDot,
} from 'recharts';

interface ChannelCurve {
  name: string;
  color: string;
  currentSpend: number;
  optimizedSpend: number;
  points: Array<{ spend: number; response: number }>;
}

interface SaturationChartProps {
  curves: ChannelCurve[];
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

export function SaturationChart({ curves }: SaturationChartProps) {
  // Build unified data points
  const allSpends = new Set<number>();
  for (const c of curves) {
    for (const p of c.points) allSpends.add(p.spend);
  }
  const sorted = [...allSpends].sort((a, b) => a - b);

  const data = sorted.map((spend) => {
    const point: Record<string, number> = { spend };
    for (const c of curves) {
      const match = c.points.find((p) => p.spend === spend);
      if (match) point[c.name] = match.response;
    }
    return point;
  });

  return (
    <ResponsiveContainer width="100%" height={340}>
      <LineChart data={data} margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="spend" tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={fmt} />
        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={fmt} />
        <Tooltip
          formatter={(value: number) => fmt(value)}
          labelFormatter={(label: number) => `Spend: ${fmt(label)}`}
          contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
        />
        <Legend />
        {curves.map((c) => (
          <Line
            key={c.name}
            type="monotone"
            dataKey={c.name}
            stroke={c.color}
            strokeWidth={2}
            dot={false}
          />
        ))}
        {curves.map((c) => {
          const match = c.points.find((p) => p.spend === c.currentSpend);
          if (!match) return null;
          return (
            <ReferenceDot
              key={`dot-${c.name}`}
              x={match.spend}
              y={match.response}
              r={5}
              fill={c.color}
              stroke="white"
              strokeWidth={2}
            />
          );
        })}
      </LineChart>
    </ResponsiveContainer>
  );
}
