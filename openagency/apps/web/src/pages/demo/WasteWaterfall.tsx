// @ts-nocheck
/*
 * Waste Waterfall — Leak Detector Deep Dive
 * Animated waterfall chart showing where ad spend leaks
 */
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import DemoLayout from "../../components/demo/DemoLayout";

// ─── Waterfall Data ─────────────────────────────────────
const waterfallData = [
  { name: "Gross Spend", value: 5000000, total: 5000000, fill: "#3b82f6", isStart: true },
  { name: "Non-Working", value: -312000, total: 4688000, fill: "#ff3366", detail: "Agency fees $180K, Tech fees $132K" },
  { name: "Supply Chain", value: -198000, total: 4490000, fill: "#ff3366", detail: "DSP fees $120K, SSP fees $78K" },
  { name: "Quality Waste", value: -167400, total: 4322600, fill: "#ff6b35", detail: "Ad fraud $95K, Non-viewable $72.4K" },
  { name: "Audience Waste", value: -112000, total: 4210600, fill: "#ff6b35", detail: "Off-target $75K, Frequency $37K" },
  { name: "Optimization", value: -58000, total: 4152600, fill: "#a78bfa", detail: "Poor pacing $35K, Stale creative $23K" },
  { name: "Measurement", value: -25000, total: 4127600, fill: "#a78bfa", detail: "Misattributed conversions" },
  { name: "Productive", value: 4127600, total: 4127600, fill: "#00e5a0", isEnd: true },
];

// Transform for stacked bar chart (invisible base + visible bar)
const chartData = waterfallData.map((item) => {
  if (item.isStart || item.isEnd) {
    return { name: item.name, base: 0, value: item.total, fill: item.fill };
  }
  return {
    name: item.name,
    base: item.total,
    value: Math.abs(item.value),
    fill: item.fill,
  };
});

// ─── Waste Detail Cards ─────────────────────────────────
const wasteCategories = [
  { name: "Non-Working Costs", amount: 312000, pct: 6.2, items: ["Agency fees: $180,000", "Tech fees: $132,000"], color: "#ff3366" },
  { name: "Supply Chain Leakage", amount: 198000, pct: 4.0, items: ["DSP fees: $120,000", "SSP fees: $78,000"], color: "#ff3366" },
  { name: "Quality Waste", amount: 167400, pct: 3.3, items: ["Ad fraud: $95,000", "Non-viewable: $72,400"], color: "#ff6b35" },
  { name: "Audience Waste", amount: 112000, pct: 2.2, items: ["Off-target: $75,000", "Frequency waste: $37,000"], color: "#ff6b35" },
  { name: "Optimization Gaps", amount: 58000, pct: 1.2, items: ["Poor pacing: $35,000", "Stale creative: $23,000"], color: "#a78bfa" },
  { name: "Measurement Loss", amount: 25000, pct: 0.5, items: ["Misattributed conversions"], color: "#a78bfa" },
];

// ─── Custom Tooltip ─────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const item = waterfallData.find((d) => d.name === label);
  if (!item) return null;

  return (
    <div className="rounded-lg border border-white/10 p-3 text-xs" style={{ background: "#141418" }}>
      <p className="font-semibold text-white mb-1">{item.name}</p>
      <p className="font-mono" style={{ color: item.fill }}>
        {item.isStart || item.isEnd
          ? `$${item.total.toLocaleString()}`
          : `-$${Math.abs(item.value).toLocaleString()}`}
      </p>
      {item.detail && <p className="text-zinc-500 mt-1">{item.detail}</p>}
    </div>
  );
}

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
export default function WasteWaterfall() {
  return (
    <DemoLayout>
      <div className="space-y-6">
        {/* Hero numbers */}
        <div className="flex items-center gap-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-white/[0.06] p-5 flex-1"
            style={{ background: "rgba(255,255,255,0.02)" }}
          >
            <p className="text-[10px] text-zinc-600 mb-1 font-medium uppercase tracking-wider">Gross Spend</p>
            <p className="text-3xl font-mono font-bold text-white">
              <AnimatedValue value={5000000} />
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-zinc-700 text-2xl"
          >
            →
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-xl border border-[#00e5a0]/20 p-5 flex-1"
            style={{ background: "rgba(0,229,160,0.03)" }}
          >
            <p className="text-[10px] text-[#00e5a0]/60 mb-1 font-medium uppercase tracking-wider">Productive Spend</p>
            <p className="text-3xl font-mono font-bold text-[#00e5a0]">
              <AnimatedValue value={4127600} />
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="rounded-xl border border-[#ff3366]/20 p-5"
            style={{ background: "rgba(255,51,102,0.03)" }}
          >
            <p className="text-[10px] text-[#ff3366]/60 mb-1 font-medium uppercase tracking-wider">Total Waste</p>
            <p className="text-3xl font-mono font-bold text-[#ff3366]">
              <AnimatedValue value={872400} />
            </p>
            <p className="text-xs font-mono text-[#ff3366]/60 mt-1">17.4%</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="rounded-xl border border-[#00e5a0]/20 p-5"
            style={{ background: "rgba(0,229,160,0.03)" }}
          >
            <p className="text-[10px] text-[#00e5a0]/60 mb-1 font-medium uppercase tracking-wider">Recovery Identified</p>
            <p className="text-3xl font-mono font-bold text-[#00e5a0]">
              <AnimatedValue value={247800} />
            </p>
          </motion.div>
        </div>

        {/* Waterfall Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-xl border border-white/[0.06] p-6"
          style={{ background: "rgba(255,255,255,0.02)" }}
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-semibold text-white">Waste Waterfall Analysis</h3>
            <span className="text-[10px] px-2 py-1 rounded-full bg-[#00e5a0]/10 text-[#00e5a0] font-medium">
              Industry benchmark: 23% waste rate. You're at 17.4% — top quartile.
            </span>
          </div>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={chartData} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: "#71717a", fontSize: 11, fontFamily: "'Inter', sans-serif" }}
                axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#52525b", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `$${(v / 1000000).toFixed(1)}M`}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.02)" }} />
              <Bar dataKey="base" stackId="a" fill="transparent" />
              <Bar dataKey="value" stackId="a" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={index} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Waste Category Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {wasteCategories.map((cat, i) => (
            <motion.div
              key={cat.name}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + i * 0.08 }}
              className="rounded-xl border border-white/[0.06] p-4"
              style={{ background: "rgba(255,255,255,0.02)" }}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                <span className="text-xs font-semibold text-white">{cat.name}</span>
              </div>
              <p className="text-lg font-mono font-bold text-white mb-1">
                -${cat.amount.toLocaleString()}
              </p>
              <p className="text-[10px] font-mono mb-3" style={{ color: cat.color }}>{cat.pct}% of gross</p>
              <div className="space-y-1">
                {cat.items.map((item) => (
                  <p key={item} className="text-[10px] text-zinc-500">{item}</p>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </DemoLayout>
  );
}
