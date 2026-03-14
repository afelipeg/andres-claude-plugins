/*
 * Billing — Outcome-Based Invoicing
 * 5% of waste recovered + 3% of Media Architect & Campaign Ops benefit
 * Data sourced from Executive Bridge (Shapley attribution as source of truth)
 * Total invoice target: $25K–$37K
 *
 * Calculations:
 * - Waste Waterfall total waste: $247,800
 * - Waste Recovery Fee: $247,800 × 5% = $12,390
 * - Media Architect ROAS improvement: Budget $500K, ROAS 2.8x→4.1x, incremental revenue = $650,000
 *   Fee: $650,000 × 3% = $19,500
 * - Campaign Ops media-driven sales delta: Cross-channel reallocation saved $85K in waste + $42K uplift
 *   Combined benefit: $127,000, Fee: $127,000 × 3% = $3,810 (capped to keep total in range)
 * - Total: $12,390 + $19,500 + $3,810 = $35,700 (within $25K–$37K range)
 */
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, ComposedChart, Line, Area,
} from "recharts";
import DemoLayout from "@/components/demo/DemoLayout";

// ─── Billing Line Items ─────────────────────────────────
const wasteRecovered = 247800;
const wasteRecoveryRate = 0.05;
const wasteRecoveryFee = wasteRecovered * wasteRecoveryRate; // $12,390

const mediaArchitectBenefit = 650000; // Incremental revenue from ROAS 2.8x → 4.1x
const mediaArchitectRate = 0.03;
const mediaArchitectFee = mediaArchitectBenefit * mediaArchitectRate; // $19,500

const campaignOpsBenefit = 127000; // Cross-channel reallocation savings + uplift
const campaignOpsRate = 0.03;
const campaignOpsFee = campaignOpsBenefit * campaignOpsRate; // $3,810

const totalInvoice = wasteRecoveryFee + mediaArchitectFee + campaignOpsFee; // $35,700
const totalBenefitGenerated = wasteRecovered + mediaArchitectBenefit + campaignOpsBenefit; // $1,024,800
const effectiveRate = (totalInvoice / totalBenefitGenerated * 100); // ~3.5%

// ─── Traditional Agency Comparison ──────────────────────
const totalAdSpend = 500000;
const traditionalAgencyFee = totalAdSpend * 0.15; // $75,000
const savingsVsAgency = traditionalAgencyFee - totalInvoice; // $39,300

// ─── Invoice Line Items ─────────────────────────────────
const lineItems = [
  {
    engine: "Leak Detector",
    description: "Waste Recovery Fee",
    basis: "Total waste identified via 6-stage Waste Waterfall",
    basisAmount: wasteRecovered,
    rate: "5%",
    fee: wasteRecoveryFee,
    color: "#ff3366",
    source: "Executive Bridge → Shapley Attribution",
  },
  {
    engine: "Media Architect",
    description: "ROAS Optimization Fee",
    basis: "Incremental revenue from Hill curve optimization (ROAS 2.8x → 4.1x)",
    basisAmount: mediaArchitectBenefit,
    rate: "3%",
    fee: mediaArchitectFee,
    color: "#3b82f6",
    source: "Executive Bridge → Revenue Reconciliation",
  },
  {
    engine: "Campaign Ops",
    description: "Performance Optimization Fee",
    basis: "Media-driven sales delta from cross-channel reallocation & pacing fixes",
    basisAmount: campaignOpsBenefit,
    rate: "3%",
    fee: campaignOpsFee,
    color: "#ff6b35",
    source: "Executive Bridge → Incrementality Testing",
  },
];

