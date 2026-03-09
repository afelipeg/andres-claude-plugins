// @ts-nocheck
/*
 * Executive Bridge — C-Suite Reporting & Attribution
 * Shapley attribution, revenue reconciliation, L3→L2→L1 translation, incrementality
 */
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend,
  ComposedChart, Line, ReferenceLine, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";
import DemoLayout from "../../components/demo/DemoLayout";

// ─── Shapley Attribution Data ───────────────────────────
const shapleyData = [
  { channel: "Meta Ads", shapley: 28.4, lastClick: 22.1, platformReported: 35.2, color: "#3b82f6" },
  { channel: "Google Ads", shapley: 31.2, lastClick: 38.5, platformReported: 42.1, color: "#00e5a0" },
  { channel: "TikTok Ads", shapley: 15.8, lastClick: 8.2, platformReported: 18.5, color: "#ff6b35" },
  { channel: "Amazon Ads", shapley: 12.1, lastClick: 18.9, platformReported: 15.3, color: "#a78bfa" },
  { channel: "DV360", shapley: 8.3, lastClick: 9.1, platformReported: 12.8, color: "#ff3366" },
  { channel: "LinkedIn", shapley: 4.2, lastClick: 3.2, platformReported: 6.1, color: "#f59e0b" },
];

// ─── Shapley Comparison (horizontal bar) ────────────────
const shapleyCompare = shapleyData.map(d => ({
  name: d.channel,
  "Shapley Value": d.shapley,
  "Last-Click": d.lastClick,
  "Platform Reported": d.platformReported,
  color: d.color,
}));

// ─── Revenue Reconciliation ─────────────────────────────
const reconciliationData = [
  { channel: "Meta Ads", platformRevenue: 724000, actualRevenue: 582000, delta: -142000, deltaPercent: -19.6, color: "#3b82f6" },
  { channel: "Google Ads", platformRevenue: 865000, actualRevenue: 641000, delta: -224000, deltaPercent: -25.9, color: "#00e5a0" },
  { channel: "TikTok Ads", platformRevenue: 380000, actualRevenue: 324000, delta: -56000, deltaPercent: -14.7, color: "#ff6b35" },
  { channel: "Amazon Ads", platformRevenue: 315000, actualRevenue: 248000, delta: -67000, deltaPercent: -21.3, color: "#a78bfa" },
  { channel: "DV360", platformRevenue: 263000, actualRevenue: 170000, delta: -93000, deltaPercent: -35.4, color: "#ff3366" },
  { channel: "LinkedIn", platformRevenue: 125000, actualRevenue: 86000, delta: -39000, deltaPercent: -31.2, color: "#f59e0b" },
];

const totalPlatformRevenue = reconciliationData.reduce((s, d) => s + d.platformRevenue, 0);
const totalActualRevenue = reconciliationData.reduce((s, d) => s + d.actualRevenue, 0);
const totalDelta = totalActualRevenue - totalPlatformRevenue;

// ─── L3 → L2 → L1 Translation ──────────────────────────
const metricTranslation = [
  {
    level: "L3",
    title: "Technical Metrics",
    subtitle: "For Media Teams",
    color: "#3b82f6",
    metrics: [
      { name: "CPM", value: "$8.40", trend: "↓ 12%" },
      { name: "CTR", value: "2.8%", trend: "↑ 18%" },
      { name: "CPC", value: "$0.42", trend: "↓ 8%" },
      { name: "Viewability", value: "78%", trend: "↑ 5%" },
      { name: "Frequency", value: "2.4x", trend: "↓ 15%" },
    ],
  },
  {
    level: "L2",
    title: "Business Metrics",
    subtitle: "For Marketing Directors",
    color: "#a78bfa",
    metrics: [
      { name: "CPA", value: "$24.50", trend: "↓ 22%" },
      { name: "ROAS", value: "4.1x", trend: "↑ 46%" },
      { name: "Conv. Rate", value: "3.2%", trend: "↑ 28%" },
      { name: "CAC", value: "$68", trend: "↓ 18%" },
      { name: "LTV:CAC", value: "5.2x", trend: "↑ 31%" },
    ],
  },
  {
    level: "L1",
    title: "Executive Metrics",
    subtitle: "For CMO / CFO / CEO",
    color: "#00e5a0",
    metrics: [
      { name: "Revenue Impact", value: "$2.05M", trend: "↑ 46%" },
      { name: "Marketing ROI", value: "312%", trend: "↑ 52%" },
      { name: "Waste Recovered", value: "$247.8K", trend: "New" },
      { name: "Media Efficiency", value: "82.6%", trend: "↑ 14%" },
      { name: "Incremental Rev.", value: "$650K", trend: "↑ 38%" },
    ],
  },
];

