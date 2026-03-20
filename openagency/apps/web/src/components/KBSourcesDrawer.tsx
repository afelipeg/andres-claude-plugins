// ─── KB Sources Drawer ────────────────────────────────────────────────
// Slide-out panel showing knowledge base sources used in an assistant response.

import { useEffect, useState } from 'react';
import { X, Download, ExternalLink, FileText } from 'lucide-react';
import { getDocumentDownloadUrl } from '../api/kb';

export interface KBSourceRef {
  document_id: string;
  filename: string;
  source_type: string;
  run_id?: string;
  date: string;
  relevance: number;
  snippet: string;
}

interface KBSourcesDrawerProps {
  sources: KBSourceRef[];
  onClose: () => void;
}

const SOURCE_TYPE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  engine_output: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Engine Output' },
  upload: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Upload' },
  external_report: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'External Report' },
  benchmark: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Benchmark' },
};

function SourceTypeBadge({ type }: { type: string }) {
  const style = SOURCE_TYPE_STYLES[type] ?? { bg: 'bg-zinc-100', text: 'text-zinc-600', label: type };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
}

function RelevanceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-zinc-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            backgroundColor: pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#94a3b8',
          }}
        />
      </div>
      <span className="text-[11px] text-zinc-500 tabular-nums w-8 text-right">{pct}%</span>
    </div>
  );
}

export function KBSourcesDrawer({ sources, onClose }: KBSourcesDrawerProps) {
  const [visible, setVisible] = useState(false);

  // Animate in
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 200);
  };

  const handleDownload = async (docId: string) => {
    try {
      const url = await getDocumentDownloadUrl(docId);
      window.open(url, '_blank');
    } catch {
      // Silently fail — backend may not have this endpoint yet
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        className={`relative w-[400px] max-w-[90vw] h-full bg-white shadow-2xl flex flex-col transition-transform duration-200 ease-out ${visible ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            <h2 className="text-base font-semibold text-zinc-900">Knowledge Base Sources</h2>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Sources list */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {sources.map((source, idx) => (
            <div
              key={`${source.document_id}-${idx}`}
              className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
            >
              {/* Document name */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <button
                  onClick={() => void handleDownload(source.document_id)}
                  className="text-sm font-semibold text-zinc-900 hover:text-blue-600 transition-colors text-left"
                >
                  {source.filename}
                </button>
                <button
                  onClick={() => void handleDownload(source.document_id)}
                  className="shrink-0 rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors"
                  title="Download"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Metadata row */}
              <div className="flex items-center gap-2 mb-2">
                <SourceTypeBadge type={source.source_type} />
                <span className="text-[11px] text-zinc-400">
                  {new Date(source.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>

              {/* Relevance */}
              <div className="mb-2">
                <span className="text-[11px] font-medium text-zinc-500 mb-1 block">Relevance</span>
                <RelevanceBar value={source.relevance} />
              </div>

              {/* Run ID link */}
              {source.run_id && (
                <div className="mb-2">
                  <a
                    href={`/app/history`}
                    className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Run {source.run_id.slice(0, 8)}
                  </a>
                </div>
              )}

              {/* Snippet */}
              {source.snippet && (
                <p className="text-xs text-zinc-400 leading-relaxed line-clamp-4">
                  {source.snippet.slice(0, 200)}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-zinc-200 px-5 py-3">
          <p className="text-[11px] text-zinc-400 text-center">
            {sources.length} source{sources.length !== 1 ? 's' : ''} referenced in this response
          </p>
        </div>
      </div>
    </div>
  );
}
