import { useState } from 'react';
import { Card, MetricCard } from '../components/Card';
import { SmartUpload } from '../components/SmartUpload';
import { Spinner } from '../components/Spinner';
import { ChannelBarChart } from '../components/charts/ChannelBarChart';
import { DonutChart } from '../components/charts/DonutChart';
import { useEngine } from '../hooks/useEngine';
import type { ChannelOptimizerOutput } from '@openagency/types';
import { toChannelInput } from '@openagency/core/data/platform-detect';
import { ExportButton } from '../components/ExportButton';

const COLORS = ['#0077e6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const DEMO_INPUT = {
  total_budget: 500_000,
  channels: [
    { name: 'Search', spend: 150_000 },
    { name: 'Social', spend: 120_000 },
    { name: 'Display', spend: 100_000 },
    { name: 'Video', spend: 80_000 },
    { name: 'Email', spend: 50_000 },
  ],
};

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

export function MediaArchitectPage() {
  const { run, result, loading, error } = useEngine<ChannelOptimizerOutput>(
    'media-architect',
    'channel-optimize',
  );
  const [inputData, setInputData] = useState(DEMO_INPUT);

  const data = result?.data;

  const barData = data
    ? data.channels.map((ch, i) => ({
        name: ch.channel,
        current: inputData.channels[i]?.spend ?? 0,
        optimized: ch.spend,
      }))
    : [];

  const donutData = data
    ? data.channels.map((ch, i) => ({
        name: ch.channel,
        value: ch.spend,
        color: COLORS[i % COLORS.length] ?? '#64748b',
      }))
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Media Architect</h2>
        <p className="mt-1 text-sm text-gray-500">
          Optimize budget allocation across channels using Hill saturation curves.
        </p>
      </div>

      {/* Input */}
      <Card title="Data Input">
        <div className="space-y-4">
          <button
            onClick={() => run(inputData)}
            disabled={loading}
            className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-100 disabled:opacity-50"
          >
            Demo: $500K 5-Channel Mix
          </button>
          <SmartUpload
            transformFn={toChannelInput}
            onAnalyze={(d) => {
              setInputData(d as typeof DEMO_INPUT);
              run(d);
            }}
            onRawJson={(d) => {
              setInputData(d as typeof DEMO_INPUT);
              run(d);
            }}
          />
        </div>
      </Card>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Spinner className="h-8 w-8" />
          <span className="ml-3 text-sm text-gray-500">Optimizing channel allocation...</span>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {data && !loading && (
        <>
          {/* KPI */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <MetricCard label="Total Budget" value={fmt(data.total_budget)} color="blue" />
            <MetricCard label="Allocated" value={fmt(data.total_allocated)} color="blue" />
            <MetricCard
              label="Expected Response"
              value={data.total_expected_response.toFixed(2)}
              color="green"
            />
          </div>

          {/* Charts */}
          <div className="grid gap-6 lg:grid-cols-3">
            <Card title="Current vs Optimized Allocation" className="lg:col-span-2">
              <ChannelBarChart data={barData} />
            </Card>
            <Card title="Optimized Mix">
              <DonutChart
                data={donutData}
                centerLabel="Budget"
                centerValue={fmt(data.total_allocated)}
              />
            </Card>
          </div>

          {/* Channel detail table */}
          <Card title="Channel Details">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    <th className="pb-3 pr-4">Channel</th>
                    <th className="pb-3 pr-4 text-right">Spend</th>
                    <th className="pb-3 pr-4 text-right">% of Budget</th>
                    <th className="pb-3 pr-4 text-right">Expected Response</th>
                    <th className="pb-3 pr-4 text-right">Marginal ROI</th>
                    <th className="pb-3 text-right">Saturation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.channels.map((ch) => (
                    <tr key={ch.channel}>
                      <td className="py-3 pr-4 font-medium text-gray-900">{ch.channel}</td>
                      <td className="py-3 pr-4 text-right text-gray-700">{fmt(ch.spend)}</td>
                      <td className="py-3 pr-4 text-right text-gray-700">{ch.spend_pct}%</td>
                      <td className="py-3 pr-4 text-right text-gray-700">
                        {ch.expected_response.toFixed(2)}
                      </td>
                      <td className="py-3 pr-4 text-right text-gray-700">
                        {ch.marginal_roi.toFixed(4)}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-2 w-20 rounded-full bg-gray-200">
                            <div
                              className={`h-2 rounded-full ${
                                ch.saturation_pct > 80 ? 'bg-red-500' : ch.saturation_pct > 50 ? 'bg-yellow-500' : 'bg-green-500'
                              }`}
                              style={{ width: `${Math.min(ch.saturation_pct, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">{ch.saturation_pct}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="flex items-center justify-between">
            <ExportButton engineId="media-architect" skillId="channel-optimize" result={result} />
            {result?.duration_ms != null && (
              <p className="text-xs text-gray-400">Optimization completed in {result.duration_ms}ms</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
