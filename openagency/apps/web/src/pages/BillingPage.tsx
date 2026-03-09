// ─── Billing Page ──────────────────────────────────────────────────
// Outcome-based billing transparency: tiers, fee structure, calculator.

import { useState, useEffect, useCallback } from 'react';
import { Card, MetricCard } from '../components/Card';
import { Spinner } from '../components/Spinner';
import type {
  ScorecardSummary,
  BillingResult,
  TierRates,
} from '../api/scorecard';
import { listScorecards, getLatestScorecard, getTierPreview } from '../api/scorecard';
import { calculateBilling } from '@openagency/core';
import type { BillingInput } from '@openagency/core';

// ─── Tier Data (mirrors packages/core/src/billing.ts) ─────────────

const TIERS: Array<{
  tier: string;
  label: string;
  spend: string;
  recovery: string;
  lift: string;
  efficiency: string;
}> = [
  { tier: 'starter', label: 'Starter', spend: '< $500K', recovery: '5%', lift: '20%', efficiency: '10%' },
  { tier: 'growth', label: 'Growth', spend: '$500K - $2M', recovery: '4.5%', lift: '17%', efficiency: '8.5%' },
  { tier: 'scale', label: 'Scale', spend: '$2M - $5M', recovery: '4%', lift: '14%', efficiency: '7%' },
  { tier: 'enterprise', label: 'Enterprise', spend: '> $5M', recovery: '3%', lift: '10%', efficiency: '5%' },
];

// ─── Helpers ──────────────────────────────────────────────────────

function fmtUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

// ─── Billing Calculator Form ─────────────────────────────────────

function BillingCalculatorForm({ onResult }: { onResult: (r: BillingResult) => void }) {
  const [adSpend, setAdSpend] = useState('1000000');
  const [wasteTotal, setWasteTotal] = useState('150000');
  const [qualityWaste, setQualityWaste] = useState('25000');
  const [supplyChainSavings, setSupplyChainSavings] = useState('10000');
  const [cpaOvershoot, setCpaOvershoot] = useState('20000');
  const [reallocationSavings, setReallocationSavings] = useState('15000');
  const [measurementWaste, setMeasurementWaste] = useState('8000');
  const [kpiLift, setKpiLift] = useState('50000');
  const [roasLift, setRoasLift] = useState('75000');
  const [roiLift, setRoiLift] = useState('30000');
  const [attributionRevenue, setAttributionRevenue] = useState('200000');
  const [modeledContribution, setModeledContribution] = useState('180000');
  const [cpcSavings, setCpcSavings] = useState('12000');
  const [cpmSavings, setCpmSavings] = useState('8000');
  const [ctrRevenue, setCtrRevenue] = useState('15000');
  const [viewability, setViewability] = useState('5000');
  const [brandSafety, setBrandSafety] = useState('3000');

  const handleCalculate = () => {
    const input: BillingInput = {
      ad_spend: num(adSpend),
      recovery: {
        waste_total: num(wasteTotal),
        quality_waste: num(qualityWaste),
        supply_chain_savings: num(supplyChainSavings),
        cpa_overshoot_savings: num(cpaOvershoot),
        reallocation_savings: num(reallocationSavings),
        measurement_waste: num(measurementWaste),
      },
      lift: {
        kpi_lift_dollars: num(kpiLift),
        roas_lift_dollars: num(roasLift),
        roi_lift_dollars: num(roiLift),
        media_driven_sales: {
          attribution_revenue: num(attributionRevenue),
          modeled_contribution: num(modeledContribution),
        },
      },
      efficiency: {
        cpc_savings: num(cpcSavings),
        cpm_savings: num(cpmSavings),
        ctr_revenue_impact: num(ctrRevenue),
        viewability_savings: num(viewability),
        brand_safety_savings: num(brandSafety),
      },
    };
    onResult(calculateBilling(input));
  };

  return (
    <Card title="Billing Calculator">
      <p className="mb-4 text-sm text-gray-500">
        Enter estimated values to preview your outcome-based fee. All calculations run locally.
      </p>

      {/* Ad Spend */}
      <div className="mb-5">
        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Monthly Ad Spend</label>
        <NumberInput value={adSpend} onChange={setAdSpend} placeholder="1000000" />
      </div>

      {/* Recovery */}
      <FieldGroup title="Recovery Sources" color="green">
        <NumberInput label="Waste detected (Leak Detector)" value={wasteTotal} onChange={setWasteTotal} />
        <NumberInput label="Quality waste" value={qualityWaste} onChange={setQualityWaste} />
        <NumberInput label="Supply chain savings" value={supplyChainSavings} onChange={setSupplyChainSavings} />
        <NumberInput label="CPA overshoot savings" value={cpaOvershoot} onChange={setCpaOvershoot} />
        <NumberInput label="Reallocation savings" value={reallocationSavings} onChange={setReallocationSavings} />
        <NumberInput label="Measurement waste" value={measurementWaste} onChange={setMeasurementWaste} />
      </FieldGroup>

      {/* Lift */}
      <FieldGroup title="Lift Sources" color="blue">
        <NumberInput label="KPI lift from optimization" value={kpiLift} onChange={setKpiLift} />
        <NumberInput label="ROAS improvement value" value={roasLift} onChange={setRoasLift} />
        <NumberInput label="ROI improvement value" value={roiLift} onChange={setRoiLift} />
        <NumberInput label="Attribution revenue (MDS)" value={attributionRevenue} onChange={setAttributionRevenue} />
        <NumberInput label="Modeled contribution (MDS)" value={modeledContribution} onChange={setModeledContribution} />
      </FieldGroup>

      {/* Efficiency */}
      <FieldGroup title="Efficiency Savings" color="purple">
        <NumberInput label="CPC reduction savings" value={cpcSavings} onChange={setCpcSavings} />
        <NumberInput label="CPM optimization savings" value={cpmSavings} onChange={setCpmSavings} />
        <NumberInput label="CTR improvement revenue" value={ctrRevenue} onChange={setCtrRevenue} />
        <NumberInput label="Viewability savings" value={viewability} onChange={setViewability} />
        <NumberInput label="Brand safety savings" value={brandSafety} onChange={setBrandSafety} />
      </FieldGroup>

      <button
        onClick={handleCalculate}
        className="mt-4 w-full rounded-lg bg-[#00e5a0] px-5 py-3 text-sm font-semibold text-black hover:bg-[#00c98d]"
      >
        Calculate Fee
      </button>
    </Card>
  );
}

