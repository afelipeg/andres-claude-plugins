import { useState, useEffect, useRef } from 'react';
import { SmartUpload } from '../components/SmartUpload';
import { Spinner } from '../components/Spinner';
import { DonutChart } from '../components/charts/DonutChart';
import { useEngine } from '../hooks/useEngine';
import type { RevenueBridgeOutput, ShapleyOutput } from '@openagency/types';
import { toRevenueBridgeInput } from '@openagency/core/data/platform-detect';
import { ExportButton } from '../components/ExportButton';
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
  const [activeTab, setActiveTab] = useState<string>('revenue');

  // Auto-load demo data on mount
  const autoLoaded = useRef(false);
  useEffect(() => {
    if (!autoLoaded.current) {
      autoLoaded.current = true;
      revenueEngine.run(DEMO_REVENUE);
      shapleyEngine.run(DEMO_SHAPLEY);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        <h2 className="text-2xl font-bold text-white">Executive Bridge</h2>
        <p className="mt-1 text-sm text-white/50">
          Translate media metrics to financial KPIs and attribution insights for C-Suite.
        </p>
      </div>

      {/* Input */}
      <GlassCard>
        <GlassCardHeader>
          <GlassCardTitle>Quick Actions</GlassCardTitle>
        </GlassCardHeader>
        <GlassCardContent>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <GlassButton
                variant="outline"
                size="sm"
                onClick={() => { revenueEngine.run(DEMO_REVENUE); setActiveTab('revenue'); }}
                disabled={loading}
              >
                Demo: Revenue Bridge
              </GlassButton>
              <GlassButton
                variant="outline"
                size="sm"
                onClick={() => { shapleyEngine.run(DEMO_SHAPLEY); setActiveTab('shapley'); }}
                disabled={loading}
              >
                Demo: Shapley Attribution
              </GlassButton>
            </div>
            <SmartUpload
              transformFn={toRevenueBridgeInput}
              onAnalyze={(d) => { revenueEngine.run(d); setActiveTab('revenue'); }}
              onRawJson={(d) => { revenueEngine.run(d); setActiveTab('revenue'); }}
            />
          </div>
        </GlassCardContent>
      </GlassCard>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Spinner className="h-8 w-8" />
        </div>
      )}

      {/* Tabs */}
      {(revenue ?? shapley) && !loading && (
        <GlassTabs defaultValue="" value={activeTab} onValueChange={setActiveTab}>
          <GlassTabsList>
            <GlassTabsTrigger value="revenue">Revenue Bridge</GlassTabsTrigger>
            <GlassTabsTrigger value="shapley">Shapley Attribution</GlassTabsTrigger>
          </GlassTabsList>

          {/* Revenue Bridge */}
          <GlassTabsContent value="revenue">
            {revenue && (
              <>
                <ExportButton engineId="executive-bridge" skillId="revenue-translate" result={revenueEngine.result ?? null} />
                {/* L1 Financial KPIs */}
                <div className="mt-4">
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/50">
                    L1 - Financial Metrics
                  </h3>
                  <StatsGrid columns={4}>
                    <StatCard
                      label="CLV:CAC"
                      value={`${revenue.l1_metrics.clv_cac_ratio.toFixed(1)}x`}
        
                     
                    />
                    <StatCard
                      label="Marketing Margin"
                      value={pct(revenue.l1_metrics.marketing_margin_pct)}
                    />
                  </StatsGrid>
                </div>

                {/* Efficiency score */}
                <GlassCard className="mt-6">
                  <GlassCardHeader>
                    <GlassCardTitle>Efficiency Score</GlassCardTitle>
                  </GlassCardHeader>
                  <GlassCardContent>
                    <div className="flex items-center gap-4">
                      <div className="relative h-24 w-24">
                        <svg className="h-24 w-24 -rotate-90" viewBox="0 0 36 36">
                          <path
                            d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831 15.9155 15.9155 0 0 1 0 -31.831"
                            fill="none"
                            stroke="rgba(255,255,255,0.1)"
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
                        <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-white">
                          {revenue.efficiency_score}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white/95">
                          {revenue.efficiency_score >= 70 ? 'Strong' : revenue.efficiency_score >= 40 ? 'Moderate' : 'Needs Improvement'}
                        </p>
                        <p className="text-xs text-white/50">
                          Based on CLV:CAC ratio, ROAS, and marketing margin
                        </p>
                      </div>
                    </div>
                  </GlassCardContent>
                </GlassCard>

                {/* Channel breakdown */}
                <GlassCard className="mt-6">
                  <GlassCardHeader>
                    <GlassCardTitle>Channel Performance</GlassCardTitle>
                  </GlassCardHeader>
                  <GlassCardContent>
                    <div className="overflow-x-auto">
                      <GlassTable>
                        <GlassTableHeader>
                          <GlassTableRow>
                            <GlassTableHead>Channel</GlassTableHead>
                            <GlassTableHead className="text-right">CPA</GlassTableHead>
                            <GlassTableHead className="text-right">ROAS</GlassTableHead>
                            <GlassTableHead className="text-right">Conversions</GlassTableHead>
                            <GlassTableHead className="text-right">Revenue</GlassTableHead>
                          </GlassTableRow>
                        </GlassTableHeader>
                        <GlassTableBody>
                          {revenue.channels.map((ch) => (
                            <GlassTableRow key={ch.channel}>
                              <GlassTableCell className="font-medium text-white/95">{ch.channel}</GlassTableCell>
                              <GlassTableCell className="text-right text-white/70">{fmt(ch.l2_metrics.cpa)}</GlassTableCell>
                              <GlassTableCell className="text-right text-white/70">{ch.l2_metrics.roas.toFixed(2)}x</GlassTableCell>
                              <GlassTableCell className="text-right text-white/70">
                                {ch.l2_metrics.conversions.toLocaleString()}
                              </GlassTableCell>
                              <GlassTableCell className="text-right font-medium text-white/95">
                                {fmt(ch.l2_metrics.aov * ch.l2_metrics.conversions)}
                              </GlassTableCell>
                            </GlassTableRow>
                          ))}
                        </GlassTableBody>
                      </GlassTable>
                    </div>
                  </GlassCardContent>
                </GlassCard>

                {/* C-Suite Summary */}
                <div className="grid gap-4 md:grid-cols-3 mt-6">
                  {(['ceo', 'cfo', 'cmo'] as const).map((role) => (
                    <GlassCard key={role}>
                      <GlassCardHeader>
                        <GlassCardTitle>{role.toUpperCase()}</GlassCardTitle>
                      </GlassCardHeader>
                      <GlassCardContent>
                        <p className="text-sm leading-relaxed text-white/70">
                          {revenue.csuite_summary[role]}
                        </p>
                      </GlassCardContent>
                    </GlassCard>
                  ))}
                </div>
              </>
            )}
          </GlassTabsContent>

          {/* Shapley Attribution */}
          <GlassTabsContent value="shapley">
            {shapley && (
              <>
                <ExportButton engineId="executive-bridge" skillId="shapley-attribute" result={shapleyEngine.result ?? null} />
                <StatsGrid columns={3} className="mt-4">
                  <StatCard
                    label="Total Conversions"
                    value={shapley.total_conversions.toLocaleString()}
                  />
                  <StatCard
                    label="Shapley Total"
                    value={shapley.shapley_total.toLocaleString()}
                  />
                  <StatCard
                    label="Channels"
                    value={String(shapley.channels.length)}
                  />
                </StatsGrid>

                <div className="grid gap-6 lg:grid-cols-3 mt-6">
                  <GlassCard className="lg:col-span-1">
                    <GlassCardHeader><GlassCardTitle>Attribution Share</GlassCardTitle></GlassCardHeader>
                    <GlassCardContent>
                      <DonutChart
                        data={shapleyDonut}
                        centerLabel="Conversions"
                        centerValue={shapley.total_conversions.toLocaleString()}
                      />
                    </GlassCardContent>
                  </GlassCard>
                  <GlassCard className="lg:col-span-2">
                    <GlassCardHeader><GlassCardTitle>Shapley vs Last Click</GlassCardTitle></GlassCardHeader>
                    <GlassCardContent>
                      <div className="overflow-x-auto">
                        <GlassTable>
                          <GlassTableHeader>
                            <GlassTableRow>
                              <GlassTableHead>Channel</GlassTableHead>
                              <GlassTableHead className="text-right">Shapley Value</GlassTableHead>
                              <GlassTableHead className="text-right">Shapley %</GlassTableHead>
                              <GlassTableHead className="text-right">Last Click %</GlassTableHead>
                              <GlassTableHead className="text-right">Difference</GlassTableHead>
                            </GlassTableRow>
                          </GlassTableHeader>
                          <GlassTableBody>
                            {shapley.channels.map((ch) => (
                              <GlassTableRow key={ch.channel}>
                                <GlassTableCell className="font-medium text-white/95">{ch.channel}</GlassTableCell>
                                <GlassTableCell className="text-right text-white/70">
                                  {Math.round(ch.shapley_value).toLocaleString()}
                                </GlassTableCell>
                                <GlassTableCell className="text-right text-white/70">
                                  {pct(ch.shapley_share_pct)}
                                </GlassTableCell>
                                <GlassTableCell className="text-right text-white/70">
                                  {pct(ch.last_click_share_pct)}
                                </GlassTableCell>
                                <GlassTableCell className="text-right">
                                  <span
                                    className={`font-medium ${
                                      ch.credit_status === 'under-credited by last-click'
                                        ? 'text-red-400'
                                        : ch.credit_status === 'over-credited by last-click'
                                          ? 'text-yellow-400'
                                          : 'text-emerald-400'
                                    }`}
                                  >
                                    {ch.difference_pct > 0 ? '+' : ''}
                                    {pct(ch.difference_pct)}
                                  </span>
                                  <span className="ml-1 text-xs text-white/40">{ch.credit_status}</span>
                                </GlassTableCell>
                              </GlassTableRow>
                            ))}
                          </GlassTableBody>
                        </GlassTable>
                      </div>
                    </GlassCardContent>
                  </GlassCard>
                </div>
              </>
            )}
          </GlassTabsContent>
        </GlassTabs>
      )}
    </div>
  );
}
