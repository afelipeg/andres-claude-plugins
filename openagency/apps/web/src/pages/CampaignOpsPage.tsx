import { useState, useEffect, useRef } from 'react';
import { SmartUpload } from '../components/SmartUpload';
import { Spinner } from '../components/Spinner';
import { useEngine } from '../hooks/useEngine';
import type { CampaignState, OptimizationOutput } from '@openagency/types';
import { toOptimizationInput } from '@openagency/core/data/platform-detect';
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

  StatCard,
  StatsGrid,
} from '../components/ui/glass';

const DEMO_CAMPAIGN = { campaign_name: 'Q1 Brand Launch', client: 'Demo Client' };

const DEMO_OPT = {
  campaigns: [
    {
      name: 'Search Brand',
      channel: 'search',
      spend: 45_000,
      budget: 50_000,
      days_elapsed: 15,
      days_total: 30,
      impressions: 500_000,
      clicks: 25_000,
      conversions: 750,
      revenue: 112_500,
      cpa_target: 50,
      roas_target: 3.0,
      historical_ctr: 0.052,
    },
    {
      name: 'Social Awareness',
      channel: 'social',
      spend: 38_000,
      budget: 40_000,
      days_elapsed: 15,
      days_total: 30,
      impressions: 2_000_000,
      clicks: 40_000,
      conversions: 200,
      revenue: 30_000,
      cpa_target: 120,
      roas_target: 1.5,
      historical_ctr: 0.021,
    },
    {
      name: 'Display Retargeting',
      channel: 'display',
      spend: 12_000,
      budget: 25_000,
      days_elapsed: 15,
      days_total: 30,
      impressions: 800_000,
      clicks: 8_000,
      conversions: 0,
      revenue: 0,
      cpa_target: 80,
      roas_target: 2.0,
      historical_ctr: 0.01,
    },
  ],
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-white/10 text-white/70',
  IN_PROGRESS: 'bg-cyan-500/20 text-cyan-300',
  DONE: 'bg-emerald-500/20 text-emerald-300',
  BLOCKED: 'bg-red-500/20 text-red-300',
  REVIEW: 'bg-yellow-500/20 text-yellow-300',
  SKIPPED: 'bg-white/5 text-white/40',
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'border-red-500/30 bg-red-500/10 text-red-300',
  warning: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300',
  info: 'border-white/10 bg-white/5 text-white/70',
};

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

