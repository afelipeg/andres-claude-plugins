/*
 * Design: "Dark Infrastructure" — Strategic decisions as numbered cards
 * Bold numbers, clean typography, alternating layout
 * No static images — animated CSS background
 */
import { motion, useInView } from "framer-motion";
import { useRef, useEffect } from "react";

const decisions = [
  {
    number: "01",
    title: "API-First, UI-Second",
    description: "The web dashboard becomes ONE client, not THE product. The product is the API. If you only build for human browsers, the 90% of future traffic — agents — ignores you.",
    highlight: "90% of future traffic will be agents",
  },
  {
    number: "02",
    title: "MCP Before Features",
    description: "Every minute invested in pretty UI should be invested in robust MCP servers. A Claude Code developer who can call 'waste-waterfall' from their terminal is worth 100x more than a pretty button.",
    highlight: "MCP servers > pretty buttons",
  },
  {
    number: "03",
    title: "Pricing by Outcome, Not by Seat",
    description: "Agents don't have 'seats'. Pricing per API call, per computation unit, or the killer model: % of waste recovered. If the engine finds $200K of waste and charges 5%, that's $10K per execution.",
    highlight: "5% of waste recovered = $10K per run",
  },
  {
    number: "04",
    title: "Open Protocol, Closed IP",
    description: "Protocols (MCP, A2A) are open. The math (Shapley weights, Hill parameters, calibrated benchmarks) is your IP. Like Android: open protocol, closed Google Services.",
    highlight: "Open protocol, proprietary math",
  },
  {
    number: "05",
    title: "From Tool to Platform",
    description: "v0.3 is a tool (Leak Detector, Media Architect, Campaign Ops, Executive Bridge). v1.0 must be a platform where third parties publish engines via MCP. You charge per transaction. The App Store of advertising intelligence for agents.",
    highlight: "App Store for agent intelligence",
  },
];

// ─── Animated Grid Background ────────────────────────────────
function AnimatedGridBg() {
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

      timeRef.current += 0.008;
      const t = timeRef.current;
      ctx.clearRect(0, 0, w, h);

      // Animated perspective grid
      const gridSize = 60;
      const vanishY = h * 0.3;
      const horizon = 20;

      // Horizontal lines with perspective
      for (let i = 0; i < horizon; i++) {
        const progress = i / horizon;
        const y = vanishY + (h - vanishY) * Math.pow(progress, 1.5);
        const opacity = progress * 0.04;

        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.strokeStyle = `rgba(255,255,255,${opacity})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // Vertical lines converging to vanish point
      const vanishX = w * 0.5;
      const numVLines = 20;
      for (let i = -numVLines; i <= numVLines; i++) {
        const bottomX = vanishX + i * gridSize;
        const opacity = 0.03 * (1 - Math.abs(i) / numVLines);

        ctx.beginPath();
        ctx.moveTo(vanishX, vanishY);
        ctx.lineTo(bottomX, h);
        ctx.strokeStyle = `rgba(255,255,255,${Math.max(0, opacity)})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // Floating dots along grid
      for (let i = 0; i < 15; i++) {
        const phase = t + i * 0.7;
        const progress = (phase % 3) / 3;
        const x = vanishX + (Math.sin(i * 1.3) * w * 0.4) * progress;
        const y = vanishY + (h - vanishY) * Math.pow(progress, 1.5);
        const size = 1 + progress * 2;
        const opacity = progress * 0.3 * (1 - progress);

        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${opacity})`;
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [isInView]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full opacity-60"
      style={{ display: "block" }}
    />
  );
}

export default function StrategySection() {
  return (
    <section id="strategy" className="py-24 lg:py-32 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

      {/* Animated background */}
      <AnimatedGridBg />

      <div className="container relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.03] mb-6">
            <span className="text-xs font-medium text-zinc-400 tracking-wide">5 Irreversible Decisions</span>
          </div>
          <h2 className="text-3xl lg:text-5xl font-extrabold text-white tracking-tight mb-6">
            Strategic architecture for the agent economy
          </h2>
          <p className="text-lg text-zinc-500 max-w-2xl mx-auto leading-relaxed">
            These aren't product features. They're foundational decisions that determine whether Plinth becomes infrastructure or just another tool.
          </p>
        </motion.div>

        <div className="space-y-6">
          {decisions.map((decision, i) => (
            <motion.div
              key={decision.number}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.5 }}
              className="group relative rounded-xl border border-white/[0.06] p-8 lg:p-10 transition-all duration-300 hover:border-white/[0.12]"
              style={{ background: "rgba(9,9,11,0.85)", backdropFilter: "blur(8px)" }}
            >
              <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ background: "radial-gradient(ellipse at left, rgba(255,255,255,0.02), transparent 50%)" }}
              />
              <div className="relative grid lg:grid-cols-[80px_1fr_280px] gap-6 items-start">
                <div className="text-5xl lg:text-6xl font-extrabold text-white/[0.06] leading-none font-mono">
                  {decision.number}
                </div>
                <div>
                  <h3 className="text-xl lg:text-2xl font-bold text-white mb-3">{decision.title}</h3>
                  <p className="text-sm lg:text-base text-zinc-400 leading-relaxed">{decision.description}</p>
                </div>
                <div className="lg:text-right">
                  <div className="inline-block px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                    <span className="text-xs font-semibold text-zinc-300">{decision.highlight}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
