import { useState, useEffect, useRef } from 'react';
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
import { toChannelInput, toMMMInput } from '@openagency/core/data/platform-detect';
import {
  GlassCard,
  GlassCardHeader,
  GlassCardTitle,
  GlassCardContent,
  GlassTabs,
  GlassTabsList,
  GlassTabsTrigger,
  GlassTabsContent,
  GlassButton,
  GlassTable,
  GlassTableHeader,
  GlassTableBody,
  GlassTableRow,
  GlassTableHead,
  GlassTableCell,

  StatCard,
  StatsGrid,
} from '../components/ui/glass';

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
  const [activeTab, setActiveTab] = useState<string>('channel');

  // Auto-load demo data on mount
  const autoLoaded = useRef(false);
  useEffect(() => {
    if (!autoLoaded.current) {
      autoLoaded.current = true;
      channelEngine.run(DEMO_CHANNEL);
      mmmEngine.run(DEMO_MMM);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        <h2 className="text-2xl font-bold text-white">Media Architect</h2>
        <p className="mt-1 text-sm text-white/50">
          Optimize budget allocation, run Marketing Mix Models, and analyze response curves.
        </p>
      </div>

      {/* Input */}
      <GlassCard>
        <GlassCardHeader>
          <GlassCardTitle>Data Input</GlassCardTitle>
        </GlassCardHeader>
        <GlassCardContent>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <GlassButton
                variant="outline"
                size="sm"
                onClick={() => { channelEngine.run(inputData); setActiveTab('channel'); }}
                disabled={loading}
              >
                Demo: Channel Optimize
              </GlassButton>
              <GlassButton
                variant="outline"
                size="sm"
                onClick={() => { mmmEngine.run(DEMO_MMM); setActiveTab('mmm'); }}
                disabled={loading}
              >
                Demo: MMM Model
              </GlassButton>
              <GlassButton
                variant="primary"
                size="sm"
                onClick={() => { optEngine.run(DEMO_OPT); setActiveTab('roi'); }}
                disabled={loading}
              >
                Demo: Budget Optimization
              </GlassButton>
            </div>
            <SmartUpload
              transformFn={(rows, opts) => {
                const channelInput = toChannelInput(rows, opts);
                const mmmInput = toMMMInput(rows, opts);
                setTimeout(() => mmmEngine.run(mmmInput), 50);
                return channelInput;
              }}
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
        </GlassCardContent>
      </GlassCard>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Spinner className="h-8 w-8" />
          <span className="ml-3 text-sm text-white/50">Running analysis...</span>
        </div>
      )}

      {channelEngine.error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">{channelEngine.error}</div>
      )}
      {mmmEngine.error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">{mmmEngine.error}</div>
      )}

      {/* Tabs */}
      {(channelData ?? mmmData ?? optData) && !loading && (
        <GlassTabs defaultValue="" value={activeTab} onValueChange={setActiveTab}>
          <GlassTabsList>
            {TABS.map((tab) => (
              <GlassTabsTrigger key={tab.key} value={tab.key}>
                {tab.label}
              </GlassTabsTrigger>
            ))}
          </GlassTabsList>

          {/* Tab: Channel Optimize */}
          <GlassTabsContent value="channel">
            {channelData && (
              <>
                <StatsGrid columns={3}>
                </StatsGrid>

                <div className="grid gap-6 lg:grid-cols-3 mt-6">
                  <GlassCard className="lg:col-span-2">
                    <GlassCardHeader><GlassCardTitle>Current vs Optimized</GlassCardTitle></GlassCardHeader>
                    <GlassCardContent><ChannelBarChart data={barData} /></GlassCardContent>
                  </GlassCard>
                  <GlassCard>
                    <GlassCardHeader><GlassCardTitle>Optimized Mix</GlassCardTitle></GlassCardHeader>
                    <GlassCardContent><DonutChart data={donutData} centerLabel="Budget" centerValue={fmt(channelData.total_allocated)} /></GlassCardContent>
                  </GlassCard>
                </div>

                <GlassCard className="mt-6">
                  <GlassCardHeader><GlassCardTitle>Channel Details</GlassCardTitle></GlassCardHeader>
                  <GlassCardContent>
                    <div className="overflow-x-auto">
                      <GlassTable>
                        <GlassTableHeader>
                          <GlassTableRow>
                            <GlassTableHead>Channel</GlassTableHead>
                            <GlassTableHead className="text-right">Spend</GlassTableHead>
                            <GlassTableHead className="text-right">% Budget</GlassTableHead>
                            <GlassTableHead className="text-right">Response</GlassTableHead>
                            <GlassTableHead className="text-right">Marginal ROI</GlassTableHead>
                            <GlassTableHead className="text-right">Saturation</GlassTableHead>
                          </GlassTableRow>
                        </GlassTableHeader>
                        <GlassTableBody>
                          {channelData.channels.map((ch) => (
                            <GlassTableRow key={ch.channel}>
                              <GlassTableCell className="font-medium text-white/95">{ch.channel}</GlassTableCell>
                              <GlassTableCell className="text-right text-white/70">{fmt(ch.spend)}</GlassTableCell>
                              <GlassTableCell className="text-right text-white/70">{ch.spend_pct}%</GlassTableCell>
                              <GlassTableCell className="text-right text-white/70">{ch.expected_response.toFixed(2)}</GlassTableCell>
                              <GlassTableCell className="text-right text-white/70">{ch.marginal_roi.toFixed(4)}</GlassTableCell>
                              <GlassTableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <div className="h-2 w-20 rounded-full bg-white/10">
                                    <div
                                      className={`h-2 rounded-full ${ch.saturation_pct > 80 ? 'bg-red-500' : ch.saturation_pct > 50 ? 'bg-yellow-500' : 'bg-green-500'}`}
                                      style={{ width: `${Math.min(ch.saturation_pct, 100)}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-white/50">{ch.saturation_pct}%</span>
                                </div>
                              </GlassTableCell>
                            </GlassTableRow>
                          ))}
                        </GlassTableBody>
                      </GlassTable>
                    </div>
                  </GlassCardContent>
                </GlassCard>

                <div className="flex items-center justify-between mt-4">
                  <ExportButton engineId="media-architect" skillId="channel-optimize" result={channelEngine.result ?? null} />
                  {channelEngine.result?.duration_ms != null && (
                    <p className="text-xs text-white/40">Completed in {channelEngine.result.duration_ms}ms</p>
                  )}
                </div>
              </>
            )}
          </GlassTabsContent>

          {/* Tab: MMM Model */}
          <GlassTabsContent value="mmm">
            {mmmData && (
              <>
                <StatsGrid columns={4}>
                  <StatCard label="R-squared" value={mmmData.r_squared_estimate.toFixed(3)} />
                </StatsGrid>

                <div className="grid gap-6 lg:grid-cols-2 mt-6">
                  <GlassCard>
                    <GlassCardHeader><GlassCardTitle>Model Fit: Actual vs Predicted</GlassCardTitle></GlassCardHeader>
                    <GlassCardContent><ModelFitChart fit={mmmData.model_fit} /></GlassCardContent>
                  </GlassCard>
                  <GlassCard>
                    <GlassCardHeader><GlassCardTitle>KPI Decomposition</GlassCardTitle></GlassCardHeader>
                    <GlassCardContent><ContributionWaterfallChart entries={mmmData.contribution_waterfall} totalKpi={mmmData.predicted_kpi} /></GlassCardContent>
                  </GlassCard>
                </div>

                <GlassCard className="mt-6">
                  <GlassCardHeader><GlassCardTitle>Channel Model Parameters</GlassCardTitle></GlassCardHeader>
                  <GlassCardContent>
                    <div className="overflow-x-auto">
                      <GlassTable>
                        <GlassTableHeader>
                          <GlassTableRow>
                            <GlassTableHead>Channel</GlassTableHead>
                            <GlassTableHead className="text-right">Spend</GlassTableHead>
                            <GlassTableHead className="text-right">Contribution</GlassTableHead>
                            <GlassTableHead className="text-right">Share %</GlassTableHead>
                            <GlassTableHead className="text-right">ROI</GlassTableHead>
                            <GlassTableHead className="text-right">mROI</GlassTableHead>
                            <GlassTableHead className="text-right">Saturation</GlassTableHead>
                          </GlassTableRow>
                        </GlassTableHeader>
                        <GlassTableBody>
                          {mmmData.channel_models.map((cm) => (
                            <GlassTableRow key={cm.channel}>
                              <GlassTableCell className="font-medium text-white/95">{cm.channel}</GlassTableCell>
                              <GlassTableCell className="text-right text-white/70">{fmt(cm.spend)}</GlassTableCell>
                              <GlassTableCell className="text-right text-white/70">{fmt(cm.results.estimated_contribution)}</GlassTableCell>
                              <GlassTableCell className="text-right text-white/70">{pct(cm.results.contribution_share_pct)}</GlassTableCell>
                              <GlassTableCell className="text-right font-medium text-emerald-400">{cm.results.roi.toFixed(2)}x</GlassTableCell>
                              <GlassTableCell className="text-right text-white/70">{cm.results.marginal_roi.toFixed(4)}</GlassTableCell>
                              <GlassTableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <div className="h-2 w-20 rounded-full bg-white/10">
                                    <div
                                      className={`h-2 rounded-full ${cm.results.saturation_pct > 80 ? 'bg-red-500' : cm.results.saturation_pct > 50 ? 'bg-yellow-500' : 'bg-green-500'}`}
                                      style={{ width: `${Math.min(cm.results.saturation_pct, 100)}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-white/50">{cm.results.saturation_pct.toFixed(1)}%</span>
                                </div>
                              </GlassTableCell>
                            </GlassTableRow>
                          ))}
                        </GlassTableBody>
                      </GlassTable>
                    </div>
                  </GlassCardContent>
                </GlassCard>

                <div className="flex items-center justify-between mt-4">
                  <ExportButton engineId="media-architect" skillId="mmm-model" result={mmmEngine.result ?? null} />
                  {mmmEngine.result?.duration_ms != null && (
                    <p className="text-xs text-white/40">Completed in {mmmEngine.result.duration_ms}ms</p>
                  )}
                </div>
              </>
            )}
          </GlassTabsContent>

          {/* Tab: Response Curves */}
          <GlassTabsContent value="curves">
            {mmmData && (
              <>
                <GlassCard>
                  <GlassCardHeader><GlassCardTitle>Response Curves by Channel</GlassCardTitle></GlassCardHeader>
                  <GlassCardContent>
                    <p className="mb-4 text-xs text-white/50">
                      Dots mark current spend. Curves show diminishing returns — flatten means saturation.
                    </p>
                    <ResponseCurveChart curves={mmmData.response_curves} />
                  </GlassCardContent>
                </GlassCard>

                <div className="grid gap-6 lg:grid-cols-2 mt-6">
                  <GlassCard>
                    <GlassCardHeader><GlassCardTitle>Marginal ROI by Channel</GlassCardTitle></GlassCardHeader>
                    <GlassCardContent>
                      <p className="mb-3 text-xs text-white/50">
                        Where is your next dollar most efficient? Above 1.0x = still generating returns.
                      </p>
                      <MarginalRoiChart intervals={mmmData.roi_intervals} />
                    </GlassCardContent>
                  </GlassCard>
                  <GlassCard>
                    <GlassCardHeader><GlassCardTitle>Channel Contribution Share</GlassCardTitle></GlassCardHeader>
                    <GlassCardContent>
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
                    </GlassCardContent>
                  </GlassCard>
                </div>
              </>
            )}
          </GlassTabsContent>

          {/* Tab: ROI Analysis */}
          <GlassTabsContent value="roi">
            {mmmData && (
              <div className="grid gap-6 lg:grid-cols-2">
                <GlassCard>
                  <GlassCardHeader><GlassCardTitle>ROI by Channel (with Credible Intervals)</GlassCardTitle></GlassCardHeader>
                  <GlassCardContent><RoiBarChart intervals={mmmData.roi_intervals} metric="roi" /></GlassCardContent>
                </GlassCard>
                <GlassCard>
                  <GlassCardHeader><GlassCardTitle>Marginal ROI by Channel</GlassCardTitle></GlassCardHeader>
                  <GlassCardContent><RoiBarChart intervals={mmmData.roi_intervals} metric="mroi" /></GlassCardContent>
                </GlassCard>
              </div>
            )}

            {optData && optData.comparison_vs_current && (
              <GlassCard className="mt-6">
                <GlassCardHeader><GlassCardTitle>Budget Optimization: Current vs Recommended</GlassCardTitle></GlassCardHeader>
                <GlassCardContent>
                  <BudgetOptChart
                    reallocation={optData.comparison_vs_current.reallocation}
                    kpiLiftPct={optData.comparison_vs_current.kpi_lift_pct}
                  />
                </GlassCardContent>
              </GlassCard>
            )}

            {optData && optData.recommendations && optData.recommendations.length > 0 && (
              <GlassCard className="mt-6">
                <GlassCardHeader><GlassCardTitle>Recommendations</GlassCardTitle></GlassCardHeader>
                <GlassCardContent>
                  <div className="space-y-2">
                    {optData.recommendations.map((rec, i) => (
                      <div
                        key={i}
                        className={`rounded-lg border p-3 text-sm ${
                          rec.priority === 'high'
                            ? 'border-red-500/30 bg-red-500/10 text-red-300'
                            : 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300'
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
                </GlassCardContent>
              </GlassCard>
            )}

            {!mmmData && !optData && (
              <GlassCard className="mt-6">
                <GlassCardContent>
                  <div className="p-8 text-center">
                    <p className="text-sm text-white/50">Run the MMM Model or Budget Optimization demo first to see ROI analysis.</p>
                  </div>
                </GlassCardContent>
              </GlassCard>
            )}
          </GlassTabsContent>
        </GlassTabs>
      )}
    </div>
  );
}
