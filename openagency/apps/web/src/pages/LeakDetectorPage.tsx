import { useState } from 'react';
import { Card, MetricCard } from '../components/Card';
import { SmartUpload } from '../components/SmartUpload';
import { Spinner } from '../components/Spinner';
import { WaterfallChart } from '../components/charts/WaterfallChart';
import { DonutChart } from '../components/charts/DonutChart';
import { useEngine } from '../hooks/useEngine';
import type { WasteWaterfallOutput } from '@openagency/types';
import {
  SAMPLE_WASTE_SMALL,
  SAMPLE_WASTE_MEDIUM,
  SAMPLE_WASTE_LARGE,
} from '@openagency/core/data/sample-data';
import { toWasteInput } from '@openagency/core/data/platform-detect';
import { ExportButton } from '../components/ExportButton';

const DEMOS = [
  { label: '$50K Retail', data: SAMPLE_WASTE_SMALL },
  { label: '$500K Retail', data: SAMPLE_WASTE_MEDIUM },
  { label: '$2M Retail', data: SAMPLE_WASTE_LARGE },
] as const;

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}

export function LeakDetectorPage() {
  const { run, result, loading, error } = useEngine<WasteWaterfallOutput>(
    'leak-detector',
    'waste-waterfall',
  );
  const [activeTab, setActiveTab] = useState<'chart' | 'roadmap' | 'csuite'>('chart');

  const data = result?.data;

  const donutData = data
    ? [
        { name: 'Productive', value: data.productive_spend.amount, color: '#22c55e' },
        { name: 'Waste', value: data.waste_summary.total_waste, color: '#ef4444' },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Leak Detector</h2>
        <p className="mt-1 text-sm text-gray-500">
          Find where your ad budget leaks money with the waste waterfall analysis.
        </p>
      </div>

      {/* Input section */}
      <Card title="Data Input">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {DEMOS.map((d) => (
              <button
                key={d.label}
                onClick={() => run(d.data)}
                disabled={loading}
                className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50"
              >
                Demo: {d.label}
              </button>
            ))}
          </div>
          <SmartUpload
            transformFn={toWasteInput}
            onAnalyze={(d) => run(d)}
            onRawJson={(d) => run(d)}
          />
        </div>
      </Card>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Spinner className="h-8 w-8" />
          <span className="ml-3 text-sm text-gray-500">Running waste waterfall analysis...</span>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {typeof error === 'string' ? error : JSON.stringify(error)}
        </div>
      )}

      {data && !loading && (
        <>
          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <MetricCard label="Gross Spend" value={fmt(data.gross_spend)} color="blue" />
            <MetricCard
              label="Total Waste"
              value={fmt(data.waste_summary.total_waste)}
              sub={pct(data.waste_summary.waste_pct)}
              color="red"
            />
            <MetricCard
              label="Productive Spend"
              value={fmt(data.productive_spend.amount)}
              sub={pct(data.productive_spend.pct)}
              color="green"
            />
            {data.roi_impact && (
              <MetricCard
                label="ROAS Improvement"
                value={`+${pct(data.roi_impact.improvement_potential_pct)}`}
                sub={`Productive ROAS: ${data.roi_impact.productive_roas.toFixed(2)}x`}
                color="green"
              />
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
            {(['chart', 'roadmap', 'csuite'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab === 'chart' && 'Waterfall Chart'}
                {tab === 'roadmap' && 'Recovery Roadmap'}
                {tab === 'csuite' && 'C-Suite Summary'}
              </button>
            ))}
          </div>

          {/* Waterfall Chart tab */}
          {activeTab === 'chart' && (
            <div className="grid gap-6 lg:grid-cols-3">
              <Card title="Waste Waterfall" className="lg:col-span-2">
                <WaterfallChart
                  stages={data.waterfall}
                  grossSpend={data.gross_spend}
                  productiveSpend={data.productive_spend.amount}
                />
              </Card>
              <Card title="Spend Breakdown">
                <DonutChart
                  data={donutData}
                  centerLabel="Waste"
                  centerValue={pct(data.waste_summary.waste_pct)}
                />
                <div className="mt-4 space-y-2">
                  {data.waterfall.map((s) => (
                    <div key={s.category} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{s.label}</span>
                      <div className="text-right">
                        <span className={s.vs_benchmark === 'above' ? 'font-medium text-red-600' : 'text-yellow-600'}>
                          {fmt(s.waste_amount)}
                        </span>
                        <span className="ml-2 text-xs text-gray-400">
                          {pct(s.waste_pct)} vs {pct(s.benchmark_pct)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {/* Recovery Roadmap tab */}
          {activeTab === 'roadmap' && (
            <Card title="Recovery Roadmap">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      <th className="pb-3 pr-4">Action</th>
                      <th className="pb-3 pr-4">Category</th>
                      <th className="pb-3 pr-4">Est. Savings</th>
                      <th className="pb-3 pr-4">Difficulty</th>
                      <th className="pb-3">Timeline</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.recovery_roadmap.map((action, i) => (
                      <tr key={i}>
                        <td className="py-3 pr-4 font-medium text-gray-900">{action.action}</td>
                        <td className="py-3 pr-4 text-gray-600">{action.category}</td>
                        <td className="py-3 pr-4 font-medium text-green-600">
                          {fmt(action.estimated_savings)}
                        </td>
                        <td className="py-3 pr-4">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              action.difficulty === 'easy'
                                ? 'bg-green-100 text-green-700'
                                : action.difficulty === 'medium'
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {action.difficulty}
                          </span>
                        </td>
                        <td className="py-3 text-gray-600">{action.timeline}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* C-Suite tab */}
          {activeTab === 'csuite' && (
            <div className="grid gap-4 md:grid-cols-3">
              {(['ceo', 'cfo', 'cmo'] as const).map((role) => (
                <Card key={role} title={role.toUpperCase()}>
                  <p className="text-sm leading-relaxed text-gray-700">
                    {data.csuite_summary[role]}
                  </p>
                </Card>
              ))}
            </div>
          )}

          {/* Export + Timing */}
          <div className="flex items-center justify-between">
            <ExportButton engineId="leak-detector" skillId="waste-waterfall" result={result} />
            {result?.duration_ms != null && (
              <p className="text-xs text-gray-400">
                Analysis completed in {result.duration_ms}ms
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
