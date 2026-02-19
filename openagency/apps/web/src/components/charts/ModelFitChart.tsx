import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import type { ModelFitData } from '@openagency/types';

interface Props {
  fit: ModelFitData;
}

function fmtK(n: number): string {
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(0)}K` : n.toFixed(0);
}

export function ModelFitChart({ fit }: Props) {
  const data = fit.periods.map((period, i) => ({
    period,
    actual: fit.actual[i] ?? 0,
    predicted: fit.predicted[i] ?? 0,
  }));

  // Show every Nth label to avoid crowding
  const tickInterval = Math.max(1, Math.floor(data.length / 12));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        <XAxis
          dataKey="period"
          interval={tickInterval}
          fontSize={10}
          stroke="#9ca3af"
        />
        <YAxis tickFormatter={fmtK} stroke="#9ca3af" fontSize={11} />
        <Tooltip formatter={(val: number) => [`$${val.toLocaleString()}`, undefined]} />
        <Legend />
        <Line
          type="monotone"
          dataKey="actual"
          stroke="#111827"
          strokeWidth={2}
          dot={false}
          name="Actual KPI"
        />
        <Line
          type="monotone"
          dataKey="predicted"
          stroke="#0077e6"
          strokeWidth={2}
          strokeDasharray="6 3"
          dot={false}
          name="Predicted KPI"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
