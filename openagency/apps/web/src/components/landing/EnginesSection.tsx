// @ts-nocheck
/*
 * Design: "Dark Infrastructure" — 4 Core Engines with full definitions
 * Features animated Waste Waterfall chart and skills/CLI for each engine
 */
import { motion, useInView } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import { Activity, BarChart3, TrendingUp, Zap, ChevronRight } from "lucide-react";

// ─── Waste Waterfall Data ────────────────────────────────────
const waterfallStages = [
  { label: "Gross Spend", amount: 500000, pct: 100, type: "total" as const },
  { label: "Non-Working Overhead", amount: 70000, pct: 14.0, type: "waste" as const },
  { label: "Supply Chain Waste", amount: 45000, pct: 9.0, type: "waste" as const },
  { label: "Quality Waste", amount: 55000, pct: 11.0, type: "waste" as const },
  { label: "Audience Waste", amount: 40000, pct: 8.0, type: "waste" as const },
  { label: "Optimization Waste", amount: 25000, pct: 5.0, type: "waste" as const },
  { label: "Measurement Waste", amount: 15000, pct: 3.0, type: "waste" as const },
  { label: "Productive Spend", amount: 250000, pct: 50.0, type: "productive" as const },
];

function WasteWaterfallChart() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    let start: number | null = null;
    const duration = 2000;
    function animate(ts: number) {
      if (!start) start = ts;
      const elapsed = ts - start;
      const p = Math.min(elapsed / duration, 1);
      // Ease out cubic
      setProgress(1 - Math.pow(1 - p, 3));
      if (p < 1) requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
  }, [isInView]);

  const maxAmount = 500000;

  return (
    <div ref={ref} className="rounded-xl border border-white/[0.08] overflow-hidden" style={{ background: "rgba(255,255,255,0.02)" }}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-sm font-semibold text-white">Waste Waterfall Analysis</span>
        </div>
        <span className="text-xs text-zinc-600 font-mono">plinth run leak-detector waste-waterfall</span>
      </div>

      {/* Chart */}
      <div className="p-6 space-y-3">
        {waterfallStages.map((stage, i) => {
          const barWidth = (stage.amount / maxAmount) * 100;
          const animatedWidth = barWidth * progress;
          const isTotal = stage.type === "total";
          const isProductive = stage.type === "productive";
          const isWaste = stage.type === "waste";

          return (
            <motion.div
              key={stage.label}
              initial={{ opacity: 0, x: -10 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{ delay: i * 0.08, duration: 0.4 }}
              className="group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  {isWaste && <span className="text-zinc-600 text-xs">−</span>}
                  <span className={`text-xs font-medium ${isTotal ? "text-white" : isProductive ? "text-emerald-400" : "text-zinc-400"}`}>
                    {stage.label}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-mono ${isTotal ? "text-white" : isProductive ? "text-emerald-400" : "text-zinc-500"}`}>
                    ${Math.round(stage.amount * progress).toLocaleString()}
                  </span>
                  <span className={`text-[10px] font-mono w-12 text-right ${isWaste ? "text-zinc-600" : isProductive ? "text-emerald-400/70" : "text-zinc-600"}`}>
                    {(stage.pct * progress).toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="h-5 rounded bg-white/[0.03] overflow-hidden relative">
                <div
                  className={`h-full rounded transition-all duration-100 ${
                    isTotal ? "bg-white/20" : isProductive ? "bg-emerald-500/30" : "bg-white/[0.08]"
                  }`}
                  style={{ width: `${animatedWidth}%` }}
                />
                {/* Hash marks for waste bars */}
                {isWaste && (
                  <div
                    className="absolute inset-y-0 left-0 opacity-30"
                    style={{
                      width: `${animatedWidth}%`,
                      backgroundImage: "repeating-linear-gradient(90deg, transparent, transparent 4px, rgba(255,255,255,0.1) 4px, rgba(255,255,255,0.1) 5px)",
                    }}
                  />
                )}
              </div>
            </motion.div>
          );
        })}

        {/* Summary line */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ delay: 1.5 }}
          className="mt-4 pt-4 border-t border-white/[0.06] flex items-center justify-between"
        >
          <span className="text-xs text-zinc-500">Total Waste Detected</span>
          <div className="flex items-center gap-3">
            <span className="text-lg font-extrabold text-white font-mono">
              ${Math.round(250000 * progress).toLocaleString()}
            </span>
            <span className="text-xs text-zinc-600 font-mono">({(50.0 * progress).toFixed(1)}%)</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ─── Engine Cards ────────────────────────────────────────────
const engines = [
  {
    icon: Activity,
    number: "01",
    title: "Leak Detector",
    question: "Where is my money leaking?",
    description: "Analyzes your ad spend through a 6-stage waste waterfall (Non-Working → Supply Chain → Quality → Audience → Optimization → Measurement → Productive). Compares against industry benchmarks. Shows exactly where dollars disappear.",
    skills: ["waste-waterfall", "waste-estimate", "waste-compare", "supply-chain-audit", "media-quality-score"],
    cli: "plinth run leak-detector waste-waterfall --file spend.json",
    featured: true,
  },
  {
    icon: BarChart3,
    number: "02",
    title: "Media Architect",
    question: "Where should my budget go?",
    description: "Optimizes budget allocation across channels using Hill saturation curves and greedy marginal allocation. Includes MMM scenario planning with 6 interactive charts, benchmark tracking, and media plan generation.",
    skills: ["channel-optimize", "scenario-analysis", "mmm-pre-model", "mmm-model", "mmm-post-model", "mmm-optimize", "health-check", "anomaly-detect", "generate-plan"],
    cli: "plinth run media-architect channel-optimize --file channels.json",
    featured: false,
  },
  {
    icon: TrendingUp,
    number: "03",
    title: "Campaign Ops",
    question: "Is the campaign on track?",
    description: "24-task DAG state machine for campaign lifecycle management. 6 rule-based optimization checks (CPA overshoot, ROAS alerts, pacing, creative fatigue, zero conversions). Cross-channel reallocation.",
    skills: ["create-campaign", "update-task", "next-actions", "campaign-summary", "optimization-analyze", "optimization-reallocate"],
    cli: "plinth run campaign-ops optimization-analyze --file campaign.json",
    featured: false,
  },
  {
    icon: Zap,
    number: "04",
    title: "Executive Bridge",
    question: "What's the real ROI?",
    description: "Shapley value attribution (game theory), L3→L2→L1 metric translation for C-Suite reporting, platform vs. actual revenue reconciliation, and statistical power analysis for incrementality testing.",
    skills: ["shapley-attribute", "shapley-compare", "revenue-translate", "revenue-compare-channels", "reconcile", "data-integrity", "geo-lift", "conversion-lift", "holdout"],
    cli: "plinth run executive-bridge shapley-attribute --file touchpoints.json",
    featured: false,
  },
];

// ─── Animated Network Graph (replaces static image) ──────────
function NetworkGraph() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const isInView = useInView(canvasRef as React.RefObject<Element>, { once: false });

  useEffect(() => {
    if (!isInView) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const nodes = Array.from({ length: 20 }, () => ({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.001,
      vy: (Math.random() - 0.5) * 0.001,
      r: Math.random() * 3 + 1.5,
    }));

    // Label some nodes
    const labels = ["Leak Detector", "Media Architect", "Campaign Ops", "Executive Bridge"];

    function draw() {
      if (!canvas || !ctx) return;
      const dpr = Math.min(window.devicePixelRatio, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.scale(dpr, dpr);
      }

      ctx.clearRect(0, 0, w, h);

      // Update nodes
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0.05 || n.x > 0.95) n.vx *= -1;
        if (n.y < 0.05 || n.y > 0.95) n.vy *= -1;
      }

      // Draw connections
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = (nodes[i].x - nodes[j].x) * w;
          const dy = (nodes[i].y - nodes[j].y) * h;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150) {
            const opacity = (1 - dist / 150) * 0.15;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x * w, nodes[i].y * h);
            ctx.lineTo(nodes[j].x * w, nodes[j].y * h);
            ctx.strokeStyle = `rgba(255,255,255,${opacity})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // Draw nodes
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const isLabeled = i < 4;

        // Glow for labeled nodes
        if (isLabeled) {
          const glow = ctx.createRadialGradient(n.x * w, n.y * h, 0, n.x * w, n.y * h, 30);
          glow.addColorStop(0, "rgba(255,255,255,0.06)");
          glow.addColorStop(1, "rgba(255,255,255,0)");
          ctx.fillStyle = glow;
          ctx.fillRect(n.x * w - 30, n.y * h - 30, 60, 60);
        }

        ctx.beginPath();
        ctx.arc(n.x * w, n.y * h, isLabeled ? 4 : n.r, 0, Math.PI * 2);
        ctx.fillStyle = isLabeled ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.2)";
        ctx.fill();

        // Labels
        if (isLabeled && labels[i]) {
          ctx.font = "10px 'Raleway', sans-serif";
          ctx.fillStyle = "rgba(255,255,255,0.5)";
          ctx.textAlign = "center";
          ctx.fillText(labels[i], n.x * w, n.y * h + 16);
        }
      }

      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [isInView]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full absolute inset-0"
      style={{ display: "block" }}
    />
  );
}

// ─── Main Section ────────────────────────────────────────────
export default function EnginesSection() {
  const [activeEngine, setActiveEngine] = useState(0);

  return (
    <section id="engines" className="py-24 lg:py-32 relative">
      <div className="container">
        {/* Header */}
        <div className="grid lg:grid-cols-2 gap-16 items-start mb-20">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.03] mb-6"
            >
              <span className="text-xs font-medium text-zinc-400 tracking-wide">4 Core Engines</span>
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-3xl lg:text-5xl font-extrabold text-white tracking-tight mb-6"
            >
              Covering the full advertising lifecycle.
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="text-lg text-zinc-500 leading-relaxed"
            >
              Plinth ships with 4 computation engines — Leak Detector, Media Architect, Campaign Ops, and Executive Bridge. All wrapped in an API that any agent can call.
            </motion.p>
          </div>

          {/* Animated network graph replacing static image */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="hidden lg:block relative h-64 rounded-xl border border-white/[0.06] overflow-hidden"
            style={{ background: "rgba(255,255,255,0.01)" }}
          >
            <NetworkGraph />
          </motion.div>
        </div>

        {/* Waste Waterfall Chart — Featured */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12"
        >
          <WasteWaterfallChart />
        </motion.div>

        {/* Engine Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          {engines.map((engine, i) => (
            <motion.div
              key={engine.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className={`group relative rounded-xl border transition-all duration-300 overflow-hidden ${
                activeEngine === i ? "border-white/[0.15]" : "border-white/[0.06] hover:border-white/[0.10]"
              }`}
              style={{ background: activeEngine === i ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.015)" }}
              onClick={() => setActiveEngine(i)}
            >
              {/* Hover glow */}
              <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ background: "radial-gradient(ellipse at center, rgba(255,255,255,0.02), transparent 70%)" }}
              />

              <div className="relative p-8">
                {/* Top row */}
                <div className="flex items-start justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white/[0.06] flex items-center justify-center">
                      <engine.icon size={20} className="text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">{engine.title}</h3>
                      <p className="text-xs text-zinc-500 font-medium italic">"{engine.question}"</p>
                    </div>
                  </div>
                  <span className="text-4xl font-extrabold text-white/[0.04] font-mono leading-none">{engine.number}</span>
                </div>

                {/* Description */}
                <p className="text-sm text-zinc-400 leading-relaxed mb-5">{engine.description}</p>

                {/* Skills */}
                <div className="mb-5">
                  <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-semibold mb-2">Skills</p>
                  <div className="flex flex-wrap gap-1.5">
                    {engine.skills.map((skill) => (
                      <span
                        key={skill}
                        className="px-2 py-0.5 text-[10px] font-mono text-zinc-500 bg-white/[0.03] border border-white/[0.06] rounded"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>

                {/* CLI */}
                <div className="rounded-lg bg-black/40 border border-white/[0.04] px-4 py-3 flex items-center gap-2">
                  <ChevronRight size={12} className="text-zinc-600 flex-shrink-0" />
                  <code className="text-[11px] font-mono text-zinc-500 truncate">{engine.cli}</code>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
