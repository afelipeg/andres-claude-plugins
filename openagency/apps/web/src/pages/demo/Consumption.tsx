// @ts-nocheck
/*
 * Consumption — Platform Usage Monitoring
 * Tokens consumed, MCP Client/Server calls, Tool Calling, Datasets consulted
 */
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, LineChart, Line,
  ComposedChart, Area,
} from "recharts";
import DemoLayout from "../../components/demo/DemoLayout";

// ─── Daily Token Consumption (30 days) ──────────────────
const dailyTokens = Array.from({ length: 30 }, (_, i) => ({
  day: `${i + 1}`,
  tokens: Math.round(12000 + Math.random() * 18000 + (i > 20 ? 8000 : 0)),
  mcpClient: Math.round(80 + Math.random() * 120 + (i > 20 ? 40 : 0)),
  mcpServer: Math.round(60 + Math.random() * 90 + (i > 20 ? 30 : 0)),
}));

const totalTokens = dailyTokens.reduce((s, d) => s + d.tokens, 0);
const totalMcpClient = dailyTokens.reduce((s, d) => s + d.mcpClient, 0);
const totalMcpServer = dailyTokens.reduce((s, d) => s + d.mcpServer, 0);

// ─── Consumption by Engine ──────────────────────────────
const engineConsumption = [
  { name: "Leak Detector", tokens: 142000, calls: 1240, color: "#ff3366" },
  { name: "Media Architect", tokens: 198000, calls: 1680, color: "#3b82f6" },
  { name: "Campaign Ops", tokens: 165000, calls: 2100, color: "#ff6b35" },
  { name: "Executive Bridge", tokens: 112000, calls: 890, color: "#00e5a0" },
];

const totalEngineCalls = engineConsumption.reduce((s, d) => s + d.calls, 0);

// ─── Protocol Distribution ──────────────────────────────
const protocolData = [
  { name: "MCP", value: 45, fill: "#3b82f6" },
  { name: "A2A", value: 30, fill: "#00e5a0" },
  { name: "REST API", value: 20, fill: "#a78bfa" },
  { name: "Event Bus", value: 5, fill: "#f59e0b" },
];

// ─── Tool Calling Breakdown ─────────────────────────────
const toolCalls = [
  { tool: "waste-waterfall", engine: "Leak Detector", calls: 342, avgLatency: 1.2, color: "#ff3366" },
  { tool: "waste-estimate", engine: "Leak Detector", calls: 298, avgLatency: 0.8, color: "#ff3366" },
  { tool: "channel-optimize", engine: "Media Architect", calls: 456, avgLatency: 2.4, color: "#3b82f6" },
  { tool: "scenario-analysis", engine: "Media Architect", calls: 389, avgLatency: 3.1, color: "#3b82f6" },
  { tool: "mmm-model", engine: "Media Architect", calls: 312, avgLatency: 4.8, color: "#3b82f6" },
  { tool: "optimization-analyze", engine: "Campaign Ops", calls: 567, avgLatency: 1.5, color: "#ff6b35" },
  { tool: "campaign-summary", engine: "Campaign Ops", calls: 423, avgLatency: 0.9, color: "#ff6b35" },
  { tool: "shapley-attribute", engine: "Executive Bridge", calls: 289, avgLatency: 5.2, color: "#00e5a0" },
  { tool: "revenue-translate", engine: "Executive Bridge", calls: 234, avgLatency: 1.1, color: "#00e5a0" },
  { tool: "reconcile", engine: "Executive Bridge", calls: 178, avgLatency: 2.3, color: "#00e5a0" },
];

// ─── Datasets Consulted by Platform ─────────────────────
const datasets = [
  { platform: "Meta Ads", datasets: 48, records: 2400000, lastSync: "2 min ago", status: "live", color: "#3b82f6" },
  { platform: "Google Ads", datasets: 52, records: 3100000, lastSync: "1 min ago", status: "live", color: "#00e5a0" },
  { platform: "TikTok Ads", datasets: 31, records: 890000, lastSync: "5 min ago", status: "live", color: "#ff6b35" },
  { platform: "Amazon Ads", datasets: 28, records: 1200000, lastSync: "3 min ago", status: "live", color: "#a78bfa" },
  { platform: "DV360", datasets: 22, records: 680000, lastSync: "8 min ago", status: "live", color: "#ff3366" },
  { platform: "LinkedIn Ads", datasets: 15, records: 340000, lastSync: "12 min ago", status: "live", color: "#f59e0b" },
];

const totalDatasets = datasets.reduce((s, d) => s + d.datasets, 0);
const totalRecords = datasets.reduce((s, d) => s + d.records, 0);

