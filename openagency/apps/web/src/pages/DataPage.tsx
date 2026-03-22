// ─── Data Upload Page ────────────────────────────────────────────────
// Drag-and-drop file upload, upload history, and preview

import { useState, useEffect, useCallback, useRef } from 'react';
import { Upload, FileText, Trash2, Eye, X } from 'lucide-react';
import {
  uploadFile,
  listUploads,
  getUpload,
  deleteUpload,
  updateColumnMap,
  type UploadRecord,
  type UploadDetail,
} from '../api/uploads';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';

const API_URL = import.meta.env.VITE_API_URL ?? '';

const DATA_TYPES = [
  { value: '', label: 'Auto-detect' },
  { value: 'platform_export', label: 'Ad Platform Data' },
  { value: 'sell_in', label: 'Sell-in' },
  { value: 'sell_out', label: 'Sell-out' },
  { value: 'digital_sales', label: 'Digital Sales' },
  { value: 'kpi_results', label: 'KPI Results (Actual)' },
  { value: 'budget_plan', label: 'Budget Plan' },
  { value: 'other', label: 'Other' },
];

// ─── Upload Zone ─────────────────────────────────────────────────────

function UploadZone({
  onUpload,
  uploading,
}: {
  onUpload: (file: File, dataType: string) => void;
  uploading: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [dataType, setDataType] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) onUpload(file, dataType);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onUpload(file, dataType);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 shadow-sm shadow-black/20 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-white/95">Upload Data</h3>
          <p className="text-xs text-white/50 mt-0.5">
            Upload CSV or Excel files with campaign, sell-in, sell-out, or digital sales data.
          </p>
        </div>
        <select
          value={dataType}
          onChange={(e) => setDataType(e.target.value)}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70"
        >
          {DATA_TYPES.map((dt) => (
            <option key={dt.value} value={dt.value}>{dt.label}</option>
          ))}
        </select>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 cursor-pointer transition-colors ${
          dragOver
            ? 'border-[#02c98d] bg-[#02c98d]/5'
            : 'border-white/10 hover:border-white/15 hover:bg-white/5/50'
        }`}
      >
        <Upload className={`h-8 w-8 mb-3 ${dragOver ? 'text-[#02c98d]' : 'text-white/40'}`} />
        {uploading ? (
          <p className="text-sm text-white/60">Uploading and parsing...</p>
        ) : (
          <>
            <p className="text-sm text-white/60">
              <span className="font-medium text-white/95">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-white/40 mt-1">CSV, Excel, PDF, Word (max 50MB)</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls,.pdf,.docx,.doc"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>
    </div>
  );
}

// ─── Upload History ──────────────────────────────────────────────────

function platformBadge(platform: string) {
  const colors: Record<string, string> = {
    google_ads: 'bg-[#00F5FF]/20 text-[#00F5FF]',
    meta_ads: 'bg-indigo-500/20 text-indigo-300',
    tiktok_ads: 'bg-pink-500/20 text-pink-300',
    dv360: 'bg-emerald-500/100/20 text-emerald-300',
    amazon_ads: 'bg-orange-500/20 text-orange-300',
    unknown: 'bg-white/10 text-white/60',
  };
  const cls = colors[platform] ?? colors.unknown;
  const label = platform.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`}>
      {label}
    </span>
  );
}