export function CampaignOpsPage() {
  const campaignEngine = useEngine<CampaignState>('campaign-ops', 'campaign-create');
  const optEngine = useEngine<OptimizationOutput>('campaign-ops', 'optimization-analyze');
  const [activeTab, setActiveTab] = useState<string>('campaign');

  // Auto-load demo data on mount
  const autoLoaded = useRef(false);
  useEffect(() => {
    if (!autoLoaded.current) {
      autoLoaded.current = true;
      campaignEngine.run(DEMO_CAMPAIGN);
      optEngine.run(DEMO_OPT);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const campaign = campaignEngine.result?.data;
  const optData = optEngine.result?.data;
  const loading = campaignEngine.loading || optEngine.loading;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Campaign Ops</h2>
        <p className="mt-1 text-sm text-white/50">
          Manage campaign workflows and monitor real-time optimization alerts.
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
                onClick={() => { campaignEngine.run(DEMO_CAMPAIGN); setActiveTab('campaign'); }}
                disabled={loading}
              >
                Demo: Create Campaign DAG
              </GlassButton>
              <GlassButton
                variant="outline"
                size="sm"
                onClick={() => { optEngine.run(DEMO_OPT); setActiveTab('optimization'); }}
                disabled={loading}
              >
                Demo: Optimization Alerts
              </GlassButton>
            </div>
            <SmartUpload
              transformFn={toOptimizationInput}
              onAnalyze={(d) => { optEngine.run(d); setActiveTab('optimization'); }}
              onRawJson={(d) => { optEngine.run(d); setActiveTab('optimization'); }}
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
      {(campaign ?? optData) && !loading && (
        <GlassTabs defaultValue="" value={activeTab} onValueChange={setActiveTab}>
          <GlassTabsList>
            <GlassTabsTrigger value="campaign">Campaign DAG</GlassTabsTrigger>
            <GlassTabsTrigger value="optimization">Optimization Alerts</GlassTabsTrigger>
          </GlassTabsList>

          {/* Campaign DAG */}
          <GlassTabsContent value="campaign">
            {campaign && (
              <>
                <ExportButton engineId="campaign-ops" skillId="campaign-create" result={campaignEngine.result ?? null} />
                <StatsGrid columns={4} className="mt-4">
                  <StatCard
                    label="Sprints"
                    value={String(Object.keys(campaign.sprints).length)}
                  />
                  <StatCard
                    label="Total Tasks"
                    value={String(
                      Object.values(campaign.sprints).reduce((s, sp) => s + sp.tasks.length, 0),
                    )}
                  />
                  <StatCard
                    label="Blockers"
                    value={String(campaign.blockers.length)}
                   
                  />
                </StatsGrid>

                {Object.entries(campaign.sprints).map(([name, sprint]) => (
                  <GlassCard key={name} className="mt-4">
                    <GlassCardHeader>
                      <GlassCardTitle>{name} ({sprint.duration_hours}h)</GlassCardTitle>
                    </GlassCardHeader>
                    <GlassCardContent>
                      <div className="space-y-2">
                        {sprint.tasks.map((task) => (
                          <div
                            key={task.id}
                            className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-mono text-white/40">{task.id}</span>
                              <span className="text-sm font-medium text-white/95">{task.name}</span>
                              <span className="text-xs text-white/50">{task.engine}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-white/50">{task.hours}h</span>
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[task.status] ?? ''}`}
                              >
                                {task.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </GlassCardContent>
                  </GlassCard>
                ))}
              </>
            )}
          </GlassTabsContent>

          {/* Optimization Alerts */}
          <GlassTabsContent value="optimization">
            {optData && (
              <>
                <ExportButton engineId="campaign-ops" skillId="optimization-analyze" result={optEngine.result ?? null} />
                <StatsGrid columns={3} className="mt-4">
                  <StatCard
                    label="Total Alerts"
                    value={String(optData.total_alerts.critical + optData.total_alerts.warning + optData.total_alerts.info)}
                   
                  />
                  <StatCard
                    label="Campaigns Analyzed"
                    value={String(optData.campaigns.length)}
                  />
                  <StatCard
                    label="Critical Alerts"
                    value={String(
                      optData.campaigns.reduce(
                        (s, c) => s + c.alerts.filter((a) => a.severity === 'critical').length,
                        0,
                      ),
                    )}
                  />
                </StatsGrid>

                {optData.campaigns.map((camp) => (
                  <GlassCard key={camp.campaign} className="mt-4">
                    <GlassCardHeader>
                      <GlassCardTitle>{camp.campaign} ({camp.channel})</GlassCardTitle>
                    </GlassCardHeader>
                    <GlassCardContent>
                      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                        <div className="text-sm">
                          <span className="text-white/50">Spend:</span>{' '}
                          <span className="font-medium text-white/95">{fmt(camp.metrics.spend)}</span>
                        </div>
                        <div className="text-sm">
                          <span className="text-white/50">Budget:</span>{' '}
                          <span className="font-medium text-white/95">{fmt(camp.metrics.budget)}</span>
                        </div>
                        <div className="text-sm">
                          <span className="text-white/50">CPA:</span>{' '}
                          <span className="font-medium text-white/95">{fmt(camp.metrics.cpa)}</span>
                        </div>
                        <div className="text-sm">
                          <span className="text-white/50">ROAS:</span>{' '}
                          <span className="font-medium text-white/95">{camp.metrics.roas.toFixed(2)}x</span>
                        </div>
                      </div>
                      {camp.alerts.length > 0 ? (
                        <div className="space-y-2">
                          {camp.alerts.map((alert, i) => (
                            <div
                              key={i}
                              className={`rounded-lg border p-3 text-sm ${SEVERITY_COLORS[alert.severity] ?? ''}`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-medium uppercase">{alert.severity}</span>
                                <span className="text-xs opacity-75">{alert.type}</span>
                              </div>
                              <p className="mt-1">{alert.message}</p>
                              <p className="mt-1 text-xs opacity-75">{alert.recommendation}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-emerald-400">All metrics within targets.</p>
                      )}
                    </GlassCardContent>
                  </GlassCard>
                ))}
              </>
            )}
          </GlassTabsContent>
        </GlassTabs>
      )}
    </div>
  );
}
