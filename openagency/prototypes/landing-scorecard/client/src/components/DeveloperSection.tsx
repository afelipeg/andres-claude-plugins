/*
 * Design: "Dark Infrastructure" — Developer-focused section
 * Code examples, MCP integration, API documentation preview
 */
import { motion } from "framer-motion";
import { Code2, Plug, Shield, Cpu } from "lucide-react";

const integrations = [
  {
    icon: Code2,
    title: "MCP Server",
    description: "Claude Code, Cursor, and any MCP-compatible agent can discover and call Plinth engines directly from the terminal.",
    code: `npx @plinth/mcp-server start
# → MCP server running on localhost:3847
# → Engines: leak-detector, media-architect, campaign-ops, executive-bridge`,
  },
  {
    icon: Plug,
    title: "A2A Protocol",
    description: "Agent-to-Agent protocol endpoint. Any orchestrator agent can discover, negotiate pricing, and contract Plinth services.",
    code: `GET /.well-known/a2a/agent.json
{
  "name": "plinth",
  "capabilities": ["leak-detector", "media-architect",
                    "campaign-ops", "executive-bridge"],
  "pricing": { "model": "outcome", "rate": 0.05 }
}`,
  },
  {
    icon: Shield,
    title: "REST API",
    description: "Traditional REST endpoints for direct integration. Full SDK support for Python, TypeScript, and Go.",
    code: `curl -X POST https://api.plinth.ai/v1/analyze \\
  -H "Authorization: Bearer oa_live_..." \\
  -d '{ "budget": 2000000,
        "platforms": ["meta","google","tiktok"],
        "engines": ["leak-detector","media-architect","campaign-ops","executive-bridge"] }'`,
  },
  {
    icon: Cpu,
    title: "Event Bus",
    description: "Real-time event streaming. When Leak Detector publishes 'waste detected: $45K', Media Architect and Campaign Ops automatically react.",
    code: `agent.events.subscribe('waste.detected', (event) => {
  // Automatic reallocation triggered
  // No human intervention needed
  console.log(event.savings); // $45,000
  console.log(event.action);  // "reallocated"
});`,
  },
];

export default function DeveloperSection() {
  return (
    <section id="developers" className="py-24 lg:py-32 relative">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.03] mb-6">
            <span className="text-xs font-medium text-zinc-400 tracking-wide">Built for Agents & Developers</span>
          </div>
          <h2 className="text-3xl lg:text-5xl font-extrabold text-white tracking-tight mb-6">
            Reliable, extensible infrastructure for every agent stack.
          </h2>
          <p className="text-lg text-zinc-500 max-w-2xl mx-auto leading-relaxed">
            Four integration paths. One API. Choose the route that fits your architecture — from MCP servers to REST endpoints.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-6">
          {integrations.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="group rounded-xl border border-white/[0.06] overflow-hidden transition-all duration-300 hover:border-white/[0.12]"
              style={{ background: "rgba(255,255,255,0.015)" }}
            >
              <div className="p-8 pb-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-lg bg-white/[0.06] flex items-center justify-center">
                    <item.icon size={18} className="text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-white">{item.title}</h3>
                </div>
                <p className="text-sm text-zinc-400 leading-relaxed">{item.description}</p>
              </div>
              <div className="px-8 pb-8">
                <div className="rounded-lg bg-black/60 border border-white/[0.04] p-4 overflow-x-auto">
                  <pre className="text-xs font-mono text-zinc-400 leading-relaxed whitespace-pre">
                    {item.code}
                  </pre>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* API Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-16 grid grid-cols-3 gap-6"
        >
          {[
            { value: "< 200ms", label: "Average API response time" },
            { value: "99.99%", label: "Uptime SLA" },
            { value: "SOC 2", label: "Compliance ready" },
          ].map((stat) => (
            <div key={stat.label} className="text-center p-6 rounded-xl border border-white/[0.04] bg-white/[0.01]">
              <div className="text-2xl lg:text-3xl font-extrabold text-white mb-2">{stat.value}</div>
              <p className="text-xs text-zinc-500 font-medium">{stat.label}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
