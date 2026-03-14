/*
 * Design: "Dark Infrastructure" — Platform vision section
 * Single V1.0 vision card — clean and focused
 */
import { motion } from "framer-motion";
import { Layers } from "lucide-react";

export default function PlatformSection() {
  return (
    <section id="platform" className="py-24 lg:py-32 relative">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.03] mb-6">
            <Layers size={14} className="text-zinc-400" />
            <span className="text-xs font-medium text-zinc-400 tracking-wide">Platform Vision</span>
          </div>
          <h2 className="text-3xl lg:text-5xl font-extrabold text-white tracking-tight mb-6">
            The infrastructure that agents call.
          </h2>
          <p className="text-lg text-zinc-500 max-w-2xl mx-auto leading-relaxed">
            Plinth is the A2A protocol infrastructure for advertising intelligence — so any agent can detect waste, attribute value, and optimize budgets programmatically.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative max-w-3xl mx-auto"
        >
          <div className="relative rounded-2xl border border-white/[0.12] bg-white/[0.03] p-10 lg:p-14 overflow-hidden">
            {/* Subtle glow behind the card */}
            <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full opacity-[0.04]"
              style={{ background: "radial-gradient(circle, white, transparent 70%)" }}
            />

            <div className="relative">
              <div className="flex items-center gap-3 mb-8">
                <span className="text-sm font-bold text-white font-mono tracking-wider">V1.0</span>
                <span className="text-[10px] px-3 py-1 rounded-full bg-white text-black font-bold uppercase tracking-wider">Platform</span>
              </div>

              <h3 className="text-3xl lg:text-4xl font-extrabold text-white mb-6 leading-tight">
                The App Store of advertising intelligence for agents.
              </h3>

              <p className="text-base lg:text-lg text-zinc-400 leading-relaxed mb-10">
                Third parties publish computation engines via MCP. Plinth charges per transaction. Any agent — from Claude Code to custom orchestrators — can discover, negotiate, and call advertising intelligence services through the A2A protocol.
              </p>

              <div className="grid sm:grid-cols-3 gap-6">
                {[
                  { metric: "4", label: "Core engines", sublabel: "Leak Detector · Media Architect · Campaign Ops · Executive Bridge" },
                  { metric: "6", label: "Ad platforms", sublabel: "Meta · Google · TikTok · DV360 · Amazon · LinkedIn" },
                  { metric: "A2A", label: "Protocol", sublabel: "Agent-to-Agent infrastructure" },
                ].map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 + i * 0.1 }}
                    className="p-5 rounded-xl border border-white/[0.06] bg-white/[0.02]"
                  >
                    <div className="text-2xl font-extrabold text-white font-mono mb-1">{item.metric}</div>
                    <div className="text-sm font-semibold text-zinc-300 mb-1">{item.label}</div>
                    <div className="text-xs text-zinc-600">{item.sublabel}</div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
