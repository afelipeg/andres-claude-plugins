/*
 * Design: "Dark Infrastructure" — Pricing by outcome model
 * Clean, minimal pricing cards
 */
import { motion } from "framer-motion";
import { Check } from "lucide-react";

const plans = [
  {
    name: "API Access",
    price: "Per call",
    description: "For developers and agents integrating Plinth engines into their stack.",
    features: [
      "All 4 engines: Leak Detector, Media Architect, Campaign Ops, Executive Bridge",
      "MCP server access",
      "A2A protocol endpoint",
      "Event bus subscriptions",
      "< 200ms response time",
      "99.99% uptime SLA",
    ],
    cta: "Contact Us",
    highlighted: false,
  },
  {
    name: "Outcome-Based",
    price: "5% of waste recovered",
    description: "The killer model. We find $200K of waste, we charge $10K. Agents that evaluate positive ROI buy on their own.",
    features: [
      "Everything in API Access",
      "Leak Detector: full waste waterfall analysis",
      "Executive Bridge: Shapley attribution reports",
      "Media Architect: Hill curve optimization",
      "Automated budget reallocation",
      "Dedicated support channel",
    ],
    cta: "Contact Us",
    highlighted: true,
  },
  {
    name: "Platform",
    price: "Custom",
    description: "For enterprises running their own agent ecosystems. White-label the engine infrastructure.",
    features: [
      "Everything in Outcome-Based",
      "Custom deployment of all 4 engines",
      "Private MCP server",
      "SLA guarantees",
      "Dedicated infrastructure",
      "Priority roadmap input",
    ],
    cta: "Contact Us",
    highlighted: false,
  },
];

export default function PricingSection() {
  return (
    <section id="pricing" className="py-24 lg:py-32 relative">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.03] mb-6">
            <span className="text-xs font-medium text-zinc-400 tracking-wide">Pricing by Outcome</span>
          </div>
          <h2 className="text-3xl lg:text-5xl font-extrabold text-white tracking-tight mb-6">
            Agents don't have seats.
          </h2>
          <p className="text-lg text-zinc-500 max-w-2xl mx-auto leading-relaxed">
            Pricing per API call, per computation unit, or the killer model: percentage of waste recovered. Agents that evaluate positive ROI buy on their own.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className={`relative rounded-xl border p-8 transition-all duration-300 ${
                plan.highlighted
                  ? "border-white/[0.15] bg-white/[0.04]"
                  : "border-white/[0.06] bg-white/[0.015] hover:border-white/[0.12]"
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white text-black text-[10px] font-bold uppercase tracking-wider">
                  Recommended
                </div>
              )}

              <h3 className="text-lg font-bold text-white mb-2">{plan.name}</h3>
              <div className="text-2xl font-extrabold text-white mb-3">{plan.price}</div>
              <p className="text-sm text-zinc-500 leading-relaxed mb-8">{plan.description}</p>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check size={16} className="text-zinc-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-zinc-400">{feature}</span>
                  </li>
                ))}
              </ul>

              <a
                href="mailto:hello@polanyi.tech"
                className={`block text-center py-3 rounded-lg font-semibold text-sm transition-all duration-200 ${
                  plan.highlighted
                    ? "bg-white text-black hover:bg-zinc-200"
                    : "border border-white/[0.1] text-white hover:bg-white/[0.05]"
                }`}
              >
                {plan.cta}
              </a>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
