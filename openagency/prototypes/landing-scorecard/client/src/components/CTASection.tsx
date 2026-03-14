/*
 * Design: "Dark Infrastructure" — Final CTA with dramatic gradient
 */
import { motion } from "framer-motion";
import { ArrowRight, Terminal } from "lucide-react";

export default function CTASection() {
  return (
    <section id="contact" className="py-24 lg:py-32 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

      {/* Radial glow */}
      <div className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse 60% 50% at 50% 80%, rgba(255,255,255,0.03), transparent)" }}
      />

      <div className="container relative">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center max-w-3xl mx-auto"
        >
          <h2 className="text-4xl lg:text-6xl font-extrabold text-white tracking-tight mb-6 leading-tight">
            Ready to build the future of advertising intelligence?
          </h2>
          <p className="text-lg text-zinc-400 leading-relaxed mb-10 max-w-xl mx-auto">
            Get API access today. Start detecting waste, attributing value fairly, and optimizing budgets — all programmatically.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="mailto:hello@polanyi.tech"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-black font-semibold rounded-lg hover:bg-zinc-200 transition-all duration-200 text-base"
            >
              Contact Us
              <ArrowRight size={18} />
            </a>
            <a
              href="#developers"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 border border-white/10 text-white font-medium rounded-lg hover:bg-white/[0.05] transition-all duration-200 text-base"
            >
              <Terminal size={18} />
              Read the Docs
            </a>
          </div>

          <div className="mt-12 pt-8 border-t border-white/[0.04]">
            <p className="text-xs text-white">
              Ping us <a href="mailto:hello@polanyi.tech" className="text-white underline hover:text-zinc-300 transition-colors">hello@polanyi.tech</a>
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
