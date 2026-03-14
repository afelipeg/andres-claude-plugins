/*
 * Recovery Scorecard — The Money Slide
 * Shows how Plinth makes money: recovery breakdown, pricing, retention
 */
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import DemoLayout from "@/components/demo/DemoLayout";

// ─── Recovery Data ──────────────────────────────────────
const recoveryData = [
  { engine: "Leak Detector", recovery: 127400, method: "Waste elimination, supply chain fee negotiation", color: "#00e5a0", pct: 51.4 },
  { engine: "Media Architect", recovery: 68200, method: "Channel reallocation, diminishing returns optimization", color: "#3b82f6", pct: 27.5 },
  { engine: "Campaign Ops", recovery: 31800, method: "CPA overshoot correction, pacing fixes", color: "#ff6b35", pct: 12.8 },
  { engine: "Executive Bridge", recovery: 20400, method: "Measurement corrections, attribution fixes", color: "#a78bfa", pct: 8.2 },
];

const totalRecovery = 247800;

// ─── Retention Data (12 months) ─────────────────────────
const retentionData = [
  { month: "M1", recovery: 180000 },
  { month: "M2", recovery: 195000 },
  { month: "M3", recovery: 210000 },
  { month: "M4", recovery: 218000 },
  { month: "M5", recovery: 232000 },
  { month: "M6", recovery: 245000 },
  { month: "M7", recovery: 260000 },
  { month: "M8", recovery: 278000 },
  { month: "M9", recovery: 295000 },
  { month: "M10", recovery: 310000 },
  { month: "M11", recovery: 325000 },
  { month: "M12", recovery: 340000 },
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

// ─── Custom Tooltip ─────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 p-3 text-xs" style={{ background: "#141418" }}>
      <p className="font-semibold text-white mb-1">{label}</p>
      <p className="font-mono text-[#00e5a0]">${payload[0].value.toLocaleString()}</p>
    </div>
  );
}

export default function RecoveryScorecard() {
  return (
    <DemoLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white mb-1">Recovery = Revenue</h2>
            <p className="text-xs text-zinc-500">How Plinth generates value and captures revenue</p>
          </div>
          <div className="rounded-xl border border-[#00e5a0]/20 px-5 py-3" style={{ background: "rgba(0,229,160,0.03)" }}>
            <p className="text-[10px] text-[#00e5a0]/60 mb-0.5 font-medium">Total Monthly Recovery</p>
            <p className="text-2xl font-mono font-bold text-[#00e5a0]">
              <AnimatedValue value={totalRecovery} />
            </p>
          </div>
        </div>

        {/* Recovery Breakdown Table + Stacked Bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-white/[0.06] overflow-hidden"
          style={{ background: "rgba(255,255,255,0.02)" }}
        >
          <div className="px-5 py-4 border-b border-white/[0.06]">
            <h3 className="text-sm font-semibold text-white">4-Engine Recovery Breakdown</h3>
          </div>

          {/* Stacked bar */}
          <div className="px-5 pt-4 pb-2">
            <div className="flex h-4 rounded-full overflow-hidden">
              {recoveryData.map((item) => (
                <motion.div
                  key={item.engine}
                  initial={{ width: 0 }}
                  animate={{ width: `${item.pct}%` }}
                  transition={{ duration: 1, delay: 0.3 }}
                  style={{ backgroundColor: item.color }}
                  className="h-full"
                />
              ))}
            </div>
          </div>

          {/* Table */}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left text-[10px] text-zinc-600 font-medium px-5 py-3 uppercase tracking-wider">Engine</th>
                <th className="text-right text-[10px] text-zinc-600 font-medium px-5 py-3 uppercase tracking-wider">Recovery Found</th>
                <th className="text-right text-[10px] text-zinc-600 font-medium px-5 py-3 uppercase tracking-wider">Share</th>
                <th className="text-left text-[10px] text-zinc-600 font-medium px-5 py-3 uppercase tracking-wider">Method</th>
              </tr>
            </thead>
            <tbody>
              {recoveryData.map((item, i) => (
                <motion.tr
                  key={item.engine}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.1 }}
                  className="border-b border-white/[0.03] hover:bg-white/[0.02]"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="font-medium text-white text-xs">{item.engine}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right font-mono font-semibold text-white text-xs">
                    ${item.recovery.toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-xs" style={{ color: item.color }}>
                    {item.pct}%
                  </td>
                  <td className="px-5 py-3 text-xs text-zinc-500">{item.method}</td>
                </motion.tr>
              ))}
              <tr className="bg-white/[0.02]">
                <td className="px-5 py-3 font-semibold text-white text-xs">Total</td>
                <td className="px-5 py-3 text-right font-mono font-bold text-[#00e5a0] text-xs">
                  ${totalRecovery.toLocaleString()}
                </td>
                <td className="px-5 py-3 text-right font-mono text-[#00e5a0] text-xs">100%</td>
                <td className="px-5 py-3" />
              </tr>
            </tbody>
          </table>
        </motion.div>

        {/* Pricing Model + Retention Chart */}
        <div className="grid grid-cols-2 gap-4">
          {/* Pricing Model */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="rounded-xl border border-white/[0.06] p-5"
            style={{ background: "rgba(255,255,255,0.02)" }}
          >
            <h3 className="text-sm font-semibold text-white mb-5">Pricing Model</h3>
            <div className="space-y-4">
              {[
                { label: "Tier", value: "Growth", sub: "Ad spend $500K-$2M" },
                { label: "Recovery Rate", value: "4.5%", sub: "Of waste recovered" },
                { label: "Monthly Fee", value: "$11,151", sub: "$247,800 × 4.5%" },
                { label: "vs. Traditional Agency", value: "$750,000/yr", sub: "15% of spend" },
              ].map((item, i) => (
                <div key={item.label} className="flex items-center justify-between py-2 border-b border-white/[0.03] last:border-0">
                  <div>
                    <p className="text-xs text-zinc-500">{item.label}</p>
                    <p className="text-[10px] text-zinc-700">{item.sub}</p>
                  </div>
                  <span className="text-sm font-mono font-bold text-white">{item.value}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 p-3 rounded-lg bg-[#00e5a0]/5 border border-[#00e5a0]/10">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#00e5a0]/80">Savings vs. agency</span>
                <span className="text-lg font-mono font-bold text-[#00e5a0]">94%</span>
              </div>
              <p className="text-[10px] text-[#00e5a0]/50 mt-1">cheaper than a traditional agency</p>
            </div>
          </motion.div>

          {/* Retention / Compounding Chart */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="rounded-xl border border-white/[0.06] p-5"
            style={{ background: "rgba(255,255,255,0.02)" }}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-semibold text-white">Cumulative Recovery (12 months)</h3>
              <span className="text-[10px] text-zinc-600 font-mono">Agents learn your account</span>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={retentionData}>
                <defs>
                  <linearGradient id="recoveryGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00e5a0" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#00e5a0" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: "#52525b", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}
                  axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "#52525b", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}K`}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="recovery"
                  stroke="#00e5a0"
                  strokeWidth={2}
                  fill="url(#recoveryGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-between mt-3 px-2">
              <div className="text-[10px]">
                <span className="text-zinc-600">Month 1: </span>
                <span className="text-white font-mono">$180K</span>
              </div>
              <div className="text-[10px]">
                <span className="text-zinc-600">Month 12: </span>
                <span className="text-[#00e5a0] font-mono font-semibold">$340K</span>
                <span className="text-[#00e5a0]/50 ml-1">+89%</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </DemoLayout>
  );
}
