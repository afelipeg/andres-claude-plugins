import { useEffect } from 'react';
import { useHistoryStore } from '../stores/history-store';
import { useEngineStore } from '../stores/engine-store';
import { downloadReport } from '../lib/pdf-report';
import type { EngineResult } from '@openagency/types';

const ENGINE_ICONS: Record<string, string> = {
  'leak-detector': 'LD',
  'media-architect': 'MA',
  'campaign-ops': 'CO',
  'executive-bridge': 'EB',
};

const ENGINE_COLORS: Record<string, string> = {
  'leak-detector': 'bg-red-100 text-red-700',
  'media-architect': 'bg-zinc-100 text-zinc-700',
  'campaign-ops': 'bg-amber-100 text-amber-700',
  'executive-bridge': 'bg-green-100 text-green-700',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function ReportHistory() {
  const { reports, loaded, load, remove, clearAll } = useHistoryStore();
  const setResult = useEngineStore((s) => s.setResult);

  useEffect(() => {
    load();
  }, [load]);

  if (!loaded) return null;
  if (reports.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
        <svg className="mx-auto h-8 w-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
        <p className="mt-2 text-sm text-gray-500">No saved reports yet.</p>
        <p className="text-xs text-gray-400">Run an analysis to auto-save.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">
          Saved Reports ({reports.length})
        </h3>
        <button
          onClick={() => {
            if (confirm('Delete all saved reports?')) clearAll();
          }}
          className="text-xs text-gray-400 hover:text-red-500"
        >
          Clear all
        </button>
      </div>

      <div className="space-y-2">
        {reports.slice(0, 20).map((report) => (
          <div
            key={report.id}
            className="group flex items-center gap-3 rounded-lg border border-gray-100 bg-white p-3 transition-colors hover:border-zinc-200 hover:bg-zinc-50"
          >
            {/* Engine badge */}
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                ENGINE_COLORS[report.engineId] ?? 'bg-gray-100 text-gray-700'
              }`}
            >
              {ENGINE_ICONS[report.engineId] ?? '?'}
            </span>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">
                {report.label}
              </p>
              <p className="text-xs text-gray-400">
                {timeAgo(report.timestamp)}
                {report.duration_ms != null && ` \u00b7 ${report.duration_ms}ms`}
              </p>
            </div>

            {/* Actions */}
            <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              {/* Load */}
              <button
                onClick={() => {
                  const key = `${report.engineId}:${report.skillId}`;
                  const engineResult: EngineResult<unknown> = {
                    engine: report.engineId,
                    skill: report.skillId,
                    data: report.data,
                    timestamp: report.timestamp,
                    duration_ms: report.duration_ms ?? 0,
                  };
                  setResult(key, engineResult);
                }}
                title="Load"
                className="rounded p-1 text-gray-400 hover:bg-zinc-100 hover:text-zinc-700"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>

              {/* Export PDF */}
              <button
                onClick={() => {
                  downloadReport(report.engineId, report.skillId, {
                    engine: report.engineId,
                    skill: report.skillId,
                    data: report.data,
                    timestamp: report.timestamp,
                    duration_ms: report.duration_ms ?? 0,
                  });
                }}
                title="Export PDF"
                className="rounded p-1 text-gray-400 hover:bg-zinc-100 hover:text-zinc-700"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </button>

              {/* Delete */}
              <button
                onClick={() => remove(report.id)}
                title="Delete"
                className="rounded p-1 text-gray-400 hover:bg-red-100 hover:text-red-500"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