function NumberInput({ label, value, onChange, placeholder }: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      {label && <label className="block text-xs text-gray-500 mb-0.5">{label}</label>}
      <div className="relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-gray-200 pl-6 pr-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
        />
      </div>
    </div>
  );
}

function FieldGroup({ title, children }: { title: string; color?: string; children: React.ReactNode }) {
  const borderColor = 'border-zinc-200';
  const titleColor = 'text-zinc-600';
  return (
    <div className={`mb-4 rounded-lg border ${borderColor} p-4`}>
      <h4 className={`text-xs font-semibold uppercase tracking-wider ${titleColor} mb-3`}>{title}</h4>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {children}
      </div>
    </div>
  );
}

function num(s: string): number {
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// ─── Tier Calculator Component ────────────────────────────────────

function TierCalculator() {
  const [spend, setSpend] = useState('');
  const [preview, setPreview] = useState<TierRates | null>(null);
  const [loading, setLoading] = useState(false);

  const handlePreview = async () => {
    const val = parseFloat(spend);
    if (!val || val <= 0) return;
    setLoading(true);
    try {
      const tier = await getTierPreview(val);
      setPreview(tier);
    } catch {
      // Fallback: calculate locally
      const numSpend = val;
      if (numSpend >= 5_000_000) setPreview({ tier: 'enterprise', label: 'Enterprise', min_spend: 5_000_000, max_spend: null, recovery_rate: 0.03, lift_rate: 0.10, efficiency_rate: 0.05 });
      else if (numSpend >= 2_000_000) setPreview({ tier: 'scale', label: 'Scale', min_spend: 2_000_000, max_spend: 5_000_000, recovery_rate: 0.04, lift_rate: 0.14, efficiency_rate: 0.07 });
      else if (numSpend >= 500_000) setPreview({ tier: 'growth', label: 'Growth', min_spend: 500_000, max_spend: 2_000_000, recovery_rate: 0.045, lift_rate: 0.17, efficiency_rate: 0.085 });
      else setPreview({ tier: 'starter', label: 'Starter', min_spend: 0, max_spend: 500_000, recovery_rate: 0.05, lift_rate: 0.20, efficiency_rate: 0.10 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="Tier Calculator">
      <p className="text-sm text-gray-500 mb-4">
        Enter your monthly ad spend to see which tier and rates apply.
      </p>
      <div className="flex gap-3">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
          <input
            type="number"
            value={spend}
            onChange={(e) => setSpend(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handlePreview()}
            placeholder="2,500,000"
            className="w-full rounded-lg border border-gray-200 pl-7 pr-3 py-2.5 text-sm text-gray-700 placeholder:text-gray-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
          />
        </div>
        <button
          onClick={() => void handlePreview()}
          disabled={loading || !spend}
          className="rounded-lg bg-[#00e5a0] px-5 py-2.5 text-sm font-semibold text-black hover:bg-[#00c98d] disabled:opacity-50"
        >
          {loading ? '...' : 'Calculate'}
        </button>
      </div>

      {preview && (
        <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-zinc-900">{preview.label} Tier</span>
            <span className="rounded-full bg-zinc-200 px-2.5 py-0.5 text-xs font-medium text-zinc-700">
              {fmtUsd(parseFloat(spend))} spend
            </span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-gray-500">Recovery</p>
              <p className="text-lg font-bold text-green-600">{fmtPct(preview.recovery_rate * 100)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Lift</p>
              <p className="text-lg font-bold text-zinc-900">{fmtPct(preview.lift_rate * 100)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Efficiency</p>
              <p className="text-lg font-bold text-purple-600">{fmtPct(preview.efficiency_rate * 100)}</p>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

// ─── Billing History Row ──────────────────────────────────────────

function BillingHistoryRow({ record }: { record: ScorecardSummary }) {
  const statusColor: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    accepted: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
  };

  return (
    <div className="flex items-center gap-4 border-b border-gray-100 py-3 last:border-b-0">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900">{fmtUsd(record.ad_spend)}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[record.status] ?? ''}`}>
            {record.status}
          </span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{record.tier}</span>
        </div>
        <p className="mt-0.5 text-xs text-gray-500">{new Date(record.created_at).toLocaleString()}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold text-gray-900">{fmtUsd(record.total_fee)} fee</p>
        <p className="text-xs text-gray-500">{fmtUsd(record.value_delivered)} value | {record.roi_on_fee.toFixed(1)}x</p>
      </div>
    </div>
  );
}

// ─── Fee Breakdown Card ─────────────────────────────────────────────

function FeeBreakdownCard({ billing }: { billing: BillingResult }) {
  return (
    <Card title="Fee Breakdown">
      <div className="space-y-4">
        {[billing.recovery_fee, billing.lift_fee, billing.efficiency_fee].map((fee) => (
          <div key={fee.category} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-900 capitalize">{fee.category} Fee</h4>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-gray-500">{fmtUsd(fee.base_amount)} x {fmtPct(fee.rate * 100)}</span>
                <span className="font-bold text-gray-900">= {fmtUsd(fee.fee)}</span>
              </div>
            </div>
            {fee.line_items.length > 0 && (
              <div className="mt-2 space-y-1">
                {fee.line_items.map((item, i) => (
                  <div key={i} className="flex justify-between text-xs text-gray-500">
                    <span>{item.label}</span>
                    <span>{fmtUsd(item.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        <div className="flex items-center justify-between rounded-lg bg-gray-900 p-4 text-white">
          <span className="font-semibold">Total Fee</span>
          <div className="text-right">
            <span className="text-xl font-bold">{fmtUsd(billing.total_fee)}</span>
            <span className="ml-3 rounded-full bg-green-500/20 px-2.5 py-0.5 text-xs font-medium text-green-300">
              {billing.roi_on_fee.toFixed(1)}x ROI on fee
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────

export function BillingPage() {
  const [billing, setBilling] = useState<BillingResult | null>(null);
  const [history, setHistory] = useState<ScorecardSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [calcResult, setCalcResult] = useState<BillingResult | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sc, hist] = await Promise.allSettled([
        getLatestScorecard(),
        listScorecards(),
      ]);
      if (sc.status === 'fulfilled') setBilling(sc.value.billing);
      if (hist.status === 'fulfilled') setHistory(hist.value);
    } catch {
      // No data yet
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  // Aggregate billing stats from history
  const totalFees = history.filter(h => h.status === 'accepted').reduce((sum, h) => sum + h.total_fee, 0);
  const totalValue = history.filter(h => h.status === 'accepted').reduce((sum, h) => sum + h.value_delivered, 0);
  const avgRoi = totalFees > 0 ? totalValue / totalFees : 0;

  // Active billing = from scorecard if available, otherwise from calculator
  const activeBilling = billing ?? calcResult;

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Spinner /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Billing</h2>
        <p className="mt-1 text-sm text-gray-500">
          Outcome-based pricing: OpenAgency earns only when you save or earn more.
        </p>
      </div>

      {/* Summary Metrics */}
      {activeBilling && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Current Fee"
            value={fmtUsd(activeBilling.total_fee)}
            sub={`${activeBilling.tier.label} tier`}
            color="blue"
          />
          <MetricCard
            label="Value Delivered"
            value={fmtUsd(activeBilling.value_delivered)}
            sub={`${activeBilling.roi_on_fee.toFixed(1)}x ROI`}
            color="green"
          />
          <MetricCard
            label="Fee % of Spend"
            value={fmtPct(activeBilling.fee_as_pct_of_spend)}
            sub="outcome-based"
            color="gray"
          />
          <MetricCard
            label="Total Accepted Fees"
            value={fmtUsd(totalFees)}
            sub={avgRoi > 0 ? `${avgRoi.toFixed(1)}x avg ROI` : 'no accepted scorecards yet'}
            color="yellow"
          />
        </div>
      )}

      {/* How It Works */}
      <Card title="How Outcome-Based Billing Works">
        <div className="space-y-4 text-sm text-gray-600">
          <p>
            OpenAgency charges three fee streams, each a percentage of the <strong>value we deliver</strong> — not your ad spend.
            If we find no waste, generate no lift, and create no efficiency gains, you pay nothing.
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <h4 className="font-semibold text-green-700">Recovery Fee</h4>
              <p className="mt-1 text-xs text-green-600">
                % of waste eliminated: budget waste, quality waste, supply chain savings, CPA overshoot, measurement waste.
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
              <h4 className="font-semibold text-zinc-700">Lift Fee</h4>
              <p className="mt-1 text-xs text-zinc-500">
                % of performance improvement: KPI lift, ROAS improvement, ROI improvement, Media-Driven Sales.
              </p>
            </div>
            <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
              <h4 className="font-semibold text-purple-700">Efficiency Fee</h4>
              <p className="mt-1 text-xs text-purple-600">
                % of execution savings: CPC reduction, CPM optimization, CTR revenue impact, viewability, brand safety.
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Tier Structure */}
      <Card title="Tier Structure">
        <p className="mb-4 text-sm text-gray-500">
          Rates decrease as your ad spend increases — rewarding scale with better economics.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="pb-3 text-left font-semibold text-gray-900">Tier</th>
                <th className="pb-3 text-left font-semibold text-gray-900">Monthly Spend</th>
                <th className="pb-3 text-center font-semibold text-green-700">Recovery</th>
                <th className="pb-3 text-center font-semibold text-zinc-700">Lift</th>
                <th className="pb-3 text-center font-semibold text-purple-700">Efficiency</th>
              </tr>
            </thead>
            <tbody>
              {TIERS.map((t) => (
                <tr
                  key={t.tier}
                  className={`border-b border-gray-50 ${activeBilling?.tier.tier === t.tier ? 'bg-zinc-50' : ''}`}
                >
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{t.label}</span>
                      {activeBilling?.tier.tier === t.tier && (
                        <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700">Current</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 text-gray-600">{t.spend}</td>
                  <td className="py-3 text-center font-medium text-green-600">{t.recovery}</td>
                  <td className="py-3 text-center font-medium text-zinc-700">{t.lift}</td>
                  <td className="py-3 text-center font-medium text-purple-600">{t.efficiency}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Tier Calculator */}
      <TierCalculator />

      {/* Fee Breakdown — from scorecard or calculator */}
      {activeBilling && <FeeBreakdownCard billing={activeBilling} />}

      {/* Billing Calculator Form — shown as empty state or always available */}
      {!billing && (
        <BillingCalculatorForm onResult={setCalcResult} />
      )}

      {/* Billing History */}
      {history.length > 0 && (
        <Card title="Billing History">
          <div className="divide-y divide-gray-100">
            {history.map((record) => (
              <BillingHistoryRow key={record.id} record={record} />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