function UploadHistory({
  records,
  onPreview,
  onDelete,
}: {
  records: UploadRecord[];
  onPreview: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  if (records.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center">
        <FileText className="h-8 w-8 text-white/30 mx-auto mb-3" />
        <p className="text-sm text-white/50">No uploads yet</p>
        <p className="text-xs text-white/40 mt-1">
          Upload a CSV or Excel file to enrich your pipeline runs with real business data.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 shadow-sm shadow-black/20 overflow-hidden">
      <div className="border-b border-white/5 px-6 py-4">
        <h3 className="text-sm font-semibold text-white/95">Upload History</h3>
        <p className="text-xs text-white/50 mt-0.5">{records.length} file{records.length !== 1 ? 's' : ''} uploaded</p>
      </div>
      <div className="divide-y divide-white/5">
        {records.map((rec) => (
          <div key={rec.id} className="flex items-center gap-4 px-6 py-3 hover:bg-white/5/50 transition-colors">
            <FileText className="h-5 w-5 text-white/40 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-white/95 truncate">{rec.file_name}</p>
                {platformBadge(rec.platform)}
              </div>
              <p className="text-xs text-white/40 mt-0.5">
                {rec.data_type.replace(/_/g, ' ')} &middot; {rec.row_count.toLocaleString()} rows &middot; {rec.format.toUpperCase()} &middot; {new Date(rec.uploaded_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => onPreview(rec.id)}
                className="rounded-lg p-2 text-white/40 hover:text-white/70 hover:bg-white/10 transition-colors"
                title="Preview"
              >
                <Eye className="h-4 w-4" />
              </button>
              <button
                onClick={() => onDelete(rec.id)}
                className="rounded-lg p-2 text-white/40 hover:text-red-400 hover:bg-red-500/100/10 transition-colors"
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Preview Dialog ──────────────────────────────────────────────────

function PreviewDialog({
  detail,
  open,
  onOpenChange,
}: {
  detail: UploadDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!detail) return null;

  const previewRows = detail.data.slice(0, 20);
  const columns = detail.columns.slice(0, 10); // limit columns for readability

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {detail.file_name}
          </DialogTitle>
          <p className="text-xs text-white/50">
            {detail.row_count.toLocaleString()} rows &middot; {detail.columns.length} columns &middot; {detail.platform} &middot; {detail.format.toUpperCase()}
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-auto border rounded-lg">
          <table className="w-full text-xs">
            <thead className="bg-white/5 sticky top-0">
              <tr>
                {columns.map((col) => (
                  <th key={col} className="px-3 py-2 text-left font-semibold text-white/70 whitespace-nowrap border-b border-white/10">
                    {col}
                  </th>
                ))}
                {detail.columns.length > 10 && (
                  <th className="px-3 py-2 text-left font-semibold text-white/40 whitespace-nowrap border-b border-white/10">
                    +{detail.columns.length - 10} more
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {previewRows.map((row, i) => (
                <tr key={i} className="hover:bg-white/5/50">
                  {columns.map((col) => (
                    <td key={col} className="px-3 py-1.5 text-white/60 whitespace-nowrap max-w-[200px] truncate">
                      {String(row[col] ?? '')}
                    </td>
                  ))}
                  {detail.columns.length > 10 && <td className="px-3 py-1.5 text-white/30">...</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {detail.row_count > 20 && (
          <p className="text-xs text-white/40 text-center py-2">
            Showing first 20 of {detail.row_count.toLocaleString()} rows
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Column Mapping Wizard ───────────────────────────────────────────

const STANDARD_METRICS = [
  { value: '', label: 'Skip (do not map)' },
  { value: 'period', label: 'Period (week/month)' },
  { value: 'net_revenue', label: 'Net Revenue' },
  { value: 'gross_revenue', label: 'Gross Revenue' },
  { value: 'units_sold', label: 'Units Sold' },
  { value: 'market_share', label: 'Market Share (%)' },
  { value: 'digital_sales', label: 'Digital Sales' },
  { value: 'sell_in', label: 'Sell-in' },
  { value: 'sell_out', label: 'Sell-out' },
  { value: 'conversions', label: 'Conversions' },
  { value: 'roas', label: 'ROAS' },
  { value: 'cpa', label: 'CPA' },
  { value: 'spend', label: 'Ad Spend' },
  { value: 'impressions', label: 'Impressions' },
  { value: 'clicks', label: 'Clicks' },
  { value: 'ctr', label: 'CTR (%)' },
  { value: 'brand_awareness', label: 'Brand Awareness' },
  { value: 'custom', label: 'Custom metric' },
];

function ColumnMappingDialog({
  uploadId,
  columns,
  open,
  onOpenChange,
  onSaved,
}: {
  uploadId: string;
  columns: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const updateMapping = (col: string, metric: string) => {
    setMapping((prev) => {
      const next = { ...prev };
      if (metric) next[col] = metric;
      else delete next[col];
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateColumnMap(uploadId, mapping);
      onSaved();
      onOpenChange(false);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const mappedCount = Object.values(mapping).filter(Boolean).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Map Columns to Metrics</DialogTitle>
          <p className="text-xs text-white/50 mt-1">
            Tell Plinth what each column represents so engines can interpret your data correctly.
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-2 py-2">
          {columns.map((col) => (
            <div key={col} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white/95 truncate">{col}</p>
              </div>
              <select
                value={mapping[col] ?? ''}
                onChange={(e) => updateMapping(col, e.target.value)}
                className="w-48 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white/70"
              >
                {STANDARD_METRICS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-white/5">
          <p className="text-xs text-white/40">{mappedCount} of {columns.length} columns mapped</p>
          <div className="flex gap-2">
            <button
              onClick={() => onOpenChange(false)}
              className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/5"
            >
              Skip for now
            </button>
            <button
              onClick={() => void handleSave()}
              disabled={saving || mappedCount === 0}
              className="rounded-lg bg-[#00F5FF]/20 px-4 py-2 text-sm font-medium text-white hover:bg-[#00F5FF]/30 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Mapping'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────

export function DataPage() {
  const [records, setRecords] = useState<UploadRecord[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ success: boolean; message: string } | null>(null);
  const [previewDetail, setPreviewDetail] = useState<UploadDetail | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [mappingUpload, setMappingUpload] = useState<{ id: string; columns: string[] } | null>(null);
  const [clientId, setClientId] = useState<string>('');

  // Get client_id from auth context
  useEffect(() => {
    const token = localStorage.getItem('plinth_token');
    if (!token) return;
    fetch(`${API_URL}/v1/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const user = data?.user ?? data;
        setClientId(user?.client_id ?? user?.id ?? user?.email ?? 'default');
      })
      .catch(() => setClientId('default'));
  }, []);

  const loadRecords = useCallback(async () => {
    if (!clientId) return;
    try {
      const recs = await listUploads(clientId);
      setRecords(recs);
    } catch {
      // API may not be available
    }
  }, [clientId]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const handleUpload = async (file: File, dataType: string) => {
    setUploading(true);
    setUploadResult(null);
    try {
      const result = await uploadFile(file, clientId, dataType || undefined);
      setUploadResult({
        success: true,
        message: `Uploaded ${file.name}: ${result.rows} rows, detected as ${result.platform} (${Math.round(result.confidence * 100)}% confidence).`,
      });
      // Open column mapping wizard for KPI results and budget plans
      if ((dataType === 'kpi_results' || dataType === 'budget_plan') && result.record_id) {
        setMappingUpload({ id: result.record_id, columns: result.columns });
      }
      void loadRecords();
    } catch (err) {
      setUploadResult({
        success: false,
        message: err instanceof Error ? err.message : 'Upload failed',
      });
    } finally {
      setUploading(false);
    }
  };

  const handlePreview = async (id: string) => {
    try {
      const detail = await getUpload(id);
      setPreviewDetail(detail);
      setPreviewOpen(true);
    } catch {
      // ignore
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteUpload(id);
      setRecords((prev) => prev.filter((r) => r.id !== id));
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white/95">Data Uploads</h2>
        <p className="mt-1 text-sm text-white/50">
          Upload CSV or Excel files with business data to enrich pipeline runs.
          Uploaded data is automatically merged into subsequent analysis cycles.
        </p>
      </div>

      {/* Upload zone */}
      <UploadZone onUpload={(f, dt) => void handleUpload(f, dt)} uploading={uploading} />

      {/* Upload result toast */}
      {uploadResult && (
        <div
          className={`flex items-center gap-3 rounded-lg border p-3 ${
            uploadResult.success
              ? 'border-emerald-500/30 bg-emerald-500/100/10 text-emerald-300'
              : 'border-red-500/30 bg-red-500/10 text-red-800'
          }`}
        >
          <p className="flex-1 text-xs">{uploadResult.message}</p>
          <button onClick={() => setUploadResult(null)} className="shrink-0">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Upload history */}
      <UploadHistory
        records={records}
        onPreview={(id) => void handlePreview(id)}
        onDelete={(id) => void handleDelete(id)}
      />

      {/* Preview dialog */}
      <PreviewDialog
        detail={previewDetail}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />

      {/* Column mapping wizard */}
      {mappingUpload && (
        <ColumnMappingDialog
          uploadId={mappingUpload.id}
          columns={mappingUpload.columns}
          open={!!mappingUpload}
          onOpenChange={(open) => { if (!open) setMappingUpload(null); }}
          onSaved={() => void loadRecords()}
        />
      )}
    </div>
  );
}
