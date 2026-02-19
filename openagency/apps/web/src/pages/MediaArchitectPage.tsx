import { useState } from 'react';
import { Card, MetricCard } from '../components/Card';
import { SmartUpload } from '../components/SmartUpload';
import { Spinner } from '../components/Spinner';
import { ChannelBarChart } from '../components/charts/ChannelBarChart';
import { DonutChart } from '../components/charts/DonutChart';
import { ResponseCurveChart } from '../components/charts/ResponseCurveChart';
import { ContributionWaterfallChart } from '../components/charts/ContributionWaterfallChart';
import { RoiBarChart } from '../components/charts/RoiBarChart';
import { ModelFitChart } from '../components/charts/ModelFitChart';
import { MarginalRoiChart } from '../components/charts/MarginalRoiChart';
import { BudgetOptChart } from '../components/charts/BudgetOptChart';
import { ExportButton } from '../components/ExportButton';
import { useEngine } from '../hooks/useEngine';
import type { ChannelOptimizerOutput, MMMModelOutput, MMMOptimizeOutput } from '@openagency/types';
import { toChannelInput } from '@openagency/core/data/platform-detect';

const COLORS = ['#0077e6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const DEMO_CHANNEL = {
  total_budget: 500_000,
  channels: [
    { name: 'Search', spend: 150_000 },
    { name: 'Social', spend: 120_000 },
    { name: 'Display', spend: 100_000 },
    { name: 'Video', spend: 80_000 },
    { name: 'Email', spend: 50_000 },
  ],
};

const DEMO_MMM = {
  total_budget: 500_000,
  total_kpi: 2_000_000,
  time_periods: 104,
  channels: [
    { name: 'Search', spend: 150_000, roi_prior: 4.5 },
    { name: 'Social (Meta)', spend: 120_000, roi_prior: 2.8, decay_rate: 0.3 },
    { name: 'Display', spend: 100_000, roi_prior: 1.5, decay_rate: 0.5 },
    { name: 'Video (YouTube)', spend: 80_000, roi_prior: 2.0, decay_rate: 0.6 },
    { name: 'Email', spend: 50_000, roi_prior: 8.0, decay_rate: 0.15 },
  ],
};

const DEMO_OPT = {
  total_budget: 500_000,
  channels: [
    { name: 'Search', spend: 150_000, roi_prior: 4.5 },
    { name: 'Social (Meta)', spend: 120_000, roi_prior: 2.8, decay_rate: 0.3 },
    { name: 'Display', spend: 100_000, roi_prior: 1.5, decay_rate: 0.5 },
    { name: 'Video (YouTube)', spend: 80_000, roi_prior: 2.0, decay_rate: 0.6 },
    { name: 'Email', spend: 50_000, roi_prior: 8.0, decay_rate: 0.15 },
  ],
};

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}

type Tab = 'channel' | 'mmm' | 'curves' | 'roi';

