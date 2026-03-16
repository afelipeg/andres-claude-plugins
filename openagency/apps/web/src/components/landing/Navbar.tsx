/*
 * Design: "Dark Infrastructure" — Sticky nav with backdrop-blur
 * Palette: #09090B base, white text, gray-400 secondary
 * Font: Raleway 600 for nav items
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Play } from "lucide-react";
import { Link } from "react-router-dom";

const navLinks = [
  { label: "Platform", href: "#platform" },
  { label: "Engines", href: "#engines" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Strategy", href: "#strategy" },
  { label: "Developers", href: "#developers" },
  { label: "Investors", href: "#investors" },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.06]"
      style={{ backdropFilter: "blur(16px) saturate(180%)", background: "rgba(9,9,11,0.8)" }}>
      <div className="container flex items-center justify-between h-16">
        {/* Logo */}
        <a href="/" className="flex items-center gap-3 group">
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="#09090B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 7l4 4-4 4" />
              <path d="M12 7l4 4-4 4" />
              <line x1="20" y1="7" x2="20" y2="15" />
            </svg>
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-white font-bold text-lg tracking-tight">Plinth</span>
            <span className="text-[10px] text-zinc-500 font-medium tracking-widest uppercase">by Polanyi</span>
          </div>
        </a>

        {/* Desktop Nav */}
        <div className="hidden lg:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-zinc-400 hover:text-white transition-colors duration-200"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Desktop CTA */}
        <div className="hidden lg:flex items-center gap-3">
          <Link to="/vision" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">
            Vision
          </Link>
          <Link to="/demo">
            <div className="px-4 py-2 text-sm font-semibold rounded-lg border border-[#00e5a0]/30 text-[#00e5a0] hover:bg-[#00e5a0]/10 transition-all duration-200 flex items-center gap-2 cursor-pointer">
              <Play size={12} fill="currentColor" />
              Access Demo
            </div>
          </Link>
          <Link to="/login">
            <div className="px-5 py-2 text-sm font-semibold bg-white text-black rounded-lg hover:bg-zinc-200 transition-colors duration-200 cursor-pointer">
              Login
            </div>
          </Link>
        </div>

        {/* Mobile Toggle */}
        <button
          className="lg:hidden text-white"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden border-t border-white/[0.06] overflow-hidden"
            style={{ background: "rgba(9,9,11,0.95)" }}
          >
            <div className="container py-6 flex flex-col gap-4">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-base font-medium text-zinc-400 hover:text-white transition-colors py-2"
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </a>
              ))}
              <div className="pt-4 border-t border-white/[0.06] flex flex-col gap-3">
                <Link to="/vision" className="text-base font-medium text-zinc-400 hover:text-white transition-colors py-2" onClick={() => setMobileOpen(false)}>
                  Vision
                </Link>
                <Link to="/demo">
                  <div
                    className="px-5 py-3 text-sm font-semibold rounded-lg border border-[#00e5a0]/30 text-[#00e5a0] text-center hover:bg-[#00e5a0]/10 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    onClick={() => setMobileOpen(false)}
                  >
                    <Play size={12} fill="currentColor" />
                    Access Demo
                  </div>
                </Link>
                <Link to="/login">
                  <div className="px-5 py-3 text-sm font-semibold bg-white text-black rounded-lg text-center hover:bg-zinc-200 transition-colors cursor-pointer" onClick={() => setMobileOpen(false)}>
                    Login
                  </div>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
