import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseInput } from '@openagency/core/data/parser';
import { parseFile } from '@openagency/core/data/file-parser';
import {
  detectPlatform,
  type AdPlatform,
  type PlatformMapping,
  type TransformOptions,
} from '@openagency/core/data/platform-detect';
import { useConnectorStore } from '../stores/connector-store';

const BINARY_EXTENSIONS = new Set(['.xlsx', '.xls', '.pdf']);

// ─── Platform badge config ─────────────────────────────────────────

const PLATFORM_META: Record<
  AdPlatform,
  { label: string; color: string; icon: string }
> = {
  google_ads: {
    label: 'Google Ads',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: 'G',
  },
  meta_ads: {
    label: 'Meta Ads',
    color: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    icon: 'M',
  },
  tiktok_ads: {
    label: 'TikTok Ads',
    color: 'bg-pink-100 text-pink-700 border-pink-200',
    icon: 'T',
  },
  generic: {
    label: 'Generic CSV',
    color: 'bg-gray-100 text-gray-700 border-gray-200',
    icon: '?',
  },
};

// ─── Types ──────────────────────────────────────────────────────────

interface SmartUploadProps {
  /** Transform parsed rows into the engine-specific input shape */
  transformFn: (
    rows: Record<string, unknown>[],
    opts: TransformOptions,
  ) => unknown;
  /** Called when user confirms and clicks "Analyze" */
  onAnalyze: (input: unknown) => void;
  /** Also accept raw JSON (passes through directly) */
  onRawJson?: (data: unknown) => void;
}

interface DetectionState {
  mapping: PlatformMapping;
  rows: Record<string, unknown>[];
  columns: string[];
  rowCount: number;
}

// ─── Component ──────────────────────────────────────────────────────