// ─── Monthly Billing History (12 months) ────────────────
const billingHistory = [
  { month: "Jan", waste: 8200, media: 12400, campaign: 2100, total: 22700 },
  { month: "Feb", waste: 9100, media: 14200, campaign: 2800, total: 26100 },
  { month: "Mar", waste: 10400, media: 15800, campaign: 3200, total: 29400 },
  { month: "Apr", waste: 11200, media: 16500, campaign: 3400, total: 31100 },
  { month: "May", waste: 10800, media: 17200, campaign: 3100, total: 31100 },
  { month: "Jun", waste: 11500, media: 18100, campaign: 3500, total: 33100 },
  { month: "Jul", waste: 11800, media: 18800, campaign: 3600, total: 34200 },
  { month: "Aug", waste: 12100, media: 19200, campaign: 3700, total: 35000 },
  { month: "Sep", waste: 12000, media: 19100, campaign: 3650, total: 34750 },
  { month: "Oct", waste: 12200, media: 19400, campaign: 3750, total: 35350 },
  { month: "Nov", waste: 12300, media: 19500, campaign: 3800, total: 35600 },
  { month: "Dec", waste: 12390, media: 19500, campaign: 3810, total: 35700 },
];

// ─── Fee Breakdown Donut ────────────────────────────────
const feeBreakdown = [
  { name: "Waste Recovery (Leak Detector)", value: wasteRecoveryFee, fill: "#ff3366" },
  { name: "ROAS Optimization (Media Architect)", value: mediaArchitectFee, fill: "#3b82f6" },
  { name: "Performance (Campaign Ops)", value: campaignOpsFee, fill: "#ff6b35" },
];

// ─── Comparison Bar ─────────────────────────────────────
const comparisonData = [
  { name: "Traditional Agency (15%)", value: traditionalAgencyFee, color: "rgba(255,255,255,0.15)" },
  { name: "Plinth (outcome-based)", value: totalInvoice, color: "#00e5a0" },
];

// ─── ROI Waterfall ──────────────────────────────────────
const roiWaterfall = [
  { name: "Waste Recovered", value: wasteRecovered, color: "#ff3366" },
  { name: "ROAS Uplift", value: mediaArchitectBenefit, color: "#3b82f6" },
  { name: "Campaign Delta", value: campaignOpsBenefit, color: "#ff6b35" },
  { name: "Plinth Fee", value: -totalInvoice, color: "#f59e0b" },
  { name: "Net Benefit", value: totalBenefitGenerated - totalInvoice, color: "#00e5a0" },
];

// ─── Animated Counter ───────────────────────────────────
function AnimatedValue({ value, prefix = "$" }: { value: number; prefix?: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const duration = 1500;
    const start = performance.now();
    function animate(now: number) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(value * eased));
      if (progress < 1) requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
  }, [value]);
  return <span>{prefix}{display.toLocaleString()}</span>;
}

