// ─── Recovery Scorecard Page ────────────────────────────────────────
// The core A2H surface: humans see value delivered + fee, then accept/reject.

import { useState, useEffect, useCallback } from 'react';
import { Card, MetricCard } from '../components/Card';
import { Spinner } from '../components/Spinner';
import { AgentChat } from '../components/AgentChat';
import type { ScorecardRecord, ScorecardSummary, FeeBreakdown } from '../api/scorecard';
import {
  getLatestScorecard,
  listScorecards,
  updateScorecardStatus,
} from '../api/scorecard';

// ─── Formatting Helpers ─────────────────────────────────────────────

function fmtUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function fmtRate(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

// ─── Fee Breakdown Component ────────────────────────────────────────

function FeeBreakdownCard({ fee, color }: { fee: FeeBreakdown; color: string }) {
  const colorMap: Record<string, string> = {
    green: 'border-green-200 bg-green-50',
    blue: 'border-zinc-200 bg-zinc-50',
    purple: 'border-purple-200 bg-purple-50',
  };

  const headerMap: Record<string, string> = {
    recovery: 'Recovery Fee',
    lift: 'Lift / Delta Fee',
    efficiency: 'Efficiency Fee',
  };

  return (
    <div className={`rounded-xl border p-5 ${colorMap[color] ?? 'border-gray-200 bg-gray-50'}`}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-900">{headerMap[fee.category]}</h4>
        <span className="text-xs text-gray-500">Rate: {fmtRate(fee.rate)}</span>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-gray-900">{fmtUsd(fee.fee)}</span>
        <span className="text-sm text-gray-500">on {fmtUsd(fee.base_amount)} value</span>
      </div>

      {fee.line_items.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {fee.line_items.map((item, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="text-gray-600">{item.label}</span>
              <span className="font-medium text-gray-900">{fmtUsd(item.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── MDS Confidence Badge ───────────────────────────────────────────

function ConfidenceBadge({ confidence, method }: { confidence: number; method: string }) {
  const color =
    confidence >= 0.8 ? 'bg-green-100 text-green-700' :
    confidence >= 0.5 ? 'bg-yellow-100 text-yellow-700' :
    'bg-red-100 text-red-700';

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {method} ({(confidence * 100).toFixed(0)}%)
    </span>
  );
}

// ─── Scorecard History Row ──────────────────────────────────────────

function HistoryRow({ record }: { record: ScorecardSummary }) {
  const statusColor: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    accepted: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  };

  return (
    <div className="flex items-center gap-4 border-b border-gray-100 py-3 last:border-b-0">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900">{fmtUsd(record.ad_spend)} spend</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[record.status] ?? ''}`}>
            {record.status}
          </span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{record.tier}</span>
        </div>
        <p className="mt-0.5 text-xs text-gray-500">
          {new Date(record.created_at).toLocaleString()}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold text-gray-900">{fmtUsd(record.total_fee)}</p>
        <p className="text-xs text-gray-500">{fmtUsd(record.value_delivered)} value | {record.roi_on_fee.toFixed(1)}x ROI</p>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────

export function ScorecardPage() {
  const [scorecard, setScorecard] = useState<ScorecardRecord | null>(null);
  const [history, setHistory] = useState<ScorecardSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sc, hist] = await Promise.allSettled([
        getLatestScorecard(),
        listScorecards(),
      ]);
      if (sc.status === 'fulfilled') setScorecard(sc.value);
      if (hist.status === 'fulfilled') setHistory(hist.value);
      if (sc.status === 'rejected' && hist.status === 'rejected') {
        setError('No scorecards yet. Run an analysis first via the API or upload data.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const handleAction = async (status: 'accepted' | 'rejected') => {
    if (!scorecard) return;
    setActionLoading(true);
    try {
      const updated = await updateScorecardStatus(scorecard.id, status, feedback || undefined);
      setScorecard(updated);
      setFeedback('');
      void loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Recovery Scorecard</h2>
        <p className="mt-1 text-sm text-gray-500">
          Value delivered by OpenAgency engines and outcome-based billing transparency.
        </p>
      </div>

      {error && !scorecard && (
        <Card>
          <div className="py-8 text-center">
            <p className="text-sm text-gray-500">{error}</p>
            <p className="mt-2 text-xs text-gray-400">
              Use POST /v1/scorecard/run or POST /v1/scorecard/compute to generate a scorecard.
            </p>
          </div>
        </Card>
      )}

      {scorecard && (
        <>
          {/* Top metrics */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Total Value Delivered"
              value={fmtUsd(scorecard.billing.value_delivered)}
              sub={`${scorecard.billing.roi_on_fee.toFixed(1)}x ROI on fee`}
              color="green"
            />
            <MetricCard
              label="OpenAgency Fee"
              value={fmtUsd(scorecard.billing.total_fee)}
              sub={fmtPct(scorecard.billing.fee_as_pct_of_spend) + ' of spend'}
              color="blue"
            />
            <MetricCard
              label="Ad Spend"
              value={fmtUsd(scorecard.billing.ad_spend)}
              sub={scorecard.billing.tier.label + ' tier'}
              color="gray"
            />
            <MetricCard
              label="Media-Driven Sales"
              value={fmtUsd(scorecard.billing.media_driven_sales.final_value)}
              sub={scorecard.billing.media_driven_sales.method}
              color="yellow"
            />
          </div>

          {/* Fee breakdown */}
          <div>
            <h3 className="mb-3 text-lg font-semibold text-gray-900">Fee Breakdown</h3>
            <div className="grid gap-4 lg:grid-cols-3">
              <FeeBreakdownCard fee={scorecard.billing.recovery_fee} color="green" />
              <FeeBreakdownCard fee={scorecard.billing.lift_fee} color="blue" />
              <FeeBreakdownCard fee={scorecard.billing.efficiency_fee} color="purple" />
            </div>
          </div>

          {/* MDS triangulation detail */}
          {scorecard.billing.media_driven_sales.method !== 'none' && (
            <Card title="Media-Driven Sales Triangulation">
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <p className="text-xs text-gray-500">Attribution Revenue</p>
                  <p className="text-lg font-bold text-gray-900">
                    {fmtUsd(scorecard.billing.media_driven_sales.attribution_revenue)}
                  </p>
                </div>
                <div className="text-gray-300">+</div>
                <div>
                  <p className="text-xs text-gray-500">Modeled Contribution</p>
                  <p className="text-lg font-bold text-gray-900">
                    {fmtUsd(scorecard.billing.media_driven_sales.modeled_contribution)}
                  </p>
                </div>
                <div className="text-gray-300">=</div>
                <div>
                  <p className="text-xs text-gray-500">Final Value</p>
                  <p className="text-lg font-bold text-green-600">
                    {fmtUsd(scorecard.billing.media_driven_sales.final_value)}
                  </p>
                </div>
                <ConfidenceBadge
                  confidence={scorecard.billing.media_driven_sales.confidence}
                  method={scorecard.billing.media_driven_sales.method}
                />
              </div>
            </Card>
          )}

          {/* Accept / Reject */}
          {scorecard.status === 'pending' && (
            <Card title="Decision">
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Review the value delivered above. Accept to confirm and proceed with billing,
                  or reject to provide feedback for re-analysis.
                </p>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Optional feedback (required for rejection)..."
                  className="w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-700 placeholder:text-gray-400 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                  rows={3}
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => handleAction('accepted')}
                    disabled={actionLoading}
                    className="rounded-lg bg-green-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-50"
                  >
                    {actionLoading ? 'Processing...' : 'Accept Scorecard'}
                  </button>
                  <button
                    onClick={() => handleAction('rejected')}
                    disabled={actionLoading || !feedback.trim()}
                    className="rounded-lg bg-red-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                  >
                    {actionLoading ? 'Processing...' : 'Reject & Request Re-analysis'}
                  </button>
                </div>
              </div>
            </Card>
          )}

          {/* Already resolved */}
          {scorecard.status !== 'pending' && (
            <Card>
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full px-3 py-1 text-sm font-medium ${
                    scorecard.status === 'accepted'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {scorecard.status === 'accepted' ? 'Accepted' : 'Rejected'}
                </span>
                {scorecard.feedback && (
                  <p className="text-sm text-gray-600">Feedback: {scorecard.feedback}</p>
                )}
              </div>
            </Card>
          )}

          {/* Agent Chat — show after rejection for feedback loop */}
          {scorecard.status === 'rejected' && (
            <div>
              <h3 className="mb-3 text-lg font-semibold text-gray-900">Re-analysis Feedback</h3>
              <p className="mb-3 text-sm text-gray-500">
                Send feedback to guide the agent's next analysis. The agent will re-run with your input.
              </p>
              <AgentChat
                agentId="leak-detector"
                onCycleTriggered={() => void loadData()}
              />
            </div>
          )}
        </>
      )}

      {/* History */}
      {history.length > 0 && (
        <Card title="Scorecard History">
          <div className="divide-y divide-gray-100">
            {history.map((record) => (
              <HistoryRow key={record.id} record={record} />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
