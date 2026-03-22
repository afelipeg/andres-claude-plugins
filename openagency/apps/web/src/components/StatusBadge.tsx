// ─── Status Badge (Glassmorphism) ──────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  idle: 'bg-white/10 border-white/20 text-white/60',
  observing: 'bg-[#00F5FF]/15 border-[#00F5FF]/25 text-[#00F5FF]',
  orienting: 'bg-[#7000FF]/15 border-[#7000FF]/25 text-[#a78bfa]',
  deciding: 'bg-[#FF00FF]/15 border-[#FF00FF]/25 text-[#FF00FF]',
  acting: 'bg-amber-500/20 border-amber-400/30 text-amber-300',
  paused: 'bg-amber-500/20 border-amber-400/30 text-amber-300',
  error: 'bg-red-500/20 border-red-400/30 text-red-300',
  // Mesh statuses
  pending: 'bg-white/10 border-white/20 text-white/60',
  running: 'bg-[#00F5FF]/15 border-[#00F5FF]/25 text-[#00F5FF]',
  completed: 'bg-emerald-500/20 border-emerald-400/30 text-emerald-300',
  partial: 'bg-amber-500/20 border-amber-400/30 text-amber-300',
  failed: 'bg-red-500/20 border-red-400/30 text-red-300',
  skipped: 'bg-white/10 border-white/15 text-white/40',
  timed_out: 'bg-orange-500/20 border-orange-400/30 text-orange-300',
};

export function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? 'bg-white/10 border-white/20 text-white/60';
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium backdrop-blur-sm ${color}`}>
      {status}
    </span>
  );
}
