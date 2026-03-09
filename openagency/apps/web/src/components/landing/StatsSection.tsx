/*
 * Design: "Dark Infrastructure" — Large animated statistics
 * Plinth's "backbone of agent-driven advertising" section
 */
import { motion, useInView } from "framer-motion";
import { useRef, useEffect, useState, useCallback } from "react";

interface StatProps {
  endValue: number;
  label: string;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  delay?: number;
}

function AnimatedStat({ endValue, label, suffix = "", prefix = "", decimals = 0, delay = 0 }: StatProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const hasAnimated = useRef(false);
  const [displayValue, setDisplayValue] = useState(
    prefix + (decimals > 0 ? "0." + "0".repeat(decimals) : "0") + suffix
  );

  const animate = useCallback(() => {
    if (hasAnimated.current) return;
    hasAnimated.current = true;

    const duration = 2000;
    const startTime = performance.now();

    const step = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = endValue * eased;

      let formatted: string;
      if (progress >= 1) {
        formatted = decimals > 0 ? endValue.toFixed(decimals) : endValue.toString();
      } else if (decimals > 0) {
        formatted = current.toFixed(decimals);
      } else {
        formatted = Math.round(current).toString();
      }

      setDisplayValue(prefix + formatted + suffix);

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };

    requestAnimationFrame(step);
  }, [endValue, suffix, prefix, decimals]);

  useEffect(() => {
    if (!isInView) return;

    if (delay > 0) {
      const timer = setTimeout(animate, delay);
      return () => clearTimeout(timer);
    } else {
      animate();
    }
  }, [isInView, delay, animate]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: delay / 1000, duration: 0.6 }}
      className="text-center lg:text-left"
    >
      <div className="text-5xl lg:text-6xl xl:text-7xl font-extrabold text-white tracking-tight mb-3 tabular-nums">
        {displayValue}
      </div>
      <p className="text-sm text-zinc-500 font-medium leading-relaxed max-w-[220px] mx-auto lg:mx-0">{label}</p>
    </motion.div>
  );
}

export default function StatsSection() {
  return (
    <section className="py-24 lg:py-32 relative">
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 100% 50% at 50% 0%, rgba(255,255,255,0.02), transparent)" }} />
      <div className="container relative">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-3xl lg:text-5xl font-extrabold text-white text-center mb-6 tracking-tight"
        >
          The backbone of agent-driven advertising
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-zinc-500 text-center text-lg mb-20 max-w-2xl mx-auto"
        >
          While 75,000+ agent skills exist, zero perform real Shapley attribution on live campaign data using A2A programmatically API model.
        </motion.p>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8">
          <AnimatedStat endValue={0} label="Competitors doing A2A ad-intelligence infrastructure under waste-recovery model" delay={0} />
          <AnimatedStat endValue={6} label="Ad platforms connected live via API" delay={200} />
          <AnimatedStat endValue={24} label="Task DAG pipeline for end-to-end optimization" delay={400} />
          <AnimatedStat endValue={4.5} suffix="x" decimals={1} label="Target ROAS improvement through waste elimination" delay={600} />
        </div>
      </div>
    </section>
  );
}
