import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ReferenceDot, ResponsiveContainer,
} from 'recharts';
import type { ResponseCurveData } from '@openagency/types';

const COLORS = ['#0077e6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

interface Props {
  curves: ResponseCurveData[];
}

function fmtK(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(0)}K` : n.toFixed(0);
}

export function ResponseCurveChart({ curves }: Props) {
  // Merge all points into a unified dataset keyed by spend
  const spendSet = new Set<number>();
  for (const curve of curves) {
    for (const p of curve.points) spendSet.add(p.spend);
  }
  const spends = Array.from(spendSet).sort((a, b) => a - b);

  const data = spends.map((spend) => {
    const row: Record<string, number> = { spend };
    for (const curve of curves) {
      const pt = curve.points.find((p) => p.spend === spend);
      if (pt) row[curve.channel] = pt.response;
    }
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={360}>
      <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        <XAxis
          dataKey="spend"
          tickFormatter={fmtK}
          label={{ value: 'Spend', position: 'insideBottomRight', offset: -5, fontSize: 11 }}
          stroke="#9ca3af"
          fontSize={11}
        />
        <YAxis
          tickFormatter={fmtK}
          label={{ value: 'Response', angle: -90, position: 'insideLeft', offset: 5, fontSize: 11 }}
          stroke="#9ca3af"
          fontSize={11}
        />
        <Tooltip
          formatter={(val: number) => [`$${val.toLocaleString()}`, undefined]}
          labelFormatter={(val: number) => `Spend: $${val.toLocaleString()}`}
        />
        <Legend />
        {curves.map((curve, i) => (
          <Line
            key={curve.channel}
            type="monotone"
            dataKey={curve.channel}
            stroke={COLORS[i % COLORS.length]}
            strokeWidth={2}
            dot={false}
          />
        ))}
        {/* Current spend markers */}
        {curves.map((curve, i) => (
          <ReferenceDot
            key={`dot-${curve.channel}`}
            x={curve.current_spend}
            y={curve.current_response}
            r={6}
            fill={COLORS[i % COLORS.length]}
            stroke="#fff"
            strokeWidth={2}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
