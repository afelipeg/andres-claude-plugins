'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  CreditCard,
  TrendingUp,
  Zap,
  DollarSign,
  Loader2,
  AlertCircle,
  Receipt,
} from 'lucide-react';

interface ConsumptionData {
  plan: string;
  period: string;
  api_calls: number;
  api_calls_limit: number;
  tokens_used: number;
  tokens_limit: number;
  total_cost: number;
  waste_recovery_fee: number;
  outcome_fee: number;
}

const FEE_TIERS = [
  {
    label: 'Waste Recovery',
    description: 'Fee on identified media waste savings',
    tiers: [
      { range: 'First $50K saved', rate: '15%' },
      { range: '$50K - $250K saved', rate: '12%' },
      { range: '$250K+ saved', rate: '8%' },
    ],
  },
  {
    label: 'Outcome-Based',
    description: 'Performance fee on incremental ROAS improvement',
    tiers: [
      { range: '1-10% ROAS lift', rate: '5% of delta' },
      { range: '10-25% ROAS lift', rate: '8% of delta' },
      { range: '25%+ ROAS lift', rate: '10% of delta' },
    ],
  },
];

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-3 mb-3">
        <div
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-lg',
            color || 'bg-primary/10'
          )}
        >
          <Icon className={cn('h-4.5 w-4.5', color ? 'text-white' : 'text-primary')} />
        </div>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

function ProgressBar({ used, limit, label }: { used: number; limit: number; label: string }) {
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const isWarning = pct > 80;
  const isCritical = pct > 95;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-foreground font-medium">
          {used.toLocaleString()} / {limit.toLocaleString()}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            isCritical
              ? 'bg-red-500'
              : isWarning
              ? 'bg-yellow-500'
              : 'bg-primary'
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">{pct.toFixed(1)}% used</p>
    </div>
  );
}

function SkeletonCard() {
  return <div className="h-28 rounded-xl border border-border bg-card animate-pulse" />;
}

export default function BillingPage() {
  const [data, setData] = useState<ConsumptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const getToken = useCallback(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('plinth_token') || '';
    }
    return '';
  }, []);

  useEffect(() => {
    async function fetchConsumption() {
      try {
        const res = await fetch('/api/v1/consumption', {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (!res.ok) throw new Error('Failed to load billing data');
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load billing data');
      } finally {
        setLoading(false);
      }
    }
    fetchConsumption();
  }, [getToken]);

  if (loading) {
    return (
      <div className="max-w-4xl space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <div className="h-48 rounded-xl border border-border bg-card animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl">
        <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-6 flex items-center gap-3 text-sm text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      </div>
    );
  }

  const consumption = data || {
    plan: 'Growth',
    period: 'March 2026',
    api_calls: 0,
    api_calls_limit: 10000,
    tokens_used: 0,
    tokens_limit: 5000000,
    total_cost: 0,
    waste_recovery_fee: 0,
    outcome_fee: 0,
  };

  const formatCost = (v: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);

  const formatTokens = (v: number) => {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
    return v.toString();
  };

  return (
    <div className="max-w-4xl space-y-6">
      {/* Current plan */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Current Plan</p>
            <p className="text-xl font-bold text-foreground mt-1">{consumption.plan}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Billing period: {consumption.period}
            </p>
          </div>
          <div className="rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
            Active
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={Zap}
          label="API Calls"
          value={consumption.api_calls.toLocaleString()}
          sub={`of ${consumption.api_calls_limit.toLocaleString()} limit`}
        />
        <KpiCard
          icon={TrendingUp}
          label="Tokens Used"
          value={formatTokens(consumption.tokens_used)}
          sub={`of ${formatTokens(consumption.tokens_limit)} limit`}
        />
        <KpiCard
          icon={DollarSign}
          label="Total Cost"
          value={formatCost(consumption.total_cost)}
          sub="This period"
        />
        <KpiCard
          icon={Receipt}
          label="Fees"
          value={formatCost(consumption.waste_recovery_fee + consumption.outcome_fee)}
          sub="Recovery + Outcome"
        />
      </div>

      {/* Usage progress */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-5">
        <h2 className="text-lg font-semibold text-foreground">Usage</h2>
        <ProgressBar
          used={consumption.api_calls}
          limit={consumption.api_calls_limit}
          label="API Calls"
        />
        <ProgressBar
          used={consumption.tokens_used}
          limit={consumption.tokens_limit}
          label="Tokens"
        />
      </div>

      {/* Fee tiers */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-5">
        <h2 className="text-lg font-semibold text-foreground">Fee Structure</h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {FEE_TIERS.map((fee) => (
            <div key={fee.label} className="space-y-3">
              <div>
                <p className="text-sm font-medium text-foreground">{fee.label}</p>
                <p className="text-xs text-muted-foreground">{fee.description}</p>
              </div>
              <div className="space-y-2">
                {fee.tiers.map((tier) => (
                  <div
                    key={tier.range}
                    className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm"
                  >
                    <span className="text-muted-foreground">{tier.range}</span>
                    <span className="font-medium text-foreground">{tier.rate}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Payment method */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">Payment Method</p>
              <p className="text-xs text-muted-foreground">
                No payment method on file
              </p>
            </div>
          </div>
          <button className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
            Add Method
          </button>
        </div>
      </div>
    </div>
  );
}
