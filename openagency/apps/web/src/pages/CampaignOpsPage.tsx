import { useState } from 'react';
import { Card, MetricCard } from '../components/Card';
import { SmartUpload } from '../components/SmartUpload';
import { Spinner } from '../components/Spinner';
import { useEngine } from '../hooks/useEngine';
import type { CampaignState, OptimizationOutput } from '@openagency/types';
import { toOptimizationInput } from '@openagency/core/data/platform-detect';
import { ExportButton } from '../components/ExportButton';

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
  PENDING: 'bg-gray-100 text-gray-700',
  IN_PROGRESS: 'bg-zinc-100 text-zinc-700',
  DONE: 'bg-green-100 text-green-700',
  BLOCKED: 'bg-red-100 text-red-700',
  REVIEW: 'bg-yellow-100 text-yellow-700',
  SKIPPED: 'bg-gray-100 text-gray-400',
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'border-red-200 bg-red-50 text-red-700',
  warning: 'border-yellow-200 bg-yellow-50 text-yellow-700',
  info: 'border-zinc-200 bg-zinc-50 text-zinc-700',
};

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

export function CampaignOpsPage() {
  const campaignEngine = useEngine<CampaignState>('campaign-ops', 'campaign-create');
  const optEngine = useEngine<OptimizationOutput>('campaign-ops', 'optimization-analyze');
  const [activeTab, setActiveTab] = useState<'campaign' | 'optimization'>('campaign');

  const campaign = campaignEngine.result?.data;
  const optData = optEngine.result?.data;
  const loading = campaignEngine.loading || optEngine.loading;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Campaign Ops</h2>
        <p className="mt-1 text-sm text-gray-500">
          Manage campaign workflows and monitor real-time optimization alerts.
        </p>
      </div>

      {/* Input */}
      <Card title="Quick Actions">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { campaignEngine.run(DEMO_CAMPAIGN); setActiveTab('campaign'); }}
              disabled={loading}
              className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50"
            >
              Demo: Create Campaign DAG
            </button>
            <button
              onClick={() => { optEngine.run(DEMO_OPT); setActiveTab('optimization'); }}
              disabled={loading}
              className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50"
            >
              Demo: Optimization Alerts
            </button>
          </div>
          <SmartUpload
            transformFn={toOptimizationInput}
            onAnalyze={(d) => { optEngine.run(d); setActiveTab('optimization'); }}
            onRawJson={(d) => { optEngine.run(d); setActiveTab('optimization'); }}
          />
        </div>
      </Card>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Spinner className="h-8 w-8" />
        </div>
      )}

      {/* Tabs */}
      {(campaign ?? optData) && !loading && (
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          {(['campaign', 'optimization'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab === 'campaign' ? 'Campaign DAG' : 'Optimization Alerts'}
            </button>
          ))}
        </div>
      )}

      {/* Campaign DAG */}
      {activeTab === 'campaign' && campaign && !loading && (
        <>
          <ExportButton engineId="campaign-ops" skillId="campaign-create" result={campaignEngine.result ?? null} />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <MetricCard label="Campaign" value={campaign.campaign.name} color="blue" />
            <MetricCard
              label="Sprints"
              value={String(Object.keys(campaign.sprints).length)}
              color="blue"
            />
            <MetricCard
              label="Total Tasks"
              value={String(
                Object.values(campaign.sprints).reduce((s, sp) => s + sp.tasks.length, 0),
              )}
              color="blue"
            />
            <MetricCard
              label="Blockers"
              value={String(campaign.blockers.length)}
              color={campaign.blockers.length > 0 ? 'red' : 'green'}
            />
          </div>

          {Object.entries(campaign.sprints).map(([name, sprint]) => (
            <Card key={name} title={`${name} (${sprint.duration_hours}h)`}>
              <div className="space-y-2">
                {sprint.tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-gray-400">{task.id}</span>
                      <span className="text-sm font-medium text-gray-900">{task.name}</span>
                      <span className="text-xs text-gray-500">{task.engine}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500">{task.hours}h</span>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[task.status] ?? ''}`}
                      >
                        {task.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </>
      )}

      {/* Optimization Alerts */}
      {activeTab === 'optimization' && optData && !loading && (
        <>
          <ExportButton engineId="campaign-ops" skillId="optimization-analyze" result={optEngine.result ?? null} />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <MetricCard
              label="Total Alerts"
              value={String(optData.total_alerts.critical + optData.total_alerts.warning + optData.total_alerts.info)}
              color={optData.total_alerts.critical > 0 ? 'red' : optData.total_alerts.warning > 0 ? 'yellow' : 'green'}
            />
            <MetricCard
              label="Campaigns Analyzed"
              value={String(optData.campaigns.length)}
              color="blue"
            />
            <MetricCard
              label="Critical Alerts"
              value={String(
                optData.campaigns.reduce(
                  (s, c) => s + c.alerts.filter((a) => a.severity === 'critical').length,
                  0,
                ),
              )}
              color="red"
            />
          </div>

          {optData.campaigns.map((camp) => (
            <Card key={camp.campaign} title={`${camp.campaign} (${camp.channel})`}>
              <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="text-sm">
                  <span className="text-gray-500">Spend:</span>{' '}
                  <span className="font-medium">{fmt(camp.metrics.spend)}</span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-500">Budget:</span>{' '}
                  <span className="font-medium">{fmt(camp.metrics.budget)}</span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-500">CPA:</span>{' '}
                  <span className="font-medium">{fmt(camp.metrics.cpa)}</span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-500">ROAS:</span>{' '}
                  <span className="font-medium">{camp.metrics.roas.toFixed(2)}x</span>
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
                <p className="text-sm text-green-600">All metrics within targets.</p>
              )}
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