export function SmartUpload({
  transformFn,
  onAnalyze,
  onRawJson,
}: SmartUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [detection, setDetection] = useState<DetectionState | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const connectedPlatforms = useConnectorStore((s) => s.getConnectedPlatforms());
  const navigate = useNavigate();

  const processText = useCallback(
    (text: string, name?: string) => {
      const parsed = parseInput(text);
      if (name) setFileName(name);

      // If JSON and the caller wants raw JSON, pass it through
      if (parsed.format === 'json' && onRawJson) {
        onRawJson(parsed.data.length === 1 ? parsed.data[0] : parsed.data);
        return;
      }

      // CSV → detect platform
      const mapping = detectPlatform(parsed.columns);
      setDetection({
        mapping,
        rows: parsed.data,
        columns: parsed.columns,
        rowCount: parsed.data.length,
      });
    },
    [onRawJson],
  );

  const processBinary = useCallback(
    async (buffer: ArrayBuffer, name: string) => {
      const result = await parseFile(buffer, name);
      setFileName(name);

      if (result.format === 'json' && onRawJson) {
        onRawJson(result.data.length === 1 ? result.data[0] : result.data);
        return;
      }

      const mapping = detectPlatform(result.columns);
      setDetection({
        mapping,
        rows: result.data,
        columns: result.columns,
        rowCount: result.data.length,
      });
    },
    [onRawJson],
  );

  const handleFile = useCallback(
    (file: File) => {
      const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
      if (BINARY_EXTENSIONS.has(ext)) {
        const reader = new FileReader();
        reader.onload = () => processBinary(reader.result as ArrayBuffer, file.name);
        reader.readAsArrayBuffer(file);
      } else {
        const reader = new FileReader();
        reader.onload = () => processText(reader.result as string, file.name);
        reader.readAsText(file);
      }
    },
    [processText, processBinary],
  );

  const handleAnalyze = useCallback(() => {
    if (!detection) return;
    const input = transformFn(detection.rows, {
      platform: detection.mapping.platform,
      columnMap: detection.mapping.columnMap,
    });
    onAnalyze(input);
    setDetection(null);
    setFileName(null);
    setPasteText('');
  }, [detection, transformFn, onAnalyze]);

  const reset = () => {
    setDetection(null);
    setFileName(null);
    setPasteText('');
    setPasteMode(false);
  };

  // ─── Detection Result UI ───────────────────────────────────────

  if (detection) {
    const meta = PLATFORM_META[detection.mapping.platform];
    const mappedFields = Object.entries(detection.mapping.columnMap).filter(
      ([, v]) => v,
    );
    const confidencePct = Math.round(detection.mapping.confidence * 100);

    return (
      <div className="space-y-4 rounded-xl border-2 border-brand-200 bg-brand-50/30 p-5">
        {/* Platform badge + confidence */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-lg border text-sm font-bold ${meta.color}`}
            >
              {meta.icon}
            </span>
            <div>
              <p className="text-sm font-semibold text-gray-900">
                Detected: {meta.label}
              </p>
              <p className="text-xs text-gray-500">
                {detection.rowCount} rows &middot; {detection.columns.length}{' '}
                columns
                {fileName && (
                  <>
                    {' '}
                    &middot; <span className="text-brand-600">{fileName}</span>
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-20 rounded-full bg-gray-200">
              <div
                className={`h-2 rounded-full transition-all ${
                  confidencePct >= 70
                    ? 'bg-green-500'
                    : confidencePct >= 40
                      ? 'bg-yellow-500'
                      : 'bg-gray-400'
                }`}
                style={{ width: `${confidencePct}%` }}
              />
            </div>
            <span className="text-xs font-medium text-gray-600">
              {confidencePct}%
            </span>
          </div>
        </div>

        {/* Column mapping preview */}
        {mappedFields.length > 0 && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 md:grid-cols-3">
            {mappedFields.map(([field, col]) => (
              <div key={field} className="flex items-center gap-2 text-xs">
                <span className="font-medium text-gray-500">{field}:</span>
                <span className="truncate text-gray-800">{col as string}</span>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleAnalyze}
            className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700"
          >
            Analyze
          </button>
          <button
            onClick={reset}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            Reset
          </button>
        </div>
      </div>
    );
  }

  // ─── Paste mode ────────────────────────────────────────────────

  if (pasteMode) {
    return (
      <div className="space-y-3">
        <textarea
          className="h-40 w-full rounded-xl border-2 border-gray-300 bg-white p-4 font-mono text-xs text-gray-800 placeholder-gray-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
          placeholder="Paste your CSV data here (include header row)..."
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
        />
        <div className="flex gap-2">
          <button
            onClick={() => {
              if (pasteText.trim()) processText(pasteText.trim(), 'pasted.csv');
            }}
            disabled={!pasteText.trim()}
            className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
          >
            Detect &amp; Preview
          </button>
          <button
            onClick={() => {
              setPasteMode(false);
              setPasteText('');
            }}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ─── Upload drop zone ─────────────────────────────────────────

  return (
    <div className="space-y-3">
      <div
        className={`flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed p-8 transition-colors ${
          dragOver
            ? 'border-brand-400 bg-brand-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
      >
        <svg
          className="mb-3 h-10 w-10 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
          />
        </svg>
        <p className="text-sm font-medium text-gray-700">
          Drop a file or click to upload
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Supports CSV, Excel (.xlsx), PDF &middot; Auto-detects Google Ads, Meta Ads, TikTok Ads
        </p>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".csv,.tsv,.txt,.xlsx,.xls,.pdf"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={() => setPasteMode(true)}
          className="text-xs font-medium text-brand-600 hover:text-brand-700"
        >
          Or paste CSV data directly
        </button>
        {connectedPlatforms.length > 0 ? (
          <span className="text-xs text-gray-400">
            or use data from{' '}
            <button onClick={() => navigate('/integrations')} className="font-medium text-brand-600 hover:text-brand-700">
              {connectedPlatforms.length} connected platform{connectedPlatforms.length > 1 ? 's' : ''}
            </button>
          </span>
        ) : (
          <span className="text-xs text-gray-400">
            or{' '}
            <button onClick={() => navigate('/integrations')} className="font-medium text-brand-600 hover:text-brand-700">
              connect a platform
            </button>
          </span>
        )}
      </div>
    </div>
  );
}
