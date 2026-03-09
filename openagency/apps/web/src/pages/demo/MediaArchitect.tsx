// @ts-nocheck
/*
 * Media Architect — Budget Optimization Deep Dive
 * Hill saturation curves, budget allocation, MMM scenarios, benchmarks
 */
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend, Area, AreaChart,
  ComposedChart, ReferenceLine,
} from "recharts";
import DemoLayout from "../../components/demo/DemoLayout";

// ─── Hill Curve Data (Sigmoidal) ────────────────────────
function generateHillCurve(maxResponse: number, ec50: number, steepness: number, maxSpend: number) {
  const points = [];
  for (let x = 0; x <= maxSpend; x += maxSpend / 50) {
    const y = maxResponse * Math.pow(x, steepness) / (Math.pow(ec50, steepness) + Math.pow(x, steepness));
    points.push({ spend: Math.round(x), response: Math.round(y * 100) / 100 });
  }
  return points;
}

const channels = [
  { name: "Meta Ads", color: "#3b82f6", maxResponse: 820000, ec50: 90000, steepness: 2.2, currentSpend: 150000, optimalSpend: 120000 },
  { name: "Google Ads", color: "#00e5a0", maxResponse: 950000, ec50: 110000, steepness: 1.8, currentSpend: 130000, optimalSpend: 155000 },
  { name: "TikTok Ads", color: "#ff6b35", maxResponse: 420000, ec50: 50000, steepness: 2.5, currentSpend: 80000, optimalSpend: 95000 },
  { name: "Amazon Ads", color: "#a78bfa", maxResponse: 380000, ec50: 60000, steepness: 2.0, currentSpend: 70000, optimalSpend: 60000 },
  { name: "DV360", color: "#ff3366", maxResponse: 280000, ec50: 45000, steepness: 1.9, currentSpend: 50000, optimalSpend: 45000 },
  { name: "LinkedIn", color: "#f59e0b", maxResponse: 150000, ec50: 30000, steepness: 2.3, currentSpend: 20000, optimalSpend: 25000 },
];

const hillCurves = channels.map(ch => ({
  ...ch,
  data: generateHillCurve(ch.maxResponse, ch.ec50, ch.steepness, ch.currentSpend * 2),
}));

// ─── Budget Allocation Data ─────────────────────────────
const allocationData = channels.map(ch => ({
  name: ch.name,
  current: ch.currentSpend,
  optimized: ch.optimalSpend,
  color: ch.color,
}));

// ─── Donut Data ─────────────────────────────────────────
const donutData = channels.map(ch => ({
  name: ch.name,
  value: ch.optimalSpend,
  fill: ch.color,
}));

// ─── MMM Scenarios ──────────────────────────────────────
const scenarios = [
  {
    name: "Conservative",
    totalBudget: 420000,
    expectedROAS: 3.2,
    expectedRevenue: 1344000,
    riskLevel: "Low",
    riskColor: "#00e5a0",
    channels: { meta: 100000, google: 130000, tiktok: 70000, amazon: 55000, dv360: 40000, linkedin: 25000 },
  },
  {
    name: "Balanced",
    totalBudget: 500000,
    expectedROAS: 4.1,
    expectedRevenue: 2050000,
    riskLevel: "Medium",
    riskColor: "#f59e0b",
    channels: { meta: 120000, google: 155000, tiktok: 95000, amazon: 60000, dv360: 45000, linkedin: 25000 },
    isRecommended: true,
  },
  {
    name: "Aggressive",
    totalBudget: 620000,
    expectedROAS: 3.7,
    expectedRevenue: 2294000,
    riskLevel: "High",
    riskColor: "#ff3366",
    channels: { meta: 160000, google: 180000, tiktok: 120000, amazon: 75000, dv360: 55000, linkedin: 30000 },
  },
];

// ─── Benchmark Data ─────────────────────────────────────
const benchmarks = [
  { metric: "ROAS", yours: 4.1, industry: 2.8, topQuartile: 3.5, unit: "x" },
  { metric: "CPA", yours: 24.50, industry: 38.20, topQuartile: 29.00, unit: "$", lowerBetter: true },
  { metric: "CTR", yours: 2.8, industry: 1.9, topQuartile: 2.4, unit: "%" },
  { metric: "CPM", yours: 8.40, industry: 12.50, topQuartile: 9.80, unit: "$", lowerBetter: true },
];

// ─── ROAS Trend ─────────────────────────────────────────
const roasTrend = [
  { month: "Jul", before: 2.1, after: 2.1 },
  { month: "Aug", before: 2.3, after: 2.3 },
  { month: "Sep", before: 2.4, after: 2.4 },
  { month: "Oct", before: 2.5, after: 3.1 },
  { month: "Nov", before: 2.6, after: 3.6 },
  { month: "Dec", before: 2.8, after: 4.1 },
];

