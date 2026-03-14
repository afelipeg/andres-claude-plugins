/*
 * DemoLayout — Dashboard shell for the Plinth demo
 * Sidebar navigation + top bar, dark theme with accent colors
 * 10 pages organized in logical sections
 * Mobile: sidebar collapses to hamburger drawer
 */
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Droplets,
  TrendingUp,
  Target,
  BarChart3,
  DollarSign,
  Plug2,
  Layers,
  Activity,
  Receipt,
  ArrowLeft,
  Menu,
  X,
} from "lucide-react";

interface NavSection {
  title: string;
  items: { label: string; href: string; icon: React.ComponentType<{ size?: number; className?: string }> }[];
}

const navSections: NavSection[] = [
  {
    title: "Overview",
    items: [
      { label: "Command Center", href: "/demo", icon: LayoutDashboard },
    ],
  },
  {
    title: "Engines",
    items: [
      { label: "Waste Analysis", href: "/demo/waste", icon: Droplets },
      { label: "Media Architect", href: "/demo/media-architect", icon: TrendingUp },
      { label: "Campaign Ops", href: "/demo/campaign-ops", icon: Target },
      { label: "Executive Bridge", href: "/demo/executive-bridge", icon: BarChart3 },
    ],
  },
  {
    title: "Results",
    items: [
      { label: "Recovery Scorecard", href: "/demo/recovery", icon: DollarSign },
      { label: "Billing", href: "/demo/billing", icon: Receipt },
    ],
  },
  {
    title: "Infrastructure",
    items: [
      { label: "Platforms", href: "/demo/platforms", icon: Plug2 },
      { label: "Architecture", href: "/demo/architecture", icon: Layers },
      { label: "Consumption", href: "/demo/consumption", icon: Activity },
    ],
  },
];

const allNavItems = navSections.flatMap((s) => s.items);

function SidebarContent({ location, onNavigate }: { location: string; onNavigate?: () => void }) {
  return (
    <>
      {/* Logo */}
      <div className="h-14 flex items-center gap-2.5 px-5 border-b border-white/[0.06]">
        <div className="w-7 h-7 rounded-md bg-[#00e5a0] flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="#0a0a0c" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 7l4 4-4 4" />
            <path d="M12 7l4 4-4 4" />
          </svg>
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-white font-semibold text-sm tracking-tight">Plinth</span>
          <span className="text-[9px] text-zinc-600 font-medium tracking-widest uppercase">Demo</span>
        </div>
      </div>

      {/* Nav links grouped by section */}
      <nav className="flex-1 py-3 px-3 flex flex-col gap-0.5 overflow-y-auto">
        {navSections.map((section, si) => (
          <div key={section.title} className={si > 0 ? "mt-4" : ""}>
            <p className="text-[9px] font-semibold text-zinc-700 uppercase tracking-widest px-3 mb-1.5">
              {section.title}
            </p>
            {section.items.map((item) => {
              const isActive = location === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <motion.div
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors cursor-pointer ${
                      isActive
                        ? "bg-[#00e5a0]/10 text-[#00e5a0]"
                        : "text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]"
                    }`}
                    whileHover={{ x: 2 }}
                    transition={{ duration: 0.15 }}
                    onClick={onNavigate}
                  >
                    <item.icon size={15} className={isActive ? "text-[#00e5a0]" : "text-zinc-600"} />
                    {item.label}
                  </motion.div>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Back to site */}
      <div className="px-3 pb-4 border-t border-white/[0.06] pt-3">
        <Link href="/">
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.03] transition-colors cursor-pointer" onClick={onNavigate}>
            <ArrowLeft size={14} />
            Back to Plinth.ai
          </div>
        </Link>
      </div>
    </>
  );
}

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "'Inter', sans-serif", background: "#0a0a0c" }}>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 border-r border-white/[0.06] flex-col" style={{ background: "#0d0d10" }}>
        <SidebarContent location={location} />
      </aside>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 z-40 bg-black/60"
              onClick={() => setMobileOpen(false)}
            />
            {/* Drawer */}
            <motion.aside
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="md:hidden fixed inset-y-0 left-0 z-50 w-60 flex flex-col border-r border-white/[0.06]"
              style={{ background: "#0d0d10" }}
            >
              <SidebarContent location={location} onNavigate={() => setMobileOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 shrink-0 border-b border-white/[0.06] flex items-center justify-between px-4 md:px-6" style={{ background: "#0d0d10" }}>
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              className="md:hidden text-zinc-400 hover:text-white transition-colors p-1 -ml-1"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <span className="text-sm font-semibold text-white">
              {allNavItems.find((n) => n.href === location)?.label || "Command Center"}
            </span>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#00e5a0] animate-pulse" />
              <span className="text-xs font-medium text-zinc-400 hidden sm:inline">4 Agents Active</span>
            </div>
            <span className="text-xs font-mono text-zinc-600 hidden sm:inline">
              {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
