/*
 * Campaign Ops — Campaign Lifecycle Management
 * ROAS alerts, pacing, creative fatigue, zero conversions, cross-channel reallocation
 */
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LineChart, Line, ReferenceLine,
  ComposedChart, Area,
} from "recharts";
import DemoLayout from "@/components/demo/DemoLayout";

// ─── Campaign Data ──────────────────────────────────────
const campaigns = [
  { name: "Summer Sale 2026", platform: "Meta Ads", status: "active", budget: 45000, spent: 32400, roas: 4.8, cpa: 18.50, pacing: 92, daysLeft: 8, conversions: 1751, fatigue: 12 },
  { name: "Q1 Retarget", platform: "Google Ads", status: "active", budget: 38000, spent: 29800, roas: 3.2, cpa: 28.40, pacing: 105, daysLeft: 5, conversions: 1049, fatigue: 67 },
  { name: "Brand Awareness", platform: "TikTok Ads", status: "warning", budget: 25000, spent: 22100, roas: 1.9, cpa: 42.30, pacing: 118, daysLeft: 3, conversions: 522, fatigue: 45 },
  { name: "Product Launch", platform: "Meta Ads", status: "active", budget: 60000, spent: 41200, roas: 5.1, cpa: 15.80, pacing: 88, daysLeft: 12, conversions: 2607, fatigue: 8 },
  { name: "Holiday Prep", platform: "Amazon Ads", status: "paused", budget: 30000, spent: 8400, roas: 2.4, cpa: 35.00, pacing: 45, daysLeft: 20, conversions: 240, fatigue: 3 },
  { name: "B2B LinkedIn", platform: "LinkedIn", status: "warning", budget: 15000, spent: 13200, roas: 1.4, cpa: 55.00, pacing: 132, daysLeft: 2, conversions: 240, fatigue: 78 },
];

// ─── Optimization Checks ────────────────────────────────
const optimizationChecks = [
  { rule: "CPA Overshoot", description: "CPA exceeds target by >20%", status: "alert", count: 2, campaigns: ["Brand Awareness", "B2B LinkedIn"], color: "#ff3366", icon: "↑" },
  { rule: "ROAS Alert", description: "ROAS below 2.0x threshold", status: "alert", count: 2, campaigns: ["Brand Awareness", "B2B LinkedIn"], color: "#ff3366", icon: "↓" },
  { rule: "Pacing", description: "Spend pace >110% of planned", status: "warning", count: 2, campaigns: ["Brand Awareness", "B2B LinkedIn"], color: "#f59e0b", icon: "⚡" },
  { rule: "Creative Fatigue", description: "Frequency >3x, CTR declining", status: "warning", count: 2, campaigns: ["Q1 Retarget", "B2B LinkedIn"], color: "#f59e0b", icon: "🔄" },
  { rule: "Zero Conversions", description: "Ad sets with 0 conversions >48h", status: "ok", count: 0, campaigns: [], color: "#00e5a0", icon: "✓" },
  { rule: "Cross-Channel Realloc", description: "Budget reallocation opportunities", status: "action", count: 3, campaigns: ["Brand Awareness → Product Launch", "B2B LinkedIn → Summer Sale", "Holiday Prep → Q1 Retarget"], color: "#3b82f6", icon: "↔" },
];

// ─── Pacing Data ────────────────────────────────────────
const pacingData = Array.from({ length: 30 }, (_, i) => {
  const day = i + 1;
  const planned = (500000 / 30) * day;
  const actual = planned * (0.85 + Math.random() * 0.35);
  return { day: `Day ${day}`, planned: Math.round(planned), actual: Math.round(actual) };
});

// ─── ROAS by Campaign ───────────────────────────────────
const roasData = campaigns.map(c => ({
  name: c.name.length > 15 ? c.name.substring(0, 15) + "…" : c.name,
  roas: c.roas,
  color: c.roas >= 3.0 ? "#00e5a0" : c.roas >= 2.0 ? "#f59e0b" : "#ff3366",
}));

// ─── Reallocation Flow ──────────────────────────────────
const reallocations = [
  { from: "Brand Awareness", to: "Product Launch", amount: 8000, reason: "Low ROAS → High ROAS", fromColor: "#ff3366", toColor: "#00e5a0" },
  { from: "B2B LinkedIn", to: "Summer Sale", amount: 5000, reason: "CPA overshoot → Strong performer", fromColor: "#ff3366", toColor: "#00e5a0" },
  { from: "Holiday Prep", to: "Q1 Retarget", amount: 12000, reason: "Underpacing → Needs budget", fromColor: "#f59e0b", toColor: "#3b82f6" },
];