// ─── Animated Counter ───────────────────────────────────
function AnimatedValue({ value, prefix = "" }: { value: number; prefix?: string }) {
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
export default function Consumption() {
  return (
    <DemoLayout>
      <div className="space-y-6">
        {/* Hero metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
          {[
            { label: "Tokens Consumed", value: totalTokens, color: "#3b82f6" },
            { label: "MCP Client Calls", value: totalMcpClient, color: "#00e5a0" },
            { label: "MCP Server Calls", value: totalMcpServer, color: "#a78bfa" },
            { label: "Tool Invocations", value: totalEngineCalls, color: "#ff6b35" },
            { label: "Datasets Consulted", value: totalDatasets, color: "#f59e0b" },
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
                <AnimatedValue value={m.value} />
              </p>
            </motion.div>
          ))}
        </div>

        {/* Token Consumption Over Time */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl border border-white/[0.06] p-6"
          style={{ background: "rgba(255,255,255,0.02)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Daily Token Consumption (Last 30 Days)</h3>
            <span className="text-[10px] px-2 py-1 rounded-full bg-[#3b82f6]/10 text-[#3b82f6] font-medium">
              Avg: {Math.round(totalTokens / 30).toLocaleString()} tokens/day
            </span>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={dailyTokens}>
              <defs>
                <linearGradient id="tokenGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
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
                tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`}
              />
              <Tooltip
                contentStyle={{ background: "#141418", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }}
                formatter={(value: number) => [value.toLocaleString(), ""]}
              />
              <Area type="monotone" dataKey="tokens" stroke="#3b82f6" strokeWidth={2} fill="url(#tokenGrad)" name="Tokens" />
            </ComposedChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Engine Consumption + Protocol Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-8 rounded-xl border border-white/[0.06] p-6"
            style={{ background: "rgba(255,255,255,0.02)" }}
          >
            <h3 className="text-sm font-semibold text-white mb-4">Consumption by Engine</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={engineConsumption} barCategoryGap="25%">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: "#71717a", fontSize: 10 }}
                  axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="tokens"
                  tick={{ fill: "#52525b", fontSize: 9, fontFamily: "'JetBrains Mono', monospace" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}K`}
                />
                <YAxis
                  yAxisId="calls"
                  orientation="right"
                  tick={{ fill: "#52525b", fontSize: 9, fontFamily: "'JetBrains Mono', monospace" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{ background: "#141418", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }}
                  formatter={(value: number, name: string) => [value.toLocaleString(), name]}
                />
                <Bar yAxisId="tokens" dataKey="tokens" name="Tokens" radius={[4, 4, 0, 0]}>
                  {engineConsumption.map((entry, index) => (
                    <Cell key={index} fill={entry.color} fillOpacity={0.7} />
                  ))}
                </Bar>
                <Bar yAxisId="calls" dataKey="calls" name="API Calls" radius={[4, 4, 0, 0]}>
                  {engineConsumption.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-6 mt-3 text-[10px]">
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-white/30" /><span className="text-zinc-500">Tokens (left axis)</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-white/60" /><span className="text-zinc-500">API Calls (right axis)</span></div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="lg:col-span-4 rounded-xl border border-white/[0.06] p-6"
            style={{ background: "rgba(255,255,255,0.02)" }}
          >
            <h3 className="text-sm font-semibold text-white mb-4">Protocol Distribution</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={protocolData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {protocolData.map((entry, index) => (
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
              {protocolData.map(d => (
                <div key={d.name} className="flex items-center gap-1.5 text-[9px]">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.fill }} />
                  <span className="text-zinc-500">{d.name}: {d.value}%</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Tool Calling Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="rounded-xl border border-white/[0.06] p-6"
          style={{ background: "rgba(255,255,255,0.02)" }}
        >
          <h3 className="text-sm font-semibold text-white mb-4">Tool Calling Breakdown</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {["Tool", "Engine", "Invocations", "Avg Latency", "Status"].map(h => (
                    <th key={h} className="text-left py-3 px-3 text-[10px] text-zinc-600 font-medium uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {toolCalls.map((t, i) => (
                  <motion.tr
                    key={t.tool}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 + i * 0.03 }}
                    className="border-b border-white/[0.03] hover:bg-white/[0.02]"
                  >
                    <td className="py-3 px-3">
                      <code className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.04]" style={{ color: t.color }}>
                        {t.tool}
                      </code>
                    </td>
                    <td className="py-3 px-3 text-zinc-400">{t.engine}</td>
                    <td className="py-3 px-3 font-mono text-white">{t.calls.toLocaleString()}</td>
                    <td className="py-3 px-3 font-mono text-zinc-400">{t.avgLatency}s</td>
                    <td className="py-3 px-3">
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-medium bg-[#00e5a0]/10 text-[#00e5a0]">
                        Healthy
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Datasets Consulted by Connection */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="rounded-xl border border-white/[0.06] p-6"
          style={{ background: "rgba(255,255,255,0.02)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Datasets Consulted by Connection</h3>
            <span className="text-[10px] px-2 py-1 rounded-full bg-[#f59e0b]/10 text-[#f59e0b] font-medium">
              {totalRecords.toLocaleString()} total records processed
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {datasets.map((d, i) => (
              <motion.div
                key={d.platform}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + i * 0.05 }}
                className="rounded-lg border border-white/[0.04] p-4"
                style={{ background: "rgba(255,255,255,0.01)" }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="text-xs font-semibold text-white">{d.platform}</span>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded font-medium bg-[#00e5a0]/10 text-[#00e5a0]">
                    {d.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[9px] text-zinc-600">Datasets</p>
                    <p className="text-sm font-mono font-bold text-white">{d.datasets}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-zinc-600">Records</p>
                    <p className="text-sm font-mono font-bold text-white">{(d.records / 1000000).toFixed(1)}M</p>
                  </div>
                </div>
                <p className="text-[9px] text-zinc-600 mt-2">Last sync: {d.lastSync}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </DemoLayout>
  );
}
