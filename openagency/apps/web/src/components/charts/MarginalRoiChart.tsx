import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import type { RoiInterval } from '@openagency/types';

const COLORS = ['#0077e6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

interface Props {
  intervals: RoiInterval[];
}

export function MarginalRoiChart({ intervals }: Props) {
  const data = intervals
    .map((item) => ({
      channel: item.channel,
      mroi: item.mroi,
    }))
    .sort((a, b) => b.mroi - a.mroi);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        <XAxis dataKey="channel" fontSize={11} stroke="#9ca3af" />
        <YAxis
          label={{ value: 'Marginal ROI', angle: -90, position: 'insideLeft', offset: 5, fontSize: 11 }}
          stroke="#9ca3af"
          fontSize={11}
        />
        <Tooltip formatter={(val: number) => [val.toFixed(4) + 'x', 'mROI']} />
        <ReferenceLine y={1} stroke="#ef4444" strokeDasharray="3 3" label={{ value: '1.0x', fontSize: 10, fill: '#ef4444' }} />
        <Bar dataKey="mroi" radius={[4, 4, 0, 0]} barSize={36}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