// ─── Main Page ──────────────────────────────────────────
export default function BillingPage() {
  return (
    <DemoLayout>
      <div className="space-y-6">
        {/* Hero metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {[
            { label: "Monthly Invoice", value: totalInvoice, prefix: "$", color: "#00e5a0" },
            { label: "Total Benefit Generated", value: totalBenefitGenerated, prefix: "$", color: "#3b82f6" },
            { label: "Effective Rate", value: `${effectiveRate.toFixed(1)}%`, color: "#a78bfa", isText: true },
            { label: "Savings vs. Agency (15%)", value: savingsVsAgency, prefix: "$", color: "#00e5a0" },
          ].map((m, i) => (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="rounded-xl border border-white/[0.06] p-5"
              style={{ background: "rgba(255,255,255,0.02)" }}
            >
              <p className="text-[10px] text-zinc-600 mb-1 font-medium uppercase tracking-wider">{m.label}</p>
              <p className="text-2xl font-mono font-bold" style={{ color: m.color }}>
                {(m as any).isText ? m.value : <AnimatedValue value={m.value as number} prefix={m.prefix} />}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Invoice Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl border border-white/[0.06] p-6"
          style={{ background: "rgba(255,255,255,0.02)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Invoice — December 2025</h3>
            <span className="text-[10px] px-2 py-1 rounded-full bg-[#00e5a0]/10 text-[#00e5a0] font-medium">
              Outcome-based pricing
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {["Engine", "Description", "Benefit Basis", "Rate", "Fee", "Data Source"].map(h => (
                    <th key={h} className="text-left py-3 px-3 text-[10px] text-zinc-600 font-medium uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, i) => (
                  <motion.tr
                    key={item.engine}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 + i * 0.1 }}
                    className="border-b border-white/[0.03] hover:bg-white/[0.02]"
                  >
                    <td className="py-4 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="font-semibold text-white">{item.engine}</span>
                      </div>
                    </td>
                    <td className="py-4 px-3 text-zinc-400">{item.description}</td>
                    <td className="py-4 px-3">
                      <div>
                        <p className="font-mono text-white">${item.basisAmount.toLocaleString()}</p>
                        <p className="text-[9px] text-zinc-600 mt-0.5">{item.basis}</p>
                      </div>
                    </td>
                    <td className="py-4 px-3 font-mono font-bold" style={{ color: item.color }}>{item.rate}</td>
                    <td className="py-4 px-3 font-mono font-bold text-white">${item.fee.toLocaleString()}</td>
                    <td className="py-4 px-3">
                      <code className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/[0.04] text-zinc-500">
                        {item.source}
                      </code>
                    </td>
                  </motion.tr>
                ))}
                <tr className="border-t-2 border-white/[0.08]">
                  <td className="py-4 px-3 font-bold text-white" colSpan={4}>Total Invoice</td>
                  <td className="py-4 px-3 font-mono font-bold text-2xl text-[#00e5a0]">${totalInvoice.toLocaleString()}</td>
                  <td className="py-4 px-3"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Fee Breakdown + Agency Comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Donut */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="lg:col-span-4 rounded-xl border border-white/[0.06] p-6"
            style={{ background: "rgba(255,255,255,0.02)" }}
          >
            <h3 className="text-sm font-semibold text-white mb-4">Fee Breakdown by Engine</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={feeBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {feeBreakdown.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#141418", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, ""]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1 mt-2">
              {feeBreakdown.map(d => (
                <div key={d.name} className="flex items-center justify-between text-[9px]">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.fill }} />
                    <span className="text-zinc-500">{d.name}</span>
                  </div>
                  <span className="font-mono text-zinc-400">${d.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Agency Comparison */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="lg:col-span-4 rounded-xl border border-white/[0.06] p-6"
            style={{ background: "rgba(255,255,255,0.02)" }}
          >
            <h3 className="text-sm font-semibold text-white mb-4">Plinth vs. Traditional Agency</h3>
            <div className="space-y-6 mt-8">
              {comparisonData.map((d, i) => (
                <div key={d.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-zinc-500">{d.name}</span>
                    <span className="text-sm font-mono font-bold" style={{ color: i === 1 ? "#00e5a0" : "#71717a" }}>
                      ${d.value.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-6 rounded bg-white/[0.04] overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(d.value / traditionalAgencyFee) * 100}%` }}
                      transition={{ duration: 1.5, delay: 0.6 + i * 0.2, ease: "easeOut" }}
                      className="h-full rounded"
                      style={{ backgroundColor: d.color }}
                    />
                  </div>
                </div>
              ))}
              <div className="pt-4 border-t border-white/[0.06]">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-zinc-500">Your savings</span>
                  <span className="text-lg font-mono font-bold text-[#00e5a0]">${savingsVsAgency.toLocaleString()}</span>
                </div>
                <p className="text-[9px] text-zinc-600 mt-1">
                  {((savingsVsAgency / traditionalAgencyFee) * 100).toFixed(0)}% less than traditional agency model — and you only pay for measurable outcomes.
                </p>
              </div>
            </div>
          </motion.div>

          {/* ROI Waterfall */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="lg:col-span-4 rounded-xl border border-white/[0.06] p-6"
            style={{ background: "rgba(255,255,255,0.02)" }}
          >
            <h3 className="text-sm font-semibold text-white mb-4">ROI Waterfall</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={roiWaterfall} barCategoryGap="15%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "#52525b", fontSize: 8 }}
                  axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
                  tickLine={false}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                />
                <YAxis
                  tick={{ fill: "#52525b", fontSize: 9, fontFamily: "'JetBrains Mono', monospace" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}K`}
                />
                <Tooltip
                  contentStyle={{ background: "#141418", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }}
                  formatter={(value: number) => [`$${Math.abs(value).toLocaleString()}`, ""]}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {roiWaterfall.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="text-[9px] text-zinc-600 mt-2 text-center">
              Net benefit: <span className="font-mono text-[#00e5a0] font-bold">${(totalBenefitGenerated - totalInvoice).toLocaleString()}</span> after Plinth fee
            </p>
          </motion.div>
        </div>

        {/* Monthly Billing History */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="rounded-xl border border-white/[0.06] p-6"
          style={{ background: "rgba(255,255,255,0.02)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Monthly Billing History (2025)</h3>
            <span className="text-[10px] px-2 py-1 rounded-full bg-[#a78bfa]/10 text-[#a78bfa] font-medium">
              YTD Total: ${billingHistory.reduce((s, d) => s + d.total, 0).toLocaleString()}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={billingHistory}>
              <defs>
                <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00e5a0" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#00e5a0" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fill: "#52525b", fontSize: 10 }}
                axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#52525b", fontSize: 9, fontFamily: "'JetBrains Mono', monospace" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}K`}
              />
              <Tooltip
                contentStyle={{ background: "#141418", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }}
                formatter={(value: number) => [`$${value.toLocaleString()}`, ""]}
              />
              <Bar dataKey="waste" stackId="a" fill="#ff3366" name="Waste Recovery" radius={[0, 0, 0, 0]} />
              <Bar dataKey="media" stackId="a" fill="#3b82f6" name="Media Architect" radius={[0, 0, 0, 0]} />
              <Bar dataKey="campaign" stackId="a" fill="#ff6b35" name="Campaign Ops" radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="total" stroke="#00e5a0" strokeWidth={2} dot={false} name="Total" />
            </ComposedChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-6 mt-3 text-[10px]">
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-[#ff3366]" /><span className="text-zinc-500">Waste Recovery (5%)</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-[#3b82f6]" /><span className="text-zinc-500">Media Architect (3%)</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-[#ff6b35]" /><span className="text-zinc-500">Campaign Ops (3%)</span></div>
            <div className="flex items-center gap-2"><div className="w-2 h-0.5 bg-[#00e5a0]" /><span className="text-zinc-500">Total Invoice</span></div>
          </div>
        </motion.div>

        {/* Pricing Model Explainer */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="rounded-xl border border-[#00e5a0]/20 p-6"
          style={{ background: "rgba(0,229,160,0.02)" }}
        >
          <h3 className="text-sm font-semibold text-[#00e5a0] mb-3">How Plinth Billing Works</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
            <div>
              <p className="text-xs font-semibold text-white mb-1">1. Measure</p>
              <p className="text-[10px] text-zinc-500 leading-relaxed">
                Executive Bridge uses Shapley attribution (game theory) to calculate the true contribution of each channel and the real revenue impact — not platform-reported vanity metrics.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-white mb-1">2. Calculate</p>
              <p className="text-[10px] text-zinc-500 leading-relaxed">
                Plinth charges 5% of waste identified by Leak Detector + 3% of incremental revenue generated by Media Architect and Campaign Ops. You only pay for measurable outcomes.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-white mb-1">3. Invoice</p>
              <p className="text-[10px] text-zinc-500 leading-relaxed">
                Monthly invoice with full transparency. Every line item traces back to Executive Bridge data. No retainers, no % of spend, no hidden fees. If we don't generate value, you don't pay.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </DemoLayout>
  );
}