export function MediaArchitectPage() {
  const channelEngine = useEngine<ChannelOptimizerOutput>('media-architect', 'channel-optimize');
  const mmmEngine = useEngine<MMMModelOutput>('media-architect', 'mmm-model');
  const optEngine = useEngine<MMMOptimizeOutput>('media-architect', 'mmm-optimize');
  const [inputData, setInputData] = useState(DEMO_CHANNEL);
  const [activeTab, setActiveTab] = useState<Tab>('channel');

  const channelData = channelEngine.result?.data;
  const mmmData = mmmEngine.result?.data;
  const optData = optEngine.result?.data;
  const loading = channelEngine.loading || mmmEngine.loading || optEngine.loading;

  const barData = channelData
    ? channelData.channels.map((ch, i) => ({
        name: ch.channel,
        current: inputData.channels[i]?.spend ?? 0,
        optimized: ch.spend,
      }))
    : [];

  const donutData = channelData
    ? channelData.channels.map((ch, i) => ({
        name: ch.channel,
        value: ch.spend,
        color: COLORS[i % COLORS.length] ?? '#64748b',
      }))
    : [];

  const TABS: { key: Tab; label: string }[] = [
    { key: 'channel', label: 'Channel Optimize' },
    { key: 'mmm', label: 'MMM Model' },
    { key: 'curves', label: 'Response Curves' },
    { key: 'roi', label: 'ROI Analysis' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Media Architect</h2>
        <p className="mt-1 text-sm text-gray-500">
          Optimize budget allocation, run Marketing Mix Models, and analyze response curves.
        </p>
      </div>

      {/* Input */}
      <Card title="Data Input">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { channelEngine.run(inputData); setActiveTab('channel'); }}
              disabled={loading}
              className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-100 disabled:opacity-50"
            >
              Demo: Channel Optimize
            </button>
            <button
              onClick={() => { mmmEngine.run(DEMO_MMM); setActiveTab('mmm'); }}
              disabled={loading}
              className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-50"
            >
              Demo: MMM Model
            </button>
            <button
              onClick={() => { optEngine.run(DEMO_OPT); setActiveTab('roi'); }}
              disabled={loading}
              className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 transition-colors hover:bg-green-100 disabled:opacity-50"
            >
              Demo: Budget Optimization
            </button>
          </div>
          <SmartUpload
            transformFn={toChannelInput}
            onAnalyze={(d) => {
              setInputData(d as typeof DEMO_CHANNEL);
              channelEngine.run(d);
              setActiveTab('channel');
            }}
            onRawJson={(d) => {
              setInputData(d as typeof DEMO_CHANNEL);
              channelEngine.run(d);
              setActiveTab('channel');
            }}
          />
        </div>
      </Card>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Spinner className="h-8 w-8" />
          <span className="ml-3 text-sm text-gray-500">Running analysis...</span>
        </div>
      )}

      {channelEngine.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{channelEngine.error}</div>
      )}
      {mmmEngine.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{mmmEngine.error}</div>
      )}

      {/* Tabs */}
      {(channelData ?? mmmData ?? optData) && !loading && (
        <>
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ─── Tab: Channel Optimize ─────────────────────────── */}
          {activeTab === 'channel' && channelData && (
            <>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                <MetricCard label="Total Budget" value={fmt(channelData.total_budget)} color="blue" />
                <MetricCard label="Allocated" value={fmt(channelData.total_allocated)} color="blue" />
                <MetricCard label="Expected Response" value={channelData.total_expected_response.toFixed(2)} color="green" />
              </div>

              <div className="grid gap-6 lg:grid-cols-3">
                <Card title="Current vs Optimized" className="lg:col-span-2">
                  <ChannelBarChart data={barData} />
                </Card>
                <Card title="Optimized Mix">
                  <DonutChart data={donutData} centerLabel="Budget" centerValue={fmt(channelData.total_allocated)} />
                </Card>
              </div>

              <Card title="Channel Details">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        <th className="pb-3 pr-4">Channel</th>
                        <th className="pb-3 pr-4 text-right">Spend</th>
                        <th className="pb-3 pr-4 text-right">% Budget</th>
                        <th className="pb-3 pr-4 text-right">Response</th>
                        <th className="pb-3 pr-4 text-right">Marginal ROI</th>
                        <th className="pb-3 text-right">Saturation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {channelData.channels.map((ch) => (
                        <tr key={ch.channel}>
                          <td className="py-3 pr-4 font-medium text-gray-900">{ch.channel}</td>
                          <td className="py-3 pr-4 text-right text-gray-700">{fmt(ch.spend)}</td>
                          <td className="py-3 pr-4 text-right text-gray-700">{ch.spend_pct}%</td>
                          <td className="py-3 pr-4 text-right text-gray-700">{ch.expected_response.toFixed(2)}</td>
                          <td className="py-3 pr-4 text-right text-gray-700">{ch.marginal_roi.toFixed(4)}</td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="h-2 w-20 rounded-full bg-gray-200">
                                <div
                                  className={`h-2 rounded-full ${ch.saturation_pct > 80 ? 'bg-red-500' : ch.saturation_pct > 50 ? 'bg-yellow-500' : 'bg-green-500'}`}
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
                <ExportButton engineId="media-architect" skillId="channel-optimize" result={channelEngine.result ?? null} />
                {channelEngine.result?.duration_ms != null && (
                  <p className="text-xs text-gray-400">Completed in {channelEngine.result.duration_ms}ms</p>
                )}
              </div>
            </>
          )}

          {/* ─── Tab: MMM Model ───────────────────────────────── */}
          {activeTab === 'mmm' && mmmData && (
            <>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <MetricCard label="Total KPI" value={fmt(mmmData.total_kpi)} color="blue" />
                <MetricCard label="Predicted KPI" value={fmt(mmmData.predicted_kpi)} color="blue" />
                <MetricCard label="R-squared" value={mmmData.r_squared_estimate.toFixed(3)} color={mmmData.r_squared_estimate >= 0.85 ? 'green' : 'yellow'} />
                <MetricCard label="Overall ROI" value={`${mmmData.overall_roi.toFixed(2)}x`} color="green" />
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card title="Model Fit: Actual vs Predicted">
                  <ModelFitChart fit={mmmData.model_fit} />
                </Card>
                <Card title="KPI Decomposition">
                  <ContributionWaterfallChart entries={mmmData.contribution_waterfall} totalKpi={mmmData.predicted_kpi} />
                </Card>
              </div>

              <Card title="Channel Model Parameters">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        <th className="pb-3 pr-4">Channel</th>
                        <th className="pb-3 pr-4 text-right">Spend</th>
                        <th className="pb-3 pr-4 text-right">Contribution</th>
                        <th className="pb-3 pr-4 text-right">Share %</th>
                        <th className="pb-3 pr-4 text-right">ROI</th>
                        <th className="pb-3 pr-4 text-right">mROI</th>
                        <th className="pb-3 text-right">Saturation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {mmmData.channel_models.map((cm) => (
                        <tr key={cm.channel}>
                          <td className="py-3 pr-4 font-medium text-gray-900">{cm.channel}</td>
                          <td className="py-3 pr-4 text-right text-gray-700">{fmt(cm.spend)}</td>
                          <td className="py-3 pr-4 text-right text-gray-700">{fmt(cm.results.estimated_contribution)}</td>
                          <td className="py-3 pr-4 text-right text-gray-700">{pct(cm.results.contribution_share_pct)}</td>
                          <td className="py-3 pr-4 text-right font-medium text-green-600">{cm.results.roi.toFixed(2)}x</td>
                          <td className="py-3 pr-4 text-right text-gray-700">{cm.results.marginal_roi.toFixed(4)}</td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="h-2 w-20 rounded-full bg-gray-200">
                                <div
                                  className={`h-2 rounded-full ${cm.results.saturation_pct > 80 ? 'bg-red-500' : cm.results.saturation_pct > 50 ? 'bg-yellow-500' : 'bg-green-500'}`}
                                  style={{ width: `${Math.min(cm.results.saturation_pct, 100)}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-500">{cm.results.saturation_pct.toFixed(1)}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              <div className="flex items-center justify-between">
                <ExportButton engineId="media-architect" skillId="mmm-model" result={mmmEngine.result ?? null} />
                {mmmEngine.result?.duration_ms != null && (
                  <p className="text-xs text-gray-400">Completed in {mmmEngine.result.duration_ms}ms</p>
                )}
              </div>
            </>
          )}

          {/* ─── Tab: Response Curves ─────────────────────────── */}
          {activeTab === 'curves' && mmmData && (
            <>
              <Card title="Response Curves by Channel">
                <p className="mb-4 text-xs text-gray-500">
                  Dots mark current spend. Curves show diminishing returns — flatten means saturation.
                </p>
                <ResponseCurveChart curves={mmmData.response_curves} />
              </Card>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card title="Marginal ROI by Channel">
                  <p className="mb-3 text-xs text-gray-500">
                    Where is your next dollar most efficient? Above 1.0x = still generating returns.
                  </p>
                  <MarginalRoiChart intervals={mmmData.roi_intervals} />
                </Card>
                <Card title="Channel Contribution Share">
                  <DonutChart
                    data={mmmData.contribution_waterfall
                      .filter((e) => e.channel !== 'Base (Non-Media)')
                      .map((e, i) => ({
                        name: e.channel,
                        value: e.contribution,
                        color: COLORS[i % COLORS.length] ?? '#64748b',
                      }))}
                    centerLabel="Media"
                    centerValue={pct(mmmData.media_contribution_pct)}
                  />
                </Card>
              </div>
            </>
          )}

          {/* ─── Tab: ROI Analysis ────────────────────────────── */}
          {activeTab === 'roi' && (
            <>
              {mmmData && (
                <div className="grid gap-6 lg:grid-cols-2">
                  <Card title="ROI by Channel (with Credible Intervals)">
                    <RoiBarChart intervals={mmmData.roi_intervals} metric="roi" />
                  </Card>
                  <Card title="Marginal ROI by Channel">
                    <RoiBarChart intervals={mmmData.roi_intervals} metric="mroi" />
                  </Card>
                </div>
              )}

              {optData && optData.comparison_vs_current && (
                <Card title="Budget Optimization: Current vs Recommended">
                  <BudgetOptChart
                    reallocation={optData.comparison_vs_current.reallocation}
                    kpiLiftPct={optData.comparison_vs_current.kpi_lift_pct}
                  />
                </Card>
              )}

              {optData && optData.recommendations && optData.recommendations.length > 0 && (
                <Card title="Recommendations">
                  <div className="space-y-2">
                    {optData.recommendations.map((rec, i) => (
                      <div
                        key={i}
                        className={`rounded-lg border p-3 text-sm ${
                          rec.priority === 'high'
                            ? 'border-red-200 bg-red-50 text-red-700'
                            : 'border-yellow-200 bg-yellow-50 text-yellow-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium uppercase">{rec.priority}</span>
                        </div>
                        <p className="mt-1">{rec.action}</p>
                        <p className="mt-1 text-xs opacity-75">{rec.impact}</p>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {!mmmData && !optData && (
                <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
                  <p className="text-sm text-gray-500">Run the MMM Model or Budget Optimization demo first to see ROI analysis.</p>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