// ─── Media-Driven Sales Delta ───────────────────────────
const salesDeltaData = [
  { month: "Jul", before: 180000, after: 180000 },
  { month: "Aug", before: 195000, after: 195000 },
  { month: "Sep", before: 188000, after: 188000 },
  { month: "Oct", before: 192000, after: 225000 },
  { month: "Nov", before: 200000, after: 258000 },
  { month: "Dec", before: 205000, after: 270000 },
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

// ─── Status Badge ───────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; text: string; label: string }> = {
    active: { bg: "rgba(0,229,160,0.1)", text: "#00e5a0", label: "Active" },
    warning: { bg: "rgba(245,158,11,0.1)", text: "#f59e0b", label: "Warning" },
    paused: { bg: "rgba(255,255,255,0.05)", text: "#71717a", label: "Paused" },
    alert: { bg: "rgba(255,51,102,0.1)", text: "#ff3366", label: "Alert" },
    ok: { bg: "rgba(0,229,160,0.1)", text: "#00e5a0", label: "OK" },
    action: { bg: "rgba(59,130,246,0.1)", text: "#3b82f6", label: "Action" },
  };
  const s = styles[status] || styles.active;
  return (
    <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: s.bg, color: s.text }}>
      {s.label}
    </span>
  );
}

// ─── Main Page ──────────────────────────────────────────
export default function CampaignOps() {
  return (
    <DemoLayout>
      <div className="space-y-6">
        {/* Hero metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
          {[
            { label: "Active Campaigns", value: "4", color: "#00e5a0", isText: true },
            { label: "ROAS Alerts", value: "2", color: "#ff3366", isText: true },
            { label: "Creative Fatigue", value: "2", color: "#f59e0b", isText: true },
            { label: "Zero Conversions", value: "0", color: "#00e5a0", isText: true },
            { label: "Media-Driven Delta", value: 270000, color: "#00e5a0", prefix: "+$" },
          ].map((m, i) => (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="rounded-xl border border-white/[0.06] p-4"
              style={{ background: "rgba(255,255,255,0.02)" }}
            >
              <p className="text-[10px] text-zinc-600 mb-1 font-medium uppercase tracking-wider">{m.label}</p>
              <p className="text-2xl font-mono font-bold" style={{ color: m.color }}>
                {m.isText ? m.value : <AnimatedValue value={m.value as number} prefix={m.prefix} />}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Optimization Checks */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl border border-white/[0.06] p-6"
          style={{ background: "rgba(255,255,255,0.02)" }}
        >
          <h3 className="text-sm font-semibold text-white mb-4">6 Rule-Based Optimization Checks</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {optimizationChecks.map((check) => (
              <div
                key={check.rule}
                className="rounded-lg border border-white/[0.04] p-4"
                style={{ background: "rgba(255,255,255,0.01)" }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{check.icon}</span>
                    <span className="text-xs font-semibold text-white">{check.rule}</span>
                  </div>
                  <StatusBadge status={check.status} />
                </div>
                <p className="text-[10px] text-zinc-500 mb-2">{check.description}</p>
                {check.campaigns.length > 0 && (
                  <div className="space-y-1">
                    {check.campaigns.map(c => (
                      <p key={c} className="text-[9px] font-mono" style={{ color: check.color }}>{c}</p>
                    ))}
                  </div>
                )}
                {check.count === 0 && (
                  <p className="text-[9px] font-mono text-[#00e5a0]">All clear</p>
                )}
              </div>
            ))}
          </div>
        </motion.div>

        {/* ROAS by Campaign + Pacing */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-6 rounded-xl border border-white/[0.06] p-6"
            style={{ background: "rgba(255,255,255,0.02)" }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">ROAS by Campaign</h3>
              <span className="text-[10px] text-zinc-500">Threshold: 2.0x</span>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={roasData} layout="vertical" barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fill: "#52525b", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}
                  axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
                  tickLine={false}
                  tickFormatter={(v: number) => `${v}x`}
                  domain={[0, 6]}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: "#71717a", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={120}
                />
                <Tooltip
                  contentStyle={{ background: "#141418", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }}
                  formatter={(value: number) => [`${value}x`, "ROAS"]}
                />
                <ReferenceLine x={2.0} stroke="#ff3366" strokeDasharray="4 4" strokeOpacity={0.5} />
                <Bar dataKey="roas" radius={[0, 4, 4, 0]}>
                  {roasData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="lg:col-span-6 rounded-xl border border-white/[0.06] p-6"
            style={{ background: "rgba(255,255,255,0.02)" }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Spend Pacing: Actual vs. Planned</h3>
              <span className="text-[10px] px-2 py-1 rounded-full bg-[#f59e0b]/10 text-[#f59e0b] font-medium">
                +3.2% over pace
              </span>
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <ComposedChart data={pacingData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fill: "#52525b", fontSize: 9 }}
                  axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
                  tickLine={false}
                  interval={4}
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
                <Line type="monotone" dataKey="planned" stroke="rgba(255,255,255,0.2)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="Planned" />
                <Area type="monotone" dataKey="actual" stroke="#3b82f6" strokeWidth={2} fill="rgba(59,130,246,0.08)" dot={false} name="Actual" />
              </ComposedChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        {/* Cross-Channel Reallocation */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="rounded-xl border border-white/[0.06] p-6"
          style={{ background: "rgba(255,255,255,0.02)" }}
        >
          <h3 className="text-sm font-semibold text-white mb-4">Cross-Channel Reallocation Recommendations</h3>
          <div className="space-y-3">
            {reallocations.map((r, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + i * 0.1 }}
                className="flex items-center gap-4 rounded-lg border border-white/[0.04] p-4"
                style={{ background: "rgba(255,255,255,0.01)" }}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-xs font-semibold" style={{ color: r.fromColor }}>{r.from}</span>
                    <svg className="w-4 h-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    <span className="text-xs font-semibold" style={{ color: r.toColor }}>{r.to}</span>
                  </div>
                  <p className="text-[10px] text-zinc-500">{r.reason}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-mono font-bold text-white">${r.amount.toLocaleString()}</p>
                  <p className="text-[9px] text-zinc-600">Recommended</p>
                </div>
              </motion.div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-white/[0.04] flex items-center justify-between">
            <span className="text-xs text-zinc-500">Total reallocation potential</span>
            <span className="text-sm font-mono font-bold text-[#3b82f6]">$25,000</span>
          </div>
        </motion.div>

        {/* Media-Driven Sales Delta */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="rounded-xl border border-white/[0.06] p-6"
          style={{ background: "rgba(255,255,255,0.02)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Media-Driven Sales Delta</h3>
            <span className="text-[10px] px-2 py-1 rounded-full bg-[#00e5a0]/10 text-[#00e5a0] font-medium">
              +$270,000 incremental revenue (Dec)
            </span>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={salesDeltaData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fill: "#71717a", fontSize: 11 }}
                axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#52525b", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}K`}
              />
              <Tooltip
                contentStyle={{ background: "#141418", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }}
                formatter={(value: number) => [`$${value.toLocaleString()}`, ""]}
              />
              <Area type="monotone" dataKey="before" stroke="rgba(255,255,255,0.15)" strokeWidth={1.5} fill="rgba(255,255,255,0.03)" name="Before Plinth" />
              <Area type="monotone" dataKey="after" stroke="#00e5a0" strokeWidth={2} fill="rgba(0,229,160,0.08)" name="After Plinth" />
            </ComposedChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Campaign Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="rounded-xl border border-white/[0.06] p-6"
          style={{ background: "rgba(255,255,255,0.02)" }}
        >
          <h3 className="text-sm font-semibold text-white mb-4">Campaign Overview</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {["Campaign", "Platform", "Status", "Budget", "Spent", "ROAS", "CPA", "Pacing", "Fatigue"].map(h => (
                    <th key={h} className="text-left py-3 px-3 text-[10px] text-zinc-600 font-medium uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c, i) => (
                  <motion.tr
                    key={c.name}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8 + i * 0.05 }}
                    className="border-b border-white/[0.03] hover:bg-white/[0.02]"
                  >
                    <td className="py-3 px-3 font-medium text-white">{c.name}</td>
                    <td className="py-3 px-3 text-zinc-400">{c.platform}</td>
                    <td className="py-3 px-3"><StatusBadge status={c.status} /></td>
                    <td className="py-3 px-3 font-mono text-zinc-300">${c.budget.toLocaleString()}</td>
                    <td className="py-3 px-3 font-mono text-zinc-300">${c.spent.toLocaleString()}</td>
                    <td className="py-3 px-3 font-mono" style={{ color: c.roas >= 3 ? "#00e5a0" : c.roas >= 2 ? "#f59e0b" : "#ff3366" }}>{c.roas}x</td>
                    <td className="py-3 px-3 font-mono text-zinc-300">${c.cpa.toFixed(2)}</td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(c.pacing, 100)}%`,
                              backgroundColor: c.pacing > 110 ? "#ff3366" : c.pacing > 95 ? "#f59e0b" : "#00e5a0",
                            }}
                          />
                        </div>
                        <span className="font-mono text-zinc-400">{c.pacing}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`font-mono ${c.fatigue > 50 ? "text-[#ff3366]" : c.fatigue > 25 ? "text-[#f59e0b]" : "text-[#00e5a0]"}`}>
                        {c.fatigue}%
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </DemoLayout>
  );
}
