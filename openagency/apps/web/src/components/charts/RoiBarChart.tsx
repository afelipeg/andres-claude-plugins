import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ErrorBar, ResponsiveContainer, Cell,
} from 'recharts';
import type { RoiInterval } from '@openagency/types';

const COLORS = ['#0077e6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

interface Props {
  intervals: RoiInterval[];
  metric?: 'roi' | 'mroi';
}

export function RoiBarChart({ intervals, metric = 'roi' }: Props) {
  const data = intervals.map((item) => {
    const val = metric === 'roi' ? item.roi : item.mroi;
    const lo = metric === 'roi' ? item.lower_ci : item.mroi_lower_ci;
    const hi = metric === 'roi' ? item.upper_ci : item.mroi_upper_ci;
    return {
      channel: item.channel,
      value: val,
      errorLow: val - lo,
      errorHigh: hi - val,
    };
  }).sort((a, b) => b.value - a.value);

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 50 + 40)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 5, right: 30, bottom: 5, left: 80 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
        <XAxis
          type="number"
          label={{ value: metric === 'roi' ? 'ROI' : 'Marginal ROI', position: 'insideBottomRight', offset: -5, fontSize: 11 }}
          stroke="#9ca3af"
          fontSize={11}
        />
        <YAxis
          dataKey="channel"
          type="category"
          stroke="#9ca3af"
          fontSize={11}
          width={75}
        />
        <Tooltip
          formatter={(val: number) => [val.toFixed(2) + 'x', metric === 'roi' ? 'ROI' : 'mROI']}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
          <ErrorBar
            dataKey="errorHigh"
            width={4}
            strokeWidth={2}
            stroke="#374151"
            direction="x"
          />
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
