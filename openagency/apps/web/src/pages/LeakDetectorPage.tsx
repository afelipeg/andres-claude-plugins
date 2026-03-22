import { useState, useEffect, useRef } from 'react';
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
  GlassBadge,
  GlassTable,
  GlassTableHeader,
  GlassTableBody,
  GlassTableRow,
  GlassTableHead,
  GlassTableCell,
  StatCard,
  StatsGrid,
} from '../components/ui/glass';

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
  const [activeTab, setActiveTab] = useState<string>('chart');

  // Auto-load demo data on mount if no result
  const autoLoaded = useRef(false);
  useEffect(() => {
    if (!autoLoaded.current) {
      autoLoaded.current = true;
      run(SAMPLE_WASTE_MEDIUM);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        <h2 className="text-2xl font-bold text-white">Leak Detector</h2>
        <p className="mt-1 text-sm text-white/50">
          Find where your ad budget leaks money with the waste waterfall analysis.
        </p>
      </div>

      {/* Input section */}
      <GlassCard>
        <GlassCardHeader>
          <GlassCardTitle>Data Input</GlassCardTitle>
        </GlassCardHeader>
        <GlassCardContent>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {DEMOS.map((d) => (
                <GlassButton
                  key={d.label}
                  variant="outline"
                  size="sm"
                  onClick={() => run(d.data)}
                  disabled={loading}
                >
                  Demo: {d.label}
                </GlassButton>
              ))}
            </div>
            <SmartUpload
              transformFn={toWasteInput}
              onAnalyze={(d) => run(d)}
              onRawJson={(d) => run(d)}
            />
          </div>
        </GlassCardContent>
      </GlassCard>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Spinner className="h-8 w-8" />
          <span className="ml-3 text-sm text-white/50">Running waste waterfall analysis...</span>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
          {typeof error === 'string' ? error : JSON.stringify(error)}
        </div>
      )}

      {data && !loading && (
        <>
          {/* KPI strip */}
          <StatsGrid columns={4}>
            <StatCard
              label="Total Waste"
              value={fmt(data.waste_summary.total_waste)}

            />
            <StatCard
              label="Productive Spend"
              value={fmt(data.productive_spend.amount)}

            />
            {data.roi_impact && (
              <StatCard
                label="ROAS Improvement"
                value={`+${pct(data.roi_impact.improvement_potential_pct)}`}
              />
            )}
          </StatsGrid>

          {/* Tabs */}
          <GlassTabs defaultValue="" value={activeTab} onValueChange={setActiveTab}>
            <GlassTabsList>
              <GlassTabsTrigger value="chart">Waterfall Chart</GlassTabsTrigger>
              <GlassTabsTrigger value="roadmap">Recovery Roadmap</GlassTabsTrigger>
              <GlassTabsTrigger value="csuite">C-Suite Summary</GlassTabsTrigger>
            </GlassTabsList>

            {/* Waterfall Chart tab */}
            <GlassTabsContent value="chart">
              <div className="grid gap-6 lg:grid-cols-3">
                <GlassCard className="lg:col-span-2">
                  <GlassCardHeader>
                    <GlassCardTitle>Waste Waterfall</GlassCardTitle>
                  </GlassCardHeader>
                  <GlassCardContent>
                    <WaterfallChart
                      stages={data.waterfall}
                      grossSpend={data.gross_spend}
                      productiveSpend={data.productive_spend.amount}
                    />
                  </GlassCardContent>
                </GlassCard>
                <GlassCard>
                  <GlassCardHeader>
                    <GlassCardTitle>Spend Breakdown</GlassCardTitle>
                  </GlassCardHeader>
                  <GlassCardContent>
                    <DonutChart
                      data={donutData}
                      centerLabel="Waste"
                      centerValue={pct(data.waste_summary.waste_pct)}
                    />
                    <div className="mt-4 space-y-2">
                      {data.waterfall.map((s) => (
                        <div key={s.category} className="flex items-center justify-between text-sm">
                          <span className="text-white/70">{s.label}</span>
                          <div className="text-right">
                            <span className={s.vs_benchmark === 'above' ? 'font-medium text-red-400' : 'text-yellow-400'}>
                              {fmt(s.waste_amount)}
                            </span>
                            <span className="ml-2 text-xs text-white/40">
                              {pct(s.waste_pct)} vs {pct(s.benchmark_pct)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </GlassCardContent>
                </GlassCard>
              </div>
            </GlassTabsContent>

            {/* Recovery Roadmap tab */}
            <GlassTabsContent value="roadmap">
              <GlassCard>
                <GlassCardHeader>
                  <GlassCardTitle>Recovery Roadmap</GlassCardTitle>
                </GlassCardHeader>
                <GlassCardContent>
                  <div className="overflow-x-auto">
                    <GlassTable>
                      <GlassTableHeader>
                        <GlassTableRow>
                          <GlassTableHead>Action</GlassTableHead>
                          <GlassTableHead>Category</GlassTableHead>
                          <GlassTableHead>Est. Savings</GlassTableHead>
                          <GlassTableHead>Difficulty</GlassTableHead>
                          <GlassTableHead>Timeline</GlassTableHead>
                        </GlassTableRow>
                      </GlassTableHeader>
                      <GlassTableBody>
                        {data.recovery_roadmap.map((action, i) => (
                          <GlassTableRow key={i}>
                            <GlassTableCell className="font-medium text-white/95">{action.action}</GlassTableCell>
                            <GlassTableCell className="text-white/70">{action.category}</GlassTableCell>
                            <GlassTableCell className="font-medium text-emerald-400">
                              {fmt(action.estimated_savings)}
                            </GlassTableCell>
                            <GlassTableCell>
                              <GlassBadge
                                variant={
                                  action.difficulty === 'easy'
                                    ? 'success'
                                    : action.difficulty === 'medium'
                                      ? 'warning'
                                      : 'destructive'
                                }
                              >
                                {action.difficulty}
                              </GlassBadge>
                            </GlassTableCell>
                            <GlassTableCell className="text-white/70">{action.timeline}</GlassTableCell>
                          </GlassTableRow>
                        ))}
                      </GlassTableBody>
                    </GlassTable>
                  </div>
                </GlassCardContent>
              </GlassCard>
            </GlassTabsContent>

            {/* C-Suite tab */}
            <GlassTabsContent value="csuite">
              <div className="grid gap-4 md:grid-cols-3">
                {(['ceo', 'cfo', 'cmo'] as const).map((role) => (
                  <GlassCard key={role}>
                    <GlassCardHeader>
                      <GlassCardTitle>{role.toUpperCase()}</GlassCardTitle>
                    </GlassCardHeader>
                    <GlassCardContent>
                      <p className="text-sm leading-relaxed text-white/70">
                        {data.csuite_summary[role]}
                      </p>
                    </GlassCardContent>
                  </GlassCard>
                ))}
              </div>
            </GlassTabsContent>
          </GlassTabs>

          {/* Export + Timing */}
          <div className="flex items-center justify-between">
            <ExportButton engineId="leak-detector" skillId="waste-waterfall" result={result} />
            {result?.duration_ms != null && (
              <p className="text-xs text-white/40">
                Analysis completed in {result.duration_ms}ms
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
