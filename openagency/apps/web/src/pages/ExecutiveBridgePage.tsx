import { useState } from 'react';
import { Card, MetricCard } from '../components/Card';
import { SmartUpload } from '../components/SmartUpload';
import { Spinner } from '../components/Spinner';
import { DonutChart } from '../components/charts/DonutChart';
import { useEngine } from '../hooks/useEngine';
import type { RevenueBridgeOutput, ShapleyOutput } from '@openagency/types';
import { toRevenueBridgeInput } from '@openagency/core/data/platform-detect';
import { ExportButton } from '../components/ExportButton';

const COLORS = ['#0077e6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];

const DEMO_REVENUE = {
  channels: [
    { name: 'Search', spend: 150_000, impressions: 3_000_000, clicks: 150_000, conversions: 4_500, revenue: 675_000 },
    { name: 'Social', spend: 120_000, impressions: 8_000_000, clicks: 160_000, conversions: 1_600, revenue: 240_000 },
    { name: 'Display', spend: 80_000, impressions: 5_000_000, clicks: 25_000, conversions: 500, revenue: 75_000 },
    { name: 'Email', spend: 20_000, impressions: 200_000, clicks: 40_000, conversions: 2_000, revenue: 300_000 },
  ],
  aov: 150,
  retention_rate: 0.35,
  avg_customer_months: 18,
};

const DEMO_SHAPLEY = {
  channels: ['Search', 'Social', 'Display'],
  coalition_conversions: {
    '{}': 0,
    '{Search}': 1200,
    '{Social}': 400,
    '{Display}': 200,
    '{Search,Social}': 2000,
    '{Search,Display}': 1600,
    '{Social,Display}': 700,
    '{Search,Social,Display}': 2500,
  },
  total_conversions: 2500,
};

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}