// ─── Animated Counter ───────────────────────────────────
function AnimatedValue({ value, prefix = "$", decimals = 0 }: { value: number; prefix?: string; decimals?: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const duration = 1500;
    const start = performance.now();
    function animate(now: number) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(value * eased);
      if (progress < 1) requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
  }, [value]);
  return <span>{prefix}{decimals > 0 ? display.toFixed(decimals) : Math.round(display).toLocaleString()}</span>;
}

// ─── Custom Tooltip ─────────────────────────────────────
function HillTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 p-3 text-xs" style={{ background: "#141418" }}>
      <p className="text-zinc-400">Spend: <span className="text-white font-mono">${payload[0]?.payload?.spend?.toLocaleString()}</span></p>
      <p className="text-zinc-400">Response: <span className="text-white font-mono">${payload[0]?.value?.toLocaleString()}</span></p>
    </div>
  );
}

// ─── Selected Hill Curve Component ──────────────────────
function HillCurveChart({ channel }: { channel: typeof hillCurves[0] }) {
  return (
    <div className="rounded-xl border border-white/[0.06] p-4" style={{ background: "rgba(255,255,255,0.02)" }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: channel.color }} />
          <span className="text-xs font-semibold text-white">{channel.name}</span>
        </div>
        <span className="text-[10px] font-mono text-zinc-500">
          Optimal: ${channel.optimalSpend.toLocaleString()}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={channel.data}>
          <defs>
            <linearGradient id={`grad-${channel.name}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={channel.color} stopOpacity={0.2} />
              <stop offset="95%" stopColor={channel.color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis
            dataKey="spend"
            tick={{ fill: "#52525b", fontSize: 9, fontFamily: "'JetBrains Mono', monospace" }}
            axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
            tickLine={false}
            tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}K`}
          />
          <YAxis
            tick={{ fill: "#52525b", fontSize: 9, fontFamily: "'JetBrains Mono', monospace" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}K`}
          />
          <Tooltip content={<HillTooltip />} />
          <ReferenceLine
            x={channel.optimalSpend}
            stroke={channel.color}
            strokeDasharray="4 4"
            strokeOpacity={0.5}
          />
          <ReferenceLine
            x={channel.currentSpend}
            stroke="#ff3366"
            strokeDasharray="4 4"
            strokeOpacity={0.5}
          />
          <Area
            type="monotone"
            dataKey="response"
            stroke={channel.color}
            strokeWidth={2}
            fill={`url(#grad-${channel.name})`}
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-4 mt-2 text-[9px]">
        <div className="flex items-center gap-1">
          <div className="w-3 h-0.5" style={{ backgroundColor: "#ff3366" }} />
          <span className="text-zinc-500">Current: ${channel.currentSpend.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-0.5" style={{ backgroundColor: channel.color }} />
          <span className="text-zinc-500">Optimal: ${channel.optimalSpend.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────
export default function MediaArchitect() {
  return (
    <DemoLayout>
      <div className="space-y-6">
        {/* Hero metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {[
            { label: "Total Budget", value: 500000, prefix: "$", color: "#3b82f6" },
            { label: "Optimized ROAS", value: 4.1, prefix: "", decimals: 1, suffix: "x", color: "#00e5a0" },
            { label: "Projected Revenue", value: 2050000, prefix: "$", color: "#00e5a0" },
            { label: "Revenue Delta", value: 650000, prefix: "+$", color: "#00e5a0" },
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
                <AnimatedValue value={m.value} prefix={m.prefix} decimals={m.decimals || 0} />
                {m.suffix || ""}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Hill Saturation Curves */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Hill Saturation Curves by Channel</h3>
            <span className="text-[10px] px-2 py-1 rounded-full bg-[#3b82f6]/10 text-[#3b82f6] font-medium">
              Diminishing returns analysis
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {hillCurves.map((ch) => (
              <HillCurveChart key={ch.name} channel={ch} />
            ))}
          </div>
        </motion.div>

        {/* Budget Allocation: Current vs Optimized */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="lg:col-span-8 rounded-xl border border-white/[0.06] p-6"
            style={{ background: "rgba(255,255,255,0.02)" }}
          >
            <h3 className="text-sm font-semibold text-white mb-4">Budget Allocation: Current vs. Optimized</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={allocationData} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "#71717a", fontSize: 10, fontFamily: "'Inter', sans-serif" }}
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
                  labelStyle={{ color: "#fff" }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, ""]}
                />
                <Bar dataKey="current" name="Current" fill="rgba(255,255,255,0.15)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="optimized" name="Optimized" radius={[4, 4, 0, 0]}>
                  {allocationData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-6 mt-3 text-[10px]">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-white/15" />
                <span className="text-zinc-500">Current allocation</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-[#3b82f6]" />
                <span className="text-zinc-500">Optimized allocation</span>
              </div>
            </div>
          </motion.div>

          {/* Donut */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="lg:col-span-4 rounded-xl border border-white/[0.06] p-6"
            style={{ background: "rgba(255,255,255,0.02)" }}
          >
            <h3 className="text-sm font-semibold text-white mb-4">Optimized Mix</h3>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {donutData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#141418", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, ""]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-1 mt-2">
              {donutData.map(d => (
                <div key={d.name} className="flex items-center gap-1.5 text-[9px]">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.fill }} />
                  <span className="text-zinc-500">{d.name}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* ROAS Trend */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="rounded-xl border border-white/[0.06] p-6"
          style={{ background: "rgba(255,255,255,0.02)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">ROAS Trend: Before vs. After Plinth</h3>
            <span className="text-[10px] px-2 py-1 rounded-full bg-[#00e5a0]/10 text-[#00e5a0] font-medium">
              +46% ROAS improvement
            </span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={roasTrend}>
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
                tickFormatter={(v: number) => `${v}x`}
                domain={[0, 5]}
              />
              <Tooltip
                contentStyle={{ background: "#141418", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }}
                formatter={(value: number) => [`${value}x`, ""]}
              />
              <ReferenceLine y={2.8} stroke="rgba(255,255,255,0.1)" strokeDasharray="4 4" label={{ value: "Industry avg", fill: "#52525b", fontSize: 9 }} />
              <Line type="monotone" dataKey="before" stroke="rgba(255,255,255,0.2)" strokeWidth={2} dot={{ fill: "rgba(255,255,255,0.2)", r: 3 }} name="Before Plinth" />
              <Line type="monotone" dataKey="after" stroke="#00e5a0" strokeWidth={2.5} dot={{ fill: "#00e5a0", r: 4 }} name="After Plinth" />
            </ComposedChart>
          </ResponsiveContainer>
        </motion.div>

        {/* MMM Scenarios */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <h3 className="text-sm font-semibold text-white mb-4">MMM Scenario Planning</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {scenarios.map((s, i) => (
              <div
                key={s.name}
                className={`rounded-xl border p-5 relative ${
                  s.isRecommended ? "border-[#00e5a0]/30" : "border-white/[0.06]"
                }`}
                style={{ background: s.isRecommended ? "rgba(0,229,160,0.03)" : "rgba(255,255,255,0.02)" }}
              >
                {s.isRecommended && (
                  <span className="absolute -top-2.5 left-4 text-[9px] px-2 py-0.5 rounded-full bg-[#00e5a0] text-black font-bold uppercase tracking-wider">
                    Recommended
                  </span>
                )}
                <h4 className="text-sm font-semibold text-white mb-1">{s.name}</h4>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: `${s.riskColor}15`, color: s.riskColor }}>
                    {s.riskLevel} Risk
                  </span>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] text-zinc-600 mb-0.5">Total Budget</p>
                    <p className="text-lg font-mono font-bold text-white">${s.totalBudget.toLocaleString()}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] text-zinc-600 mb-0.5">Expected ROAS</p>
                      <p className="text-sm font-mono font-bold" style={{ color: s.riskColor }}>{s.expectedROAS}x</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-600 mb-0.5">Expected Revenue</p>
                      <p className="text-sm font-mono font-bold text-white">${(s.expectedRevenue / 1000000).toFixed(2)}M</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Benchmarks */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="rounded-xl border border-white/[0.06] p-6"
          style={{ background: "rgba(255,255,255,0.02)" }}
        >
          <h3 className="text-sm font-semibold text-white mb-4">Performance vs. Industry Benchmarks</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {benchmarks.map((b) => {
              const isGood = b.lowerBetter ? b.yours < b.industry : b.yours > b.industry;
              const isTopQ = b.lowerBetter ? b.yours < b.topQuartile : b.yours > b.topQuartile;
              return (
                <div key={b.metric} className="rounded-lg border border-white/[0.04] p-4" style={{ background: "rgba(255,255,255,0.01)" }}>
                  <p className="text-[10px] text-zinc-600 mb-2 font-medium uppercase tracking-wider">{b.metric}</p>
                  <p className="text-2xl font-mono font-bold text-white mb-3">
                    {b.unit === "$" ? "$" : ""}{b.yours}{b.unit === "%" ? "%" : b.unit === "x" ? "x" : ""}
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-zinc-500">Industry avg</span>
                      <span className="font-mono text-zinc-400">{b.unit === "$" ? "$" : ""}{b.industry}{b.unit === "%" ? "%" : b.unit === "x" ? "x" : ""}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-zinc-500">Top quartile</span>
                      <span className="font-mono text-zinc-400">{b.unit === "$" ? "$" : ""}{b.topQuartile}{b.unit === "%" ? "%" : b.unit === "x" ? "x" : ""}</span>
                    </div>
                    <div className="mt-2">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                        isTopQ ? "bg-[#00e5a0]/10 text-[#00e5a0]" : isGood ? "bg-[#f59e0b]/10 text-[#f59e0b]" : "bg-[#ff3366]/10 text-[#ff3366]"
                      }`}>
                        {isTopQ ? "Top Quartile" : isGood ? "Above Average" : "Below Average"}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </DemoLayout>
  );
}
