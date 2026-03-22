// ─── Billing Page ──────────────────────────────────────────────────
// Outcome-based billing transparency: tiers, fee structure, calculator.

import { useState, useEffect, useCallback } from 'react';
import { Spinner } from '../components/Spinner';
import type {
  ScorecardSummary,
  BillingResult,
  TierRates,
} from '../api/scorecard';
import { listScorecards, getLatestScorecard, getTierPreview } from '../api/scorecard';
import { calculateBilling } from '@openagency/core';
import type { BillingInput } from '@openagency/core';
import {
  GlassCard,
  GlassCardHeader,
  GlassCardTitle,
  GlassCardContent,
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

// ─── Tier Data (mirrors packages/core/src/billing.ts) ─────────────

const TIERS: Array<{
  tier: string;
  label: string;
  spend: string;
  recovery: string;
  lift: string;
  efficiency: string;
}> = [
  { tier: 'starter', label: 'Starter', spend: '< $500K', recovery: '5%', lift: '0.5% - 1.5%', efficiency: '0.5% - 1.5%' },
  { tier: 'growth', label: 'Growth', spend: '$500K - $2M', recovery: '4.5%', lift: '0.5% - 1.5%', efficiency: '0.5% - 1.5%' },
  { tier: 'scale', label: 'Scale', spend: '$2M - $5M', recovery: '4%', lift: '0.5% - 1.5%', efficiency: '0.5% - 1.5%' },
  { tier: 'enterprise', label: 'Enterprise', spend: '> $5M', recovery: '3%', lift: '0.5% - 1.5%', efficiency: '0.5% - 1.5%' },
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

const RATE_OPTIONS = [
  { value: '0.005', label: '0.5%' },
  { value: '0.0075', label: '0.75%' },
  { value: '0.01', label: '1.0%' },
  { value: '0.0125', label: '1.25%' },
  { value: '0.015', label: '1.5%' },
];

function BillingCalculatorForm({ onResult }: { onResult: (r: BillingResult) => void }) {
  const [adSpend, setAdSpend] = useState('1000000');
  const [liftRate, setLiftRate] = useState('0.01');
  const [efficiencyRate, setEfficiencyRate] = useState('0.01');
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
      client_lift_rate: parseFloat(liftRate),
      client_efficiency_rate: parseFloat(efficiencyRate),
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
    <GlassCard>
      <GlassCardHeader>
        <GlassCardTitle>Billing Calculator</GlassCardTitle>
      </GlassCardHeader>
      <GlassCardContent>
        <p className="mb-4 text-sm text-white/50">
          Enter estimated values to preview your outcome-based fee. All calculations run locally.
        </p>

        {/* Ad Spend */}
        <div className="mb-5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-white/50 mb-1">Monthly Ad Spend</label>
          <NumberInput value={adSpend} onChange={setAdSpend} placeholder="1000000" />
        </div>

        {/* Client Rate Selection */}
        <div className="mb-5 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-white/50 mb-1">Lift Fee Rate</label>
            <select
              value={liftRate}
              onChange={(e) => setLiftRate(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/95 focus:border-[#00F5FF]/50 focus:outline-none focus:ring-1 focus:ring-[#00F5FF]/30"
            >
              {RATE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value} className="bg-[#0A0A0F] text-white">{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-white/50 mb-1">Efficiency Fee Rate</label>
            <select
              value={efficiencyRate}
              onChange={(e) => setEfficiencyRate(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/95 focus:border-[#00F5FF]/50 focus:outline-none focus:ring-1 focus:ring-[#00F5FF]/30"
            >
              {RATE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value} className="bg-[#0A0A0F] text-white">{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Recovery */}
        <FieldGroup title="Recovery Sources">
          <NumberInput label="Waste detected (Leak Detector)" value={wasteTotal} onChange={setWasteTotal} />
          <NumberInput label="Quality waste" value={qualityWaste} onChange={setQualityWaste} />
          <NumberInput label="Supply chain savings" value={supplyChainSavings} onChange={setSupplyChainSavings} />
          <NumberInput label="CPA overshoot savings" value={cpaOvershoot} onChange={setCpaOvershoot} />
          <NumberInput label="Reallocation savings" value={reallocationSavings} onChange={setReallocationSavings} />
          <NumberInput label="Measurement waste" value={measurementWaste} onChange={setMeasurementWaste} />
        </FieldGroup>

        {/* Lift */}
        <FieldGroup title="Lift Sources">
          <NumberInput label="KPI lift from optimization" value={kpiLift} onChange={setKpiLift} />
          <NumberInput label="ROAS improvement value" value={roasLift} onChange={setRoasLift} />
          <NumberInput label="ROI improvement value" value={roiLift} onChange={setRoiLift} />
          <NumberInput label="Attribution revenue (MDS)" value={attributionRevenue} onChange={setAttributionRevenue} />
          <NumberInput label="Modeled contribution (MDS)" value={modeledContribution} onChange={setModeledContribution} />
        </FieldGroup>

        {/* Efficiency */}
        <FieldGroup title="Efficiency Savings">
          <NumberInput label="CPC reduction savings" value={cpcSavings} onChange={setCpcSavings} />
          <NumberInput label="CPM optimization savings" value={cpmSavings} onChange={setCpmSavings} />
          <NumberInput label="CTR improvement revenue" value={ctrRevenue} onChange={setCtrRevenue} />
          <NumberInput label="Viewability savings" value={viewability} onChange={setViewability} />
          <NumberInput label="Brand safety savings" value={brandSafety} onChange={setBrandSafety} />
        </FieldGroup>

        <GlassButton variant="primary" className="mt-4 w-full" onClick={handleCalculate}>
          Calculate Fee
        </GlassButton>
      </GlassCardContent>
    </GlassCard>
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
      {label && <label className="block text-xs text-white/50 mb-0.5">{label}</label>}
      <div className="relative">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40 text-xs">$</span>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-white/10 bg-white/5 pl-6 pr-3 py-2 text-sm text-white/95 placeholder:text-white/30 focus:border-[#00F5FF]/50 focus:outline-none focus:ring-1 focus:ring-[#00F5FF]/30"
        />
      </div>
    </div>
  );
}

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 rounded-lg border border-white/10 bg-white/5 p-4">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-white/50 mb-3">{title}</h4>
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
      const numSpend = val;
      if (numSpend >= 5_000_000) setPreview({ tier: 'enterprise', label: 'Enterprise', min_spend: 5_000_000, max_spend: null, recovery_rate: 0.03, lift_rate: 0.01, efficiency_rate: 0.01 });
      else if (numSpend >= 2_000_000) setPreview({ tier: 'scale', label: 'Scale', min_spend: 2_000_000, max_spend: 5_000_000, recovery_rate: 0.04, lift_rate: 0.01, efficiency_rate: 0.01 });
      else if (numSpend >= 500_000) setPreview({ tier: 'growth', label: 'Growth', min_spend: 500_000, max_spend: 2_000_000, recovery_rate: 0.045, lift_rate: 0.01, efficiency_rate: 0.01 });
      else setPreview({ tier: 'starter', label: 'Starter', min_spend: 0, max_spend: 500_000, recovery_rate: 0.05, lift_rate: 0.01, efficiency_rate: 0.01 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <GlassCard>
      <GlassCardHeader>
        <GlassCardTitle>Tier Calculator</GlassCardTitle>
      </GlassCardHeader>
      <GlassCardContent>
        <p className="text-sm text-white/50 mb-4">
          Enter your monthly ad spend to see which tier and rates apply.
        </p>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">$</span>
            <input
              type="number"
              value={spend}
              onChange={(e) => setSpend(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handlePreview()}
              placeholder="2,500,000"
              className="w-full rounded-lg border border-white/10 bg-white/5 pl-7 pr-3 py-2.5 text-sm text-white/95 placeholder:text-white/30 focus:border-[#00F5FF]/50 focus:outline-none focus:ring-1 focus:ring-[#00F5FF]/30"
            />
          </div>
          <GlassButton variant="primary" onClick={() => void handlePreview()} disabled={loading || !spend}>
            {loading ? '...' : 'Calculate'}
          </GlassButton>
        </div>

        {preview && (
          <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-white/95">{preview.label} Tier</span>
              <GlassBadge>{fmtUsd(parseFloat(spend))} spend</GlassBadge>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-white/50">Recovery</p>
                <p className="text-lg font-bold text-emerald-400">{fmtPct(preview.recovery_rate * 100)}</p>
              </div>
              <div>
                <p className="text-xs text-white/50">Lift</p>
                <p className="text-lg font-bold text-white/95">{fmtPct(preview.lift_rate * 100)}</p>
              </div>
              <div>
                <p className="text-xs text-white/50">Efficiency</p>
                <p className="text-lg font-bold text-[#7000FF]">{fmtPct(preview.efficiency_rate * 100)}</p>
              </div>
            </div>
          </div>
        )}
      </GlassCardContent>
    </GlassCard>
  );
}

// ─── Billing History Row ──────────────────────────────────────────

function BillingHistoryRow({ record }: { record: ScorecardSummary }) {
  return (
    <div className="flex items-center gap-4 border-b border-white/5 py-3 last:border-b-0">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white/95">{fmtUsd(record.ad_spend)}</span>
          <GlassBadge variant={record.status === 'accepted' ? 'success' : record.status === 'rejected' ? 'destructive' : 'warning'}>
            {record.status}
          </GlassBadge>
          <GlassBadge>{record.tier}</GlassBadge>
        </div>
        <p className="mt-0.5 text-xs text-white/50">{new Date(record.created_at).toLocaleString()}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold text-white/95">{fmtUsd(record.total_fee)} fee</p>
        <p className="text-xs text-white/50">{fmtUsd(record.value_delivered)} value | {record.roi_on_fee.toFixed(1)}x</p>
      </div>
    </div>
  );
}

// ─── Fee Breakdown Card ─────────────────────────────────────────────

function FeeBreakdownCard({ billing }: { billing: BillingResult }) {
  return (
    <GlassCard>
      <GlassCardHeader>
        <GlassCardTitle>Fee Breakdown</GlassCardTitle>
      </GlassCardHeader>
      <GlassCardContent>
        <div className="space-y-4">
          {[billing.recovery_fee, billing.lift_fee, billing.efficiency_fee].map((fee) => (
            <div key={fee.category} className="rounded-lg border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-white/95 capitalize">{fee.category} Fee</h4>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-white/50">{fmtUsd(fee.base_amount)} x {fmtPct(fee.rate * 100)}</span>
                  <span className="font-bold text-white/95">= {fmtUsd(fee.fee)}</span>
                </div>
              </div>
              {fee.line_items.length > 0 && (
                <div className="mt-2 space-y-1">
                  {fee.line_items.map((item, i) => (
                    <div key={i} className="flex justify-between text-xs text-white/50">
                      <span>{item.label}</span>
                      <span>{fmtUsd(item.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div className="flex items-center justify-between rounded-lg bg-gradient-to-r from-[#00F5FF]/20 to-[#7000FF]/20 border border-[#00F5FF]/30 p-4 text-white">
            <span className="font-semibold">Total Fee</span>
            <div className="text-right">
              <span className="text-xl font-bold">{fmtUsd(billing.total_fee)}</span>
              <span className="ml-3 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
                {billing.roi_on_fee.toFixed(1)}x ROI on fee
              </span>
            </div>
          </div>
        </div>
      </GlassCardContent>
    </GlassCard>
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

  const totalFees = history.filter(h => h.status === 'accepted').reduce((sum, h) => sum + h.total_fee, 0);
  const totalValue = history.filter(h => h.status === 'accepted').reduce((sum, h) => sum + h.value_delivered, 0);
  
  const avgRoi = totalFees > 0 ? totalValue / totalFees : 0; void avgRoi;

  const activeBilling = billing ?? calcResult;

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Spinner /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Billing</h2>
        <p className="mt-1 text-sm text-white/50">
          Outcome-based pricing: OpenAgency earns only when you save or earn more.
        </p>
      </div>

      {/* Summary Metrics */}
      {activeBilling && (
        <StatsGrid columns={4}>
          <StatCard
            label="Current Fee"
            value={fmtUsd(activeBilling.total_fee)}
          />
          <StatCard
            label="Value Delivered"
            value={fmtUsd(activeBilling.value_delivered)}
          />
          <StatCard
            label="Fee % of Spend"
            value={fmtPct(activeBilling.fee_as_pct_of_spend)}
          />
          <StatCard
            label="Total Accepted Fees"
            value={fmtUsd(totalFees)}
          />
        </StatsGrid>
      )}

      {/* How It Works */}
      <GlassCard>
        <GlassCardHeader>
          <GlassCardTitle>How Outcome-Based Billing Works</GlassCardTitle>
        </GlassCardHeader>
        <GlassCardContent>
          <div className="space-y-4 text-sm text-white/70">
            <p>
              OpenAgency charges three fee streams, each a percentage of the <strong className="text-white/95">value we deliver</strong> — not your ad spend.
              If we find no waste, generate no lift, and create no efficiency gains, you pay nothing.
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
                <h4 className="font-semibold text-emerald-300">Recovery Fee</h4>
                <p className="mt-1 text-xs text-emerald-300/70">
                  % of waste eliminated: budget waste, quality waste, supply chain savings, CPA overshoot, measurement waste.
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                <h4 className="font-semibold text-white/95">Lift Fee</h4>
                <p className="mt-1 text-xs text-white/50">
                  % of performance improvement: KPI lift, ROAS improvement, ROI improvement, Media-Driven Sales.
                </p>
              </div>
              <div className="rounded-lg border border-[#7000FF]/30 bg-[#7000FF]/10 p-4">
                <h4 className="font-semibold text-purple-300">Efficiency Fee</h4>
                <p className="mt-1 text-xs text-purple-300/70">
                  % of execution savings: CPC reduction, CPM optimization, CTR revenue impact, viewability, brand safety.
                </p>
              </div>
            </div>
          </div>
        </GlassCardContent>
      </GlassCard>

      {/* Tier Structure */}
      <GlassCard>
        <GlassCardHeader>
          <GlassCardTitle>Tier Structure</GlassCardTitle>
        </GlassCardHeader>
        <GlassCardContent>
          <p className="mb-4 text-sm text-white/50">
            Recovery rates decrease as your ad spend increases. Lift and Efficiency rates are client-selectable between 0.5% and 1.5% (default 1.0%).
          </p>
          <div className="overflow-x-auto">
            <GlassTable>
              <GlassTableHeader>
                <GlassTableRow>
                  <GlassTableHead>Tier</GlassTableHead>
                  <GlassTableHead>Monthly Spend</GlassTableHead>
                  <GlassTableHead className="text-center text-emerald-400">Recovery</GlassTableHead>
                  <GlassTableHead className="text-center">Lift</GlassTableHead>
                  <GlassTableHead className="text-center text-purple-400">Efficiency</GlassTableHead>
                </GlassTableRow>
              </GlassTableHeader>
              <GlassTableBody>
                {TIERS.map((t) => (
                  <GlassTableRow
                    key={t.tier}
                    className={activeBilling?.tier.tier === t.tier ? 'bg-[#00F5FF]/5' : ''}
                  >
                    <GlassTableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white/95">{t.label}</span>
                        {activeBilling?.tier.tier === t.tier && (
                          <GlassBadge variant="info">Current</GlassBadge>
                        )}
                      </div>
                    </GlassTableCell>
                    <GlassTableCell className="text-white/70">{t.spend}</GlassTableCell>
                    <GlassTableCell className="text-center font-medium text-emerald-400">{t.recovery}</GlassTableCell>
                    <GlassTableCell className="text-center font-medium text-white/70">{t.lift}</GlassTableCell>
                    <GlassTableCell className="text-center font-medium text-purple-400">{t.efficiency}</GlassTableCell>
                  </GlassTableRow>
                ))}
              </GlassTableBody>
            </GlassTable>
          </div>
        </GlassCardContent>
      </GlassCard>

      {/* Tier Calculator */}
      <TierCalculator />

      {/* Fee Breakdown */}
      {activeBilling && <FeeBreakdownCard billing={activeBilling} />}

      {/* Billing Calculator Form */}
      {!billing && (
        <BillingCalculatorForm onResult={setCalcResult} />
      )}

      {/* Billing History */}
      {history.length > 0 && (
        <GlassCard>
          <GlassCardHeader>
            <GlassCardTitle>Billing History</GlassCardTitle>
          </GlassCardHeader>
          <GlassCardContent>
            <div className="divide-y divide-white/5">
              {history.map((record) => (
                <BillingHistoryRow key={record.id} record={record} />
              ))}
            </div>
          </GlassCardContent>
        </GlassCard>
      )}
    </div>
  );
}
