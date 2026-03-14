/*
 * Design: "Dark Infrastructure" — Investor-focused section
 * Window of opportunity with animated counters
 * Clean centered layout without radar
 */
import { motion, useInView } from "framer-motion";
import { useRef, useEffect, useState } from "react";

const marketData = [
  { metric: "~12,000", description: "Claude Code plugins published", highlight: false },
  { metric: "~63,000", description: "Agent skills in the ecosystem", highlight: false },
  { metric: "0", description: "A2A ad-intelligence infrastructure in the industry", highlight: true },
  { metric: "0", description: "Competitors on a leak / waste recovery model", highlight: true },
  { metric: "+37%", description: "Global digital ad-spend is wasted — US $1.3B annually", highlight: true },
];

// ─── Animated Counter ────────────────────────────────────────
function AnimatedNumber({ target, prefix = "" }: { target: string; prefix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    if (!isInView) return;
    const numStr = target.replace(/[^0-9.]/g, "");
    const num = parseFloat(numStr);
    if (isNaN(num) || num === 0) {
      setDisplay(target);
      return;
    }

    // Extract prefix chars (like +, ~) and suffix chars (like %)
    const leadingChars = target.match(/^[^0-9.]*/)?.[0] || "";
    const trailingChars = target.match(/[^0-9.]*$/)?.[0] || "";

    const duration = 1500;
    const startTime = performance.now();

    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(num * eased);

      if (num >= 1000) {
        setDisplay(prefix + leadingChars + current.toLocaleString() + trailingChars);
      } else {
        setDisplay(prefix + leadingChars + current.toString() + trailingChars);
      }

      if (progress < 1) requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
  }, [isInView, target, prefix]);

  return <span ref={ref}>{display}</span>;
}

export default function InvestorSection() {
  return (
    <section id="investors" className="py-24 lg:py-32 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

      <div className="container relative">
        {/* Header — centered */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.03] mb-6"
          >
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="text-xs font-medium text-zinc-400 tracking-wide">The Window Is Open Now</span>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-3xl lg:text-5xl font-extrabold text-white tracking-tight mb-6"
          >
            The infrastructure moment for advertising intelligence.
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-lg text-zinc-400 leading-relaxed"
          >
            Nobody built an API that agents could call to do Shapley attribution on real campaign data. The window of opportunity to become the A2A protocol infrastructure for advertising intelligence is open now — and Plinth is building it.
          </motion.p>
        </div>

        {/* Market data — horizontal cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-20">
          {marketData.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 + i * 0.08 }}
              className={`p-6 rounded-xl border text-center ${
                item.highlight
                  ? "border-white/[0.12] bg-white/[0.04]"
                  : "border-white/[0.06] bg-white/[0.015]"
              }`}
            >
              <div className={`text-3xl lg:text-4xl font-extrabold tracking-tight font-mono mb-2 ${
                item.highlight ? "text-white" : "text-zinc-500"
              }`}>
                <AnimatedNumber target={item.metric} />
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed">{item.description}</p>
            </motion.div>
          ))}
        </div>

        {/* Bottom quote */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="p-10 lg:p-14 rounded-xl border border-white/[0.06] text-center"
          style={{ background: "rgba(255,255,255,0.015)" }}
        >
          <blockquote className="text-xl lg:text-2xl font-bold text-white leading-relaxed max-w-3xl mx-auto mb-6">
            "Plinth doesn't compete with Ad-HoldCos. It competes with their invisible infrastructure"
          </blockquote>
          <p className="text-sm text-zinc-500">
            In 12-18 months, CMOs won't hire an agency and sit in a room watching a PowerPoint deck. They'll say "optimize my Q3 for ROAS 4.5x with $2M budget" — and an orchestrator agent will handle the rest.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
