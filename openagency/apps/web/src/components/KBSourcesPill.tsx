// ─── KB Sources Pill ──────────────────────────────────────────────────
// Small clickable badge shown after assistant messages that used KB sources.

import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { KBSourcesDrawer } from './KBSourcesDrawer';
import type { KBSourceRef } from './KBSourcesDrawer';

interface KBSourcesPillProps {
  sources: KBSourceRef[];
}

export function KBSourcesPill({ sources }: KBSourcesPillProps) {
  const [open, setOpen] = useState(false);

  if (!sources || sources.length === 0) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700 cursor-pointer hover:bg-blue-100 transition-colors mt-1"
      >
        <BookOpen className="h-3.5 w-3.5" />
        <span>{sources.length} source{sources.length !== 1 ? 's' : ''}</span>
      </button>

      {open && (
        <KBSourcesDrawer sources={sources} onClose={() => setOpen(false)} />
      )}
    </>
  );
}
