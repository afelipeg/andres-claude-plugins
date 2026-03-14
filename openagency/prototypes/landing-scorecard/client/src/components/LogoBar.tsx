/*
 * Design: "Dark Infrastructure" — Logo bar showing connected platforms
 * Subtle, muted logos in grayscale
 */
import { motion } from "framer-motion";

const platforms = [
  "Meta Ads",
  "Google Ads",
  "TikTok Ads",
  "DV360",
  "Amazon Ads",
  "LinkedIn Ads",
];

export default function LogoBar() {
  return (
    <section className="relative py-16 border-t border-b border-white/[0.04]">
      <div className="container">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-xs font-medium text-zinc-600 uppercase tracking-[0.2em] mb-10"
        >
          Connected live to 6 advertising platforms
        </motion.p>
        <div className="flex flex-wrap justify-center items-center gap-8 lg:gap-16">
          {platforms.map((name, i) => (
            <motion.div
              key={name}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.5 }}
              className="flex items-center gap-2 text-zinc-500 hover:text-zinc-300 transition-colors duration-300"
            >
              <div className="w-2 h-2 rounded-full bg-zinc-700" />
              <span className="text-sm font-semibold tracking-wide">{name}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
