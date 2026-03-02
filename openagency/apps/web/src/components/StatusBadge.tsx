// ─── Status Badge ──────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  idle: 'bg-gray-100 text-gray-700',
  observing: 'bg-blue-100 text-blue-700',
  orienting: 'bg-indigo-100 text-indigo-700',
  deciding: 'bg-purple-100 text-purple-700',
  acting: 'bg-amber-100 text-amber-700',
  paused: 'bg-yellow-100 text-yellow-700',
  error: 'bg-red-100 text-red-700',
  // Mesh statuses
  pending: 'bg-gray-100 text-gray-700',
  running: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  partial: 'bg-amber-100 text-amber-700',
  failed: 'bg-red-100 text-red-700',
  skipped: 'bg-gray-100 text-gray-500',
  timed_out: 'bg-orange-100 text-orange-700',
};

export function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>
      {status}
    </span>
  );
}
