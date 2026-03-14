/*
 * Design: "Dark Infrastructure" — Request Demo CTA with form
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Check, Terminal } from "lucide-react";

const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ||
  'https://polanyi-plinth-production.up.railway.app';

const SPEND_OPTIONS = [
  { value: 'under_500k', label: 'Under $500K' },
  { value: '500k_2m', label: '$500K - $2M' },
  { value: '2m_5m', label: '$2M - $5M' },
  { value: 'over_5m', label: 'Over $5M' },
];

const PLATFORM_OPTIONS = [
  { value: 'google_ads', label: 'Google Ads' },
  { value: 'meta_ads', label: 'Meta Ads' },
  { value: 'dv360', label: 'DV360' },
  { value: 'tiktok_ads', label: 'TikTok Ads' },
  { value: 'amazon_ads', label: 'Amazon Ads' },
];

export default function CTASection() {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [company, setCompany] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [monthlySpend, setMonthlySpend] = useState('');
  const [platforms, setPlatforms] = useState<string[]>([]);

  const togglePlatform = (p: string) => {
    setPlatforms((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company || !contactName || !email) return;

    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/v1/demo-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company, contact_name: contactName, email, monthly_spend: monthlySpend, platforms }),
      });
      if (!res.ok) throw new Error('Request failed');
      setSubmitted(true);

      // Send email notification to Polanyi team
      const subject = encodeURIComponent(`[Plinth Demo Request] ${company} — ${contactName}`);
      const body = encodeURIComponent(
        `New demo request:\n\nCompany: ${company}\nContact: ${contactName}\nEmail: ${email}\nMonthly Spend: ${monthlySpend || 'Not specified'}\nPlatforms: ${platforms.length > 0 ? platforms.join(', ') : 'None selected'}\n\nSubmitted: ${new Date().toISOString()}`
      );
      // Open mailto in background iframe to avoid navigation
      const mailto = `mailto:hello@polanyi.tech,dedalo@polanyi.tech?subject=${subject}&body=${body}`;
      const a = document.createElement('a');
      a.href = mailto;
      a.target = '_blank';
      a.click();
    } catch {
      setError('Something went wrong. Please email us at hello@polanyi.tech');
    } finally {
      setSubmitting(false);
    }
  };

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
          className="max-w-2xl mx-auto"
        >
          <div className="text-center mb-10">
            <h2 className="text-4xl lg:text-5xl font-extrabold text-white tracking-tight mb-4 leading-tight">
              Request a Demo
            </h2>
            <p className="text-lg text-zinc-400 leading-relaxed max-w-xl mx-auto">
              See how OpenAgency detects waste, optimizes media, and delivers measurable value across Google, Meta, DV360, TikTok, and Amazon.
            </p>
          </div>

          {submitted ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-xl border border-green-500/20 bg-green-500/5 p-8 text-center"
            >
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
                <Check className="h-6 w-6 text-green-400" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Demo request received</h3>
              <p className="text-zinc-400">We'll reach out within 24 hours to schedule your personalized demo.</p>
            </motion.div>
          ) : (
            <form onSubmit={(e) => void handleSubmit(e)} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-6 lg:p-8 space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Company Name *</label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    required
                    className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20"
                    placeholder="ACME Corp"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Contact Name *</label>
                  <input
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    required
                    className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20"
                    placeholder="Jane Smith"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Work Email *</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20"
                    placeholder="jane@acme.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">Monthly Ad Spend</label>
                  <select
                    value={monthlySpend}
                    onChange={(e) => setMonthlySpend(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/20"
                  >
                    <option value="" className="bg-zinc-900">Select range</option>
                    {SPEND_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value} className="bg-zinc-900">{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-2">Ad Platforms Used</label>
                <div className="flex flex-wrap gap-2">
                  {PLATFORM_OPTIONS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => togglePlatform(p.value)}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                        platforms.includes(p.value)
                          ? 'bg-white text-black'
                          : 'border border-white/10 text-zinc-400 hover:border-white/20 hover:text-white'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-400">{error}</p>
              )}

              <button
                type="submit"
                disabled={submitting || !company || !contactName || !email}
                className="w-full inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-white text-black font-semibold rounded-lg hover:bg-zinc-200 transition-all duration-200 text-sm disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Request Demo'}
                {!submitting && <ArrowRight size={16} />}
              </button>
            </form>
          )}

          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="#developers"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-white/10 text-zinc-400 font-medium rounded-lg hover:bg-white/[0.05] hover:text-white transition-all duration-200 text-sm"
            >
              <Terminal size={16} />
              Developer Docs
            </a>
            <a
              href="/login"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-white/10 text-zinc-400 font-medium rounded-lg hover:bg-white/[0.05] hover:text-white transition-all duration-200 text-sm"
            >
              Already have access? Sign in
            </a>
          </div>

          <div className="mt-8 pt-6 border-t border-white/[0.04] text-center">
            <p className="text-xs text-zinc-500">
              Or email us directly at <a href="mailto:hello@polanyi.tech" className="text-zinc-400 underline hover:text-white transition-colors">hello@polanyi.tech</a>
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