// ─── Incrementality Testing ─────────────────────────────
const incrementalityTests = [
  { test: "Geo-Lift (Meta)", status: "completed", power: 0.92, lift: 18.4, confidence: 95, pValue: 0.003, color: "#3b82f6" },
  { test: "Conversion Lift (Google)", status: "completed", power: 0.88, lift: 22.1, confidence: 90, pValue: 0.008, color: "#00e5a0" },
  { test: "Holdout (TikTok)", status: "running", power: 0.75, lift: null, confidence: null, pValue: null, color: "#ff6b35" },
  { test: "Geo-Lift (DV360)", status: "planned", power: 0.81, lift: null, confidence: null, pValue: null, color: "#ff3366" },
];

// ─── Donut: Attribution Model Comparison ────────────────
const attributionDonut = shapleyData.map(d => ({
  name: d.channel,
  value: d.shapley,
  fill: d.color,
}));

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
export default function ExecutiveBridge() {
  return (
    <DemoLayout>
      <div className="space-y-6">
        {/* Hero metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {[
            { label: "Actual Revenue (Shapley)", value: totalActualRevenue, prefix: "$", color: "#00e5a0" },
            { label: "Platform Over-Report", value: Math.abs(totalDelta), prefix: "-$", color: "#ff3366" },
            { label: "Over-Report Rate", value: "23.2%", color: "#ff3366", isText: true },
            { label: "Waste Recovered", value: 247800, prefix: "$", color: "#00e5a0" },
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

        {/* Shapley Attribution */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-8 rounded-xl border border-white/[0.06] p-6"
            style={{ background: "rgba(255,255,255,0.02)" }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Shapley Attribution vs. Last-Click vs. Platform</h3>
              <span className="text-[10px] px-2 py-1 rounded-full bg-[#a78bfa]/10 text-[#a78bfa] font-medium">
                Game theory attribution
              </span>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={shapleyCompare} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "#71717a", fontSize: 10 }}
                  axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#52525b", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `${v}%`}
                />
                <Tooltip
                  contentStyle={{ background: "#141418", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }}
                  formatter={(value: number) => [`${value}%`, ""]}
                />
                <Bar dataKey="Shapley Value" fill="#00e5a0" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Last-Click" fill="rgba(255,255,255,0.15)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Platform Reported" fill="rgba(255,51,102,0.4)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-6 mt-3 text-[10px]">
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-[#00e5a0]" /><span className="text-zinc-500">Shapley Value (truth)</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-white/15" /><span className="text-zinc-500">Last-Click</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-[#ff3366]/40" /><span className="text-zinc-500">Platform Reported</span></div>
            </div>
          </motion.div>

          {/* Donut */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-4 rounded-xl border border-white/[0.06] p-6"
            style={{ background: "rgba(255,255,255,0.02)" }}
          >
            <h3 className="text-sm font-semibold text-white mb-4">Attribution Mix</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={attributionDonut}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {attributionDonut.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#141418", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }}
                  formatter={(value: number) => [`${value}%`, ""]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-1 mt-2">
              {attributionDonut.map(d => (
                <div key={d.name} className="flex items-center gap-1.5 text-[9px]">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.fill }} />
                  <span className="text-zinc-500">{d.name}: {d.value}%</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Revenue Reconciliation */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-xl border border-white/[0.06] p-6"
          style={{ background: "rgba(255,255,255,0.02)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Platform vs. Actual Revenue Reconciliation</h3>
            <span className="text-[10px] px-2 py-1 rounded-full bg-[#ff3366]/10 text-[#ff3366] font-medium">
              Platforms over-report by ${Math.abs(totalDelta).toLocaleString()} ({((Math.abs(totalDelta) / totalPlatformRevenue) * 100).toFixed(1)}%)
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {["Channel", "Platform Reported", "Actual (Shapley)", "Delta", "Over-Report %"].map(h => (
                    <th key={h} className="text-left py-3 px-3 text-[10px] text-zinc-600 font-medium uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reconciliationData.map((d, i) => (
                  <motion.tr
                    key={d.channel}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 + i * 0.05 }}
                    className="border-b border-white/[0.03] hover:bg-white/[0.02]"
                  >
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                        <span className="font-medium text-white">{d.channel}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono text-zinc-400">${d.platformRevenue.toLocaleString()}</td>
                    <td className="py-3 px-3 font-mono text-white">${d.actualRevenue.toLocaleString()}</td>
                    <td className="py-3 px-3 font-mono text-[#ff3366]">-${Math.abs(d.delta).toLocaleString()}</td>
                    <td className="py-3 px-3 font-mono text-[#ff3366]">{d.deltaPercent}%</td>
                  </motion.tr>
                ))}
                <tr className="border-t border-white/[0.08]">
                  <td className="py-3 px-3 font-semibold text-white">Total</td>
                  <td className="py-3 px-3 font-mono font-bold text-zinc-400">${totalPlatformRevenue.toLocaleString()}</td>
                  <td className="py-3 px-3 font-mono font-bold text-white">${totalActualRevenue.toLocaleString()}</td>
                  <td className="py-3 px-3 font-mono font-bold text-[#ff3366]">-${Math.abs(totalDelta).toLocaleString()}</td>
                  <td className="py-3 px-3 font-mono font-bold text-[#ff3366]">{((Math.abs(totalDelta) / totalPlatformRevenue) * 100).toFixed(1)}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* L3 → L2 → L1 Translation */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Metric Translation: L3 → L2 → L1</h3>
            <span className="text-[10px] text-zinc-500">Technical → Business → Executive</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {metricTranslation.map((level, li) => (
              <div
                key={level.level}
                className="rounded-xl border border-white/[0.06] p-5"
                style={{ background: "rgba(255,255,255,0.02)" }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: `${level.color}15`, color: level.color }}>
                    {level.level}
                  </span>
                  <span className="text-xs font-semibold text-white">{level.title}</span>
                </div>
                <p className="text-[10px] text-zinc-600 mb-4">{level.subtitle}</p>
                <div className="space-y-3">
                  {level.metrics.map(m => (
                    <div key={m.name} className="flex items-center justify-between">
                      <span className="text-[10px] text-zinc-500">{m.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-white">{m.value}</span>
                        <span className={`text-[9px] font-mono ${m.trend.startsWith("↑") || m.trend === "New" ? "text-[#00e5a0]" : "text-[#00e5a0]"}`}>
                          {m.trend}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                {li < 2 && (
                  <div className="flex justify-center mt-4">
                    <svg className="w-5 h-5 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Incrementality Testing */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="rounded-xl border border-white/[0.06] p-6"
          style={{ background: "rgba(255,255,255,0.02)" }}
        >
          <h3 className="text-sm font-semibold text-white mb-4">Statistical Power Analysis & Incrementality Testing</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {incrementalityTests.map((t) => (
              <div
                key={t.test}
                className="rounded-lg border border-white/[0.04] p-4"
                style={{ background: "rgba(255,255,255,0.01)" }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
                    <span className="text-[10px] font-semibold text-white">{t.test}</span>
                  </div>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                    t.status === "completed" ? "bg-[#00e5a0]/10 text-[#00e5a0]" :
                    t.status === "running" ? "bg-[#3b82f6]/10 text-[#3b82f6]" :
                    "bg-white/5 text-zinc-500"
                  }`}>
                    {t.status}
                  </span>
                </div>
                <div className="space-y-2">
                  <div>
                    <p className="text-[9px] text-zinc-600 mb-0.5">Statistical Power</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${t.power * 100}%`, backgroundColor: t.power >= 0.8 ? "#00e5a0" : "#f59e0b" }} />
                      </div>
                      <span className="text-[9px] font-mono text-zinc-400">{(t.power * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                  {t.lift !== null && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[9px] text-zinc-600">Lift</p>
                        <p className="text-xs font-mono font-bold text-[#00e5a0]">+{t.lift}%</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-zinc-600">Confidence</p>
                        <p className="text-xs font-mono font-bold text-white">{t.confidence}%</p>
                      </div>
                    </div>
                  )}
                  {t.pValue !== null && (
                    <div>
                      <p className="text-[9px] text-zinc-600">p-value</p>
                      <p className="text-xs font-mono font-bold text-[#00e5a0]">{t.pValue}</p>
                    </div>
                  )}
                  {t.status === "running" && (
                    <p className="text-[9px] text-[#3b82f6] font-mono">Collecting data…</p>
                  )}
                  {t.status === "planned" && (
                    <p className="text-[9px] text-zinc-600 font-mono">Scheduled for next cycle</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </DemoLayout>
  );
}
