// @ts-nocheck
/*
 * Design: "Dark Infrastructure" — Visual flow diagram
 * Shows the agent-to-agent workflow with animated flow visualization
 * No static images — all animated elements
 */
import { motion, useInView } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import { User, Search, Cpu, FileJson, CheckCircle, Key, Plug, LayoutGrid } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: User,
    title: "Request a demo",
    description: "Tell us about your ad spend and platforms. We'll set up your account and send you an invite within 24 hours.",
    detail: "No contracts. No commitments. Just results.",
  },
  {
    number: "02",
    icon: Search,
    title: "Connect your platforms",
    description: "Link Google Ads, Meta, DV360, TikTok, and Amazon Ads via OAuth. Your data stays encrypted and secure.",
    detail: "One-click OAuth. Covers >80% of ad spend.",
  },
  {
    number: "03",
    icon: Cpu,
    title: "AI engines analyze",
    description: "4 engines run simultaneously: detect waste, model media mix, optimize campaigns, and bridge to revenue attribution.",
    detail: "Powered by Claude. Results in under 3 minutes.",
  },
  {
    number: "04",
    icon: CheckCircle,
    title: "Review, approve, pay for results",
    description: "See your Recovery Scorecard with value delivered. Approve to confirm billing, or provide feedback for re-analysis. You only pay when we deliver.",
    detail: "Outcome-based: 3-5% recovery + 0.5-1.5% lift & efficiency.",
  },
];