export function ExecutiveBridgePage() {
  const revenueEngine = useEngine<RevenueBridgeOutput>('executive-bridge', 'revenue-translate');
  const shapleyEngine = useEngine<ShapleyOutput>('executive-bridge', 'shapley-attribute');
  const [activeTab, setActiveTab] = useState<'revenue' | 'shapley'>('revenue');

  const revenue = revenueEngine.result?.data;
  const shapley = shapleyEngine.result?.data;
  const loading = revenueEngine.loading || shapleyEngine.loading;

  const shapleyDonut = shapley
    ? shapley.channels.map((ch, i) => ({
        name: ch.channel,
        value: Math.round(ch.shapley_value),
        color: COLORS[i % COLORS.length] ?? '#64748b',
      }))
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Executive Bridge</h2>
        <p className="mt-1 text-sm text-gray-500">
          Translate media metrics to financial KPIs and attribution insights for C-Suite.
        </p>
      </div>

      {/* Input */}
      <Card title="Quick Actions">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => revenueEngine.run(DEMO_REVENUE)}
              disabled={loading}
              className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-100 disabled:opacity-50"
            >
              Demo: Revenue Bridge
            </button>
            <button
              onClick={() => shapleyEngine.run(DEMO_SHAPLEY)}
              disabled={loading}
              className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-100 disabled:opacity-50"
            >
              Demo: Shapley Attribution
            </button>
          </div>
          <SmartUpload
            transformFn={toRevenueBridgeInput}
            onAnalyze={(d) => revenueEngine.run(d)}
            onRawJson={(d) => revenueEngine.run(d)}
          />
        </div>
      </Card>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Spinner className="h-8 w-8" />
        </div>
      )}

      {/* Tabs */}
      {(revenue ?? shapley) && !loading && (
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          {(['revenue', 'shapley'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab === 'revenue' ? 'Revenue Bridge' : 'Shapley Attribution'}
            </button>
          ))}
        </div>
      )}

      {/* Revenue Bridge */}
      {activeTab === 'revenue' && revenue && !loading && (
        <>
          <ExportButton engineId="executive-bridge" skillId="revenue-translate" result={revenueEngine.result ?? null} />
          {/* L1 Financial KPIs */}
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
              L1 - Financial Metrics
            </h3>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
              <MetricCard label="CAC" value={fmt(revenue.l1_metrics.cac)} color="blue" />
              <MetricCard label="CLV" value={fmt(revenue.l1_metrics.clv)} color="green" />
              <MetricCard
                label="CLV:CAC"
                value={`${revenue.l1_metrics.clv_cac_ratio.toFixed(1)}x`}
                sub={revenue.l1_metrics.clv_cac_ratio >= 3 ? 'Healthy' : 'Below target'}
                color={revenue.l1_metrics.clv_cac_ratio >= 3 ? 'green' : 'red'}
              />
              <MetricCard label="ROI" value={pct(revenue.l1_metrics.roi_pct)} color="green" />
              <MetricCard
                label="Marketing Margin"
                value={pct(revenue.l1_metrics.marketing_margin_pct)}
                color="blue"
              />
            </div>
          </div>

          {/* Efficiency score */}
          <Card title="Efficiency Score">
            <div className="flex items-center gap-4">
              <div className="relative h-24 w-24">
                <svg className="h-24 w-24 -rotate-90" viewBox="0 0 36 36">
                  <path
                    d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#e5e7eb"
                    strokeWidth="3"
                  />
                  <path
                    d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke={revenue.efficiency_score >= 70 ? '#22c55e' : revenue.efficiency_score >= 40 ? '#f59e0b' : '#ef4444'}
                    strokeWidth="3"
                    strokeDasharray={`${revenue.efficiency_score}, 100`}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-lg font-bold">
                  {revenue.efficiency_score}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {revenue.efficiency_score >= 70 ? 'Strong' : revenue.efficiency_score >= 40 ? 'Moderate' : 'Needs Improvement'}
                </p>
                <p className="text-xs text-gray-500">
                  Based on CLV:CAC ratio, ROAS, and marketing margin
                </p>
              </div>
            </div>
          </Card>

          {/* Channel breakdown */}
          <Card title="Channel Performance">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    <th className="pb-3 pr-4">Channel</th>
                    <th className="pb-3 pr-4 text-right">CPA</th>
                    <th className="pb-3 pr-4 text-right">ROAS</th>
                    <th className="pb-3 pr-4 text-right">Conversions</th>
                    <th className="pb-3 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {revenue.channels.map((ch) => (
                    <tr key={ch.channel}>
                      <td className="py-3 pr-4 font-medium text-gray-900">{ch.channel}</td>
                      <td className="py-3 pr-4 text-right text-gray-700">{fmt(ch.l2_metrics.cpa)}</td>
                      <td className="py-3 pr-4 text-right text-gray-700">{ch.l2_metrics.roas.toFixed(2)}x</td>
                      <td className="py-3 pr-4 text-right text-gray-700">
                        {ch.l2_metrics.conversions.toLocaleString()}
                      </td>
                      <td className="py-3 text-right font-medium text-gray-900">
                        {fmt(ch.l2_metrics.aov * ch.l2_metrics.conversions)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* C-Suite Summary */}
          <div className="grid gap-4 md:grid-cols-3">
            {(['ceo', 'cfo', 'cmo'] as const).map((role) => (
              <Card key={role} title={role.toUpperCase()}>
                <p className="text-sm leading-relaxed text-gray-700">
                  {revenue.csuite_summary[role]}
                </p>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Shapley Attribution */}
      {activeTab === 'shapley' && shapley && !loading && (
        <>
          <ExportButton engineId="executive-bridge" skillId="shapley-attribute" result={shapleyEngine.result ?? null} />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <MetricCard
              label="Total Conversions"
              value={shapley.total_conversions.toLocaleString()}
              color="blue"
            />
            <MetricCard
              label="Shapley Total"
              value={shapley.shapley_total.toLocaleString()}
              color="blue"
            />
            <MetricCard
              label="Channels"
              value={String(shapley.channels.length)}
              color="blue"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card title="Attribution Share" className="lg:col-span-1">
              <DonutChart
                data={shapleyDonut}
                centerLabel="Conversions"
                centerValue={shapley.total_conversions.toLocaleString()}
              />
            </Card>
            <Card title="Shapley vs Last Click" className="lg:col-span-2">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      <th className="pb-3 pr-4">Channel</th>
                      <th className="pb-3 pr-4 text-right">Shapley Value</th>
                      <th className="pb-3 pr-4 text-right">Shapley %</th>
                      <th className="pb-3 pr-4 text-right">Last Click %</th>
                      <th className="pb-3 text-right">Difference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {shapley.channels.map((ch) => (
                      <tr key={ch.channel}>
                        <td className="py-3 pr-4 font-medium text-gray-900">{ch.channel}</td>
                        <td className="py-3 pr-4 text-right text-gray-700">
                          {Math.round(ch.shapley_value).toLocaleString()}
                        </td>
                        <td className="py-3 pr-4 text-right text-gray-700">
                          {pct(ch.shapley_share_pct)}
                        </td>
                        <td className="py-3 pr-4 text-right text-gray-700">
                          {pct(ch.last_click_share_pct)}
                        </td>
                        <td className="py-3 text-right">
                          <span
                            className={`font-medium ${
                              ch.credit_status === 'under-credited by last-click'
                                ? 'text-red-600'
                                : ch.credit_status === 'over-credited by last-click'
                                  ? 'text-yellow-600'
                                  : 'text-green-600'
                            }`}
                          >
                            {ch.difference_pct > 0 ? '+' : ''}
                            {pct(ch.difference_pct)}
                          </span>
                          <span className="ml-1 text-xs text-gray-400">{ch.credit_status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
