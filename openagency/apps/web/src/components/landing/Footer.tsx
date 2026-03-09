/*
 * Design: "Dark Infrastructure" — Minimal footer
 */

const footerLinks = {
  Product: [
    { label: "Engines", href: "#engines" },
    { label: "How It Works", href: "#how-it-works" },
    { label: "Pricing", href: "#pricing" },
    { label: "Platform", href: "#platform" },
  ],
  Developers: [
    { label: "Documentation", href: "#developers" },
    { label: "API Reference", href: "#developers" },
    { label: "MCP Server", href: "#developers" },
    { label: "A2A Protocol", href: "#developers" },
  ],
  Company: [
    { label: "About Polanyi", href: "#" },
    { label: "Investors", href: "#investors" },
    { label: "Contact", href: "mailto:hello@polanyi.tech" },
    { label: "Careers", href: "#" },
  ],
};

export default function Footer() {
  return (
    <footer className="border-t border-white/[0.04] py-16">
      <div className="container">
        <div className="grid lg:grid-cols-[1.5fr_1fr_1fr_1fr] gap-12 mb-16">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="#09090B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 7l4 4-4 4" />
                  <path d="M12 7l4 4-4 4" />
                  <line x1="20" y1="7" x2="20" y2="15" />
                </svg>
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-white font-bold text-base tracking-tight">Plinth</span>
                <span className="text-[9px] text-zinc-600 font-medium tracking-widest uppercase">by Polanyi</span>
              </div>
            </div>
            <p className="text-sm text-zinc-600 leading-relaxed max-w-xs">
              The advertising intelligence infrastructure that agents call programmatically. API-first. Agent-to-agent.
            </p>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">{category}</h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <a href={link.href} className="text-sm text-zinc-600 hover:text-zinc-300 transition-colors duration-200">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-white/[0.04] flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-zinc-700">&copy; {new Date().getFullYear()} Polanyi. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="text-xs text-zinc-700 hover:text-zinc-400 transition-colors">Privacy</a>
            <a href="#" className="text-xs text-zinc-700 hover:text-zinc-400 transition-colors">Terms</a>
            <a href="#" className="text-xs text-zinc-700 hover:text-zinc-400 transition-colors">Security</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
