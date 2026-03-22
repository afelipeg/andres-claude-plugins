import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

/* ── Context ───────────────────────────────────────────────────────── */

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error('Glass tab components must be used within <GlassTabs>');
  return ctx;
}

/* ── GlassTabs (root) ──────────────────────────────────────────────── */

interface GlassTabsProps {
  defaultValue: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  children?: React.ReactNode;
}

function GlassTabs({
  defaultValue,
  value,
  onValueChange,
  className,
  children,
}: GlassTabsProps) {
  const [internal, setInternal] = React.useState(defaultValue);
  const activeTab = value ?? internal;

  const setActiveTab = React.useCallback(
    (v: string) => {
      if (!value) setInternal(v);
      onValueChange?.(v);
    },
    [value, onValueChange],
  );

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={cn('flex flex-col gap-4', className)}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

/* ── GlassTabsList ─────────────────────────────────────────────────── */

function GlassTabsList({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex items-center gap-1 rounded-lg p-1',
        'bg-white/10 backdrop-blur-xl border border-white/20',
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ── GlassTabsTrigger ──────────────────────────────────────────────── */

interface GlassTabsTriggerProps {
  value: string;
  className?: string;
  children?: React.ReactNode;
}

function GlassTabsTrigger({
  value,
  className,
  children,
}: GlassTabsTriggerProps) {
  const { activeTab, setActiveTab } = useTabsContext();
  const isActive = activeTab === value;

  return (
    <button
      role="tab"
      aria-selected={isActive}
      data-state={isActive ? 'active' : 'inactive'}
      onClick={() => setActiveTab(value)}
      className={cn(
        'relative inline-flex items-center justify-center rounded-md px-3 py-1.5',
        'text-sm font-medium transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00F5FF]/50',
        isActive
          ? 'text-white'
          : 'text-white/50 hover:text-white/70 hover:bg-white/5',
        className,
      )}
    >
      {isActive && (
        <motion.div
          layoutId="glass-tab-indicator"
          className="absolute inset-0 rounded-md bg-white/20 shadow-[0_0_10px_rgba(0,245,255,0.15)]"
          transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
        />
      )}
      <span className="relative z-10">{children}</span>
    </button>
  );
}

/* ── GlassTabsContent ──────────────────────────────────────────────── */

interface GlassTabsContentProps {
  value: string;
  className?: string;
  children?: React.ReactNode;
}

function GlassTabsContent({
  value,
  className,
  children,
}: GlassTabsContentProps) {
  const { activeTab } = useTabsContext();

  return (
    <AnimatePresence mode="wait">
      {activeTab === value && (
        <motion.div
          key={value}
          role="tabpanel"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className={cn('focus-visible:outline-none', className)}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export {
  GlassTabs,
  GlassTabsList,
  GlassTabsTrigger,
  GlassTabsContent,
};
