/*
 * Architecture — System design and protocol layers
 * 3 protocol cards (MCP, A2A, REST) + layered architecture diagram
 */
import { motion } from "framer-motion";
import DemoLayout from "@/components/demo/DemoLayout";

// ─── Protocol Cards ─────────────────────────────────────
const protocols = [
  {
    name: "MCP Server",
    desc: "Model Context Protocol — Claude, Cursor, Windsurf connect directly",
    color: "#00e5a0",
    badge: "Primary",
    code: `npx @plinth/mcp-server start\n\n# Exposes 4 engines as MCP tools:\n# leak-detector.*\n# media-architect.*\n# campaign-ops.*\n# executive-bridge.*`,
    features: ["Auto-discovery of 27 skills", "Streaming results", "Session state management"],
  },
  {
    name: "A2A Protocol",
    desc: "Agent-to-Agent — Orchestrator agents delegate to Plinth agents",
    color: "#3b82f6",
    badge: "Federation",
    code: `POST /a2a/tasks/send\n{\n  "skill": "leak-detector.waste-waterfall",\n  "input": { "file": "spend.json" },\n  "callback": "https://your-agent/webhook"\n}`,
    features: ["Agent Cards for capability discovery", "Task lifecycle management", "Multi-agent orchestration"],
  },
  {
    name: "REST API",
    desc: "Traditional HTTP — For dashboards, scripts, and direct integration",
    color: "#ff6b35",
    badge: "Universal",
    code: `curl -X POST https://api.plinth.ai/v1/engines/leak-detector/waste-waterfall \\\n  -H "Authorization: Bearer $API_KEY" \\\n  -d @spend.json`,
    features: ["OpenAPI 3.0 spec", "Webhook notifications", "Rate limiting & auth"],
  },
];

// ─── Architecture Layers ────────────────────────────────
const layers = [
  {
    name: "Interface Layer",
    color: "#00e5a0",
    items: ["MCP Server", "A2A Protocol", "REST API", "Event Bus"],
  },
  {
    name: "Engine Layer",
    color: "#3b82f6",
    items: ["Leak Detector", "Media Architect", "Campaign Ops", "Executive Bridge"],
  },
  {
    name: "Computation Layer",
    color: "#a78bfa",
    items: ["Shapley Attribution", "Hill Curves", "DAG State Machine", "Waste Waterfall"],
  },
  {
    name: "Data Layer",
    color: "#ff6b35",
    items: ["Platform Connectors", "File Parsers", "Benchmark DB", "Cache"],
  },
  {
    name: "Platform Layer",
    color: "#ff3366",
    items: ["Meta Ads", "Google Ads", "TikTok Ads", "Amazon Ads", "DV360", "LinkedIn"],
  },
];

// ─── System Stats ───────────────────────────────────────
const systemStats = [
  { label: "Engines", value: "4" },
  { label: "Skills", value: "27" },
  { label: "Protocols", value: "3" },
  { label: "Platforms", value: "6" },
  { label: "Avg Latency", value: "3.9s" },
  { label: "Uptime", value: "99.97%" },
];

export default function Architecture() {
  return (
    <DemoLayout>
      <div className="space-y-6">
        {/* System Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {systemStats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-xl border border-white/[0.06] p-3 text-center"
              style={{ background: "rgba(255,255,255,0.02)" }}
            >
              <p className="text-lg font-mono font-bold text-white">{stat.value}</p>
              <p className="text-[10px] text-zinc-600 font-medium">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Protocol Cards */}
        <div>
          <h3 className="text-sm font-semibold text-white mb-4">Integration Protocols</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {protocols.map((proto, i) => (
              <motion.div
                key={proto.name}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.1 }}
                className="rounded-xl border border-white/[0.06] overflow-hidden"
                style={{ background: "rgba(255,255,255,0.02)" }}
              >
                {/* Header */}
                <div className="p-4 border-b border-white/[0.06]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-white">{proto.name}</span>
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: `${proto.color}15`, color: proto.color }}
                    >
                      {proto.badge}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500">{proto.desc}</p>
                </div>

                {/* Code */}
                <div className="p-3 border-b border-white/[0.06]" style={{ background: "rgba(0,0,0,0.3)" }}>
                  <pre className="text-[10px] font-mono text-zinc-400 whitespace-pre-wrap leading-relaxed">
                    {proto.code}
                  </pre>
                </div>

                {/* Features */}
                <div className="p-4 space-y-2">
                  {proto.features.map((feat) => (
                    <div key={feat} className="flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full" style={{ backgroundColor: proto.color }} />
                      <span className="text-[10px] text-zinc-500">{feat}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Layered Architecture Diagram */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="rounded-xl border border-white/[0.06] p-6"
          style={{ background: "rgba(255,255,255,0.02)" }}
        >
          <h3 className="text-sm font-semibold text-white mb-6">System Architecture</h3>
          <div className="space-y-3">
            {layers.map((layer, i) => (
              <motion.div
                key={layer.name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + i * 0.1 }}
                className="flex items-center gap-4"
              >
                {/* Layer label */}
                <div className="w-36 shrink-0 text-right">
                  <span className="text-[10px] font-semibold" style={{ color: layer.color }}>
                    {layer.name}
                  </span>
                </div>

                {/* Layer bar */}
                <div
                  className="flex-1 rounded-lg border p-3 flex items-center gap-3 flex-wrap"
                  style={{
                    borderColor: `${layer.color}20`,
                    background: `${layer.color}05`,
                  }}
                >
                  {layer.items.map((item, j) => (
                    <div
                      key={item}
                      className="px-3 py-1.5 rounded-md text-[10px] font-medium border"
                      style={{
                        borderColor: `${layer.color}20`,
                        color: layer.color,
                        background: `${layer.color}08`,
                      }}
                    >
                      {item}
                    </div>
                  ))}
                </div>

                {/* Connection indicator */}
                {i < layers.length - 1 && (
                  <div className="w-4 flex items-center justify-center">
                    <div className="w-px h-6 bg-zinc-800" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {/* Data flow arrows */}
          <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-center gap-8">
            <div className="flex items-center gap-2">
              <div className="w-8 h-px bg-[#00e5a0]" />
              <span className="text-[10px] text-zinc-600">Request flow</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-px bg-[#ff6b35]" style={{ backgroundImage: "repeating-linear-gradient(90deg, #ff6b35 0, #ff6b35 4px, transparent 4px, transparent 8px)" }} />
              <span className="text-[10px] text-zinc-600">Data flow</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-px bg-[#a78bfa]" style={{ backgroundImage: "repeating-linear-gradient(90deg, #a78bfa 0, #a78bfa 2px, transparent 2px, transparent 6px)" }} />
              <span className="text-[10px] text-zinc-600">Event bus</span>
            </div>
          </div>
        </motion.div>
      </div>
    </DemoLayout>
  );
}