// ─── Animated Flow Visualization ─────────────────────────────
function FlowVisualization() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const isInView = useInView(canvasRef as React.RefObject<Element>, { once: false });
  const timeRef = useRef(0);

  useEffect(() => {
    if (!isInView) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const flowNodes = [
      { label: "CMO", x: 0.15, y: 0.18, size: 14 },
      { label: "Agent", x: 0.5, y: 0.18, size: 14 },
      { label: "Plinth", x: 0.85, y: 0.18, size: 14 },
      { label: "Leak\nDetector", x: 0.7, y: 0.48, size: 10 },
      { label: "Media\nArchitect", x: 0.85, y: 0.48, size: 10 },
      { label: "Campaign\nOps", x: 1.0, y: 0.48, size: 10 },
      { label: "Executive\nBridge", x: 0.55, y: 0.48, size: 10 },
      { label: "Meta", x: 0.2, y: 0.75, size: 8 },
      { label: "Google", x: 0.35, y: 0.75, size: 8 },
      { label: "TikTok", x: 0.5, y: 0.75, size: 8 },
      { label: "DV360", x: 0.65, y: 0.75, size: 8 },
      { label: "Amazon", x: 0.8, y: 0.75, size: 8 },
      { label: "LinkedIn", x: 0.95, y: 0.75, size: 8 },
    ];

    // Connections: [from, to]
    const connections: [number, number][] = [
      [0, 1], [1, 2],
      [2, 3], [2, 4], [2, 5], [2, 6],
      [3, 7], [3, 8], [3, 9], [3, 10], [3, 11], [3, 12],
      [4, 7], [4, 8], [4, 9],
    ];

    // Particles traveling along connections
    interface Particle {
      conn: number;
      t: number;
      speed: number;
    }
    const particles: Particle[] = connections.map((_, i) => ({
      conn: i,
      t: Math.random(),
      speed: 0.002 + Math.random() * 0.003,
    }));

    function draw() {
      if (!canvas || !ctx) return;
      const dpr = Math.min(window.devicePixelRatio, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      timeRef.current += 0.016;
      ctx.clearRect(0, 0, w, h);

      const pad = 30;
      const aw = w - pad * 2;
      const ah = h - pad * 2;

      // Draw connections
      for (const [fi, ti] of connections) {
        const from = flowNodes[fi];
        const to = flowNodes[ti];
        const x1 = pad + from.x * aw;
        const y1 = pad + from.y * ah;
        const x2 = pad + to.x * aw;
        const y2 = pad + to.y * ah;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = "rgba(255,255,255,0.06)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Draw traveling particles
      for (const p of particles) {
        p.t += p.speed;
        if (p.t > 1) p.t = 0;

        const [fi, ti] = connections[p.conn];
        const from = flowNodes[fi];
        const to = flowNodes[ti];
        const x = pad + (from.x + (to.x - from.x) * p.t) * aw;
        const y = pad + (from.y + (to.y - from.y) * p.t) * ah;

        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.fill();

        // Trail
        const glow = ctx.createRadialGradient(x, y, 0, x, y, 8);
        glow.addColorStop(0, "rgba(255,255,255,0.15)");
        glow.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(x - 8, y - 8, 16, 16);
      }

      // Draw nodes
      for (const node of flowNodes) {
        const nx = pad + node.x * aw;
        const ny = pad + node.y * ah;
        const r = node.size;

        // Glow
        const glow = ctx.createRadialGradient(nx, ny, 0, nx, ny, r * 2.5);
        glow.addColorStop(0, "rgba(255,255,255,0.05)");
        glow.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(nx - r * 2.5, ny - r * 2.5, r * 5, r * 5);

        // Circle
        ctx.beginPath();
        ctx.arc(nx, ny, r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(9,9,11,0.9)";
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.15)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Label
        const lines = node.label.split("\n");
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const fontSize = node.size > 10 ? 10 : 7;
        ctx.font = `500 ${fontSize}px 'Raleway', sans-serif`;
        ctx.fillStyle = "rgba(255,255,255,0.6)";

        if (lines.length === 1) {
          ctx.fillText(lines[0], nx, ny + r + 12);
        } else {
          lines.forEach((line, li) => {
            ctx.fillText(line, nx, ny + r + 10 + li * (fontSize + 2));
          });
        }
      }

      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [isInView]);

  return (
    <div className="relative w-full h-80 lg:h-96 rounded-xl border border-white/[0.06] overflow-hidden" style={{ background: "rgba(255,255,255,0.01)" }}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ display: "block" }} />
    </div>
  );
}

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 lg:py-32 relative">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.03] mb-6">
            <span className="text-xs font-medium text-zinc-400 tracking-wide">Agent-to-Agent Protocol</span>
          </div>
          <h2 className="text-3xl lg:text-5xl font-extrabold text-white tracking-tight mb-6">
            How agents use Plinth
          </h2>
          <p className="text-lg text-zinc-500 max-w-2xl mx-auto leading-relaxed">
            In 12-18 months, CMOs won't sit in a room watching a PowerPoint deck. They'll tell an agent what they want, and the agent will orchestrate everything.
          </p>
        </motion.div>

        {/* Animated Flow Visualization */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <FlowVisualization />
        </motion.div>

        {/* Integration teaser cards — visible to all, no sensitive data */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-16"
        >
          <p className="text-xs font-medium text-zinc-600 tracking-widest uppercase mb-6 text-center">
            What your agent gets access to
          </p>

          {/* Row 1: API Credentials + MCP Server */}
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            {/* API Credentials */}
            <div
              className="group relative rounded-xl border border-white/[0.06] p-6 transition-all duration-300 hover:border-white/[0.12]"
              style={{ background: "rgba(255,255,255,0.015)" }}
            >
              <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ background: "radial-gradient(ellipse at top, rgba(255,255,255,0.02), transparent 70%)" }}
              />
              <div className="relative">
                <div className="w-10 h-10 rounded-lg bg-white/[0.06] flex items-center justify-center mb-4">
                  <Key size={18} className="text-white" />
                </div>
                <h3 className="text-base font-bold text-white mb-2">API Credentials</h3>
                <p className="text-sm text-zinc-400 leading-relaxed mb-4">
                  Generate your API key and authenticate any MCP client or custom agent.
                </p>
                <div className="flex items-center gap-2 rounded-lg border border-white/[0.06] px-3 py-2" style={{ background: "rgba(255,255,255,0.02)" }}>
                  <code className="flex-1 font-mono text-[10px] text-zinc-600 truncate">oa_live_••••••••••••••••••••••••••••</code>
                  <span className="text-[10px] text-zinc-700 rounded px-1.5 py-0.5 bg-white/[0.04] shrink-0">Reveal</span>
                </div>
              </div>
            </div>

            {/* MCP Server */}
            <div
              className="group relative rounded-xl border border-white/[0.06] p-6 transition-all duration-300 hover:border-white/[0.12]"
              style={{ background: "rgba(255,255,255,0.015)" }}
            >
              <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ background: "radial-gradient(ellipse at top, rgba(255,255,255,0.02), transparent 70%)" }}
              />
              <div className="relative">
                <div className="w-10 h-10 rounded-lg bg-white/[0.06] flex items-center justify-center mb-4">
                  <Plug size={18} className="text-white" />
                </div>
                <h3 className="text-base font-bold text-white mb-2">MCP Server</h3>
                <p className="text-sm text-zinc-400 leading-relaxed mb-4">
                  Connect Claude Desktop, Cursor, or any MCP-compatible agent. 63 tools available.
                </p>
                <div className="space-y-2">
                  {["Claude Desktop", "Cursor / VS Code", "Custom Agent (HTTP)"].map((client) => (
                    <div key={client} className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-white/20 shrink-0" />
                      <span className="text-xs text-zinc-500">{client}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Ad Platform Connectors — full width */}
          <div
            className="group relative rounded-xl border border-white/[0.06] p-6 transition-all duration-300 hover:border-white/[0.12]"
            style={{ background: "rgba(255,255,255,0.015)" }}
          >
            <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              style={{ background: "radial-gradient(ellipse at top, rgba(255,255,255,0.02), transparent 70%)" }}
            />
            <div className="relative">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0">
                  <LayoutGrid size={18} className="text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Ad Platform Connectors</h3>
                  <p className="text-sm text-zinc-400">Connect your advertising platforms to pull live campaign data into the engines.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { label: "G", name: "Google Ads", description: "Search, Display, Shopping, YouTube campaigns", color: "text-blue-400", border: "border-blue-500/20" },
                  { label: "D", name: "Display & Video 360", description: "Programmatic display, video, and audio campaigns", color: "text-emerald-400", border: "border-emerald-500/20" },
                  { label: "M", name: "Meta Ads", description: "Facebook + Instagram campaigns, ad sets, and insights", color: "text-indigo-400", border: "border-indigo-500/20" },
                  { label: "T", name: "TikTok Ads", description: "In-feed, TopView, and Spark Ads campaigns", color: "text-pink-400", border: "border-pink-500/20" },
                  { label: "S", name: "TikTok Shop", description: "Shop orders, product performance, and sales data", color: "text-rose-400", border: "border-rose-500/20" },
                  { label: "A", name: "Amazon Ads", description: "Sponsored Products, Brands, and Display campaigns", color: "text-orange-400", border: "border-orange-500/20" },
                ].map(({ label, name, description, color, border }) => (
                  <div
                    key={label}
                    className={`flex items-start gap-3 rounded-lg border p-3 transition-all duration-200 hover:border-white/[0.12] hover:bg-white/[0.02] ${border}`}
                    style={{ background: "rgba(255,255,255,0.01)" }}
                  >
                    <span className={`flex h-8 w-8 items-center justify-center rounded-md border border-white/[0.08] text-xs font-bold shrink-0 bg-white/[0.03] ${color}`}>
                      {label}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white leading-tight">{name}</p>
                      <p className="text-[11px] text-zinc-500 leading-relaxed mt-0.5">{description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Steps */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, i) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="group relative rounded-xl border border-white/[0.06] p-6 transition-all duration-300 hover:border-white/[0.12]"
              style={{ background: "rgba(255,255,255,0.015)" }}
            >
              <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ background: "radial-gradient(ellipse at top, rgba(255,255,255,0.02), transparent 70%)" }}
              />
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-lg bg-white/[0.06] flex items-center justify-center">
                    <step.icon size={18} className="text-white" />
                  </div>
                  <span className="text-3xl font-extrabold text-white/[0.05] font-mono">{step.number}</span>
                </div>
                <h3 className="text-base font-bold text-white mb-2">{step.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed mb-2">{step.description}</p>
                <p className="text-xs text-zinc-600 font-medium">{step.detail}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
