'use client';

import { Download, FileText, FileSpreadsheet, Presentation } from 'lucide-react';

interface DownloadCardProps {
  data: {
    filename: string;
    url?: string;
    format: 'pptx' | 'pdf' | 'xlsx' | 'docx' | 'csv';
    size_bytes?: number;
    generated_at?: string;
  };
  title?: string;
}

const FORMAT_ICONS: Record<string, typeof FileText> = {
  pdf: FileText,
  pptx: Presentation,
  xlsx: FileSpreadsheet,
  docx: FileText,
  csv: FileSpreadsheet,
};

const FORMAT_COLORS: Record<string, string> = {
  pdf: 'text-red-400 bg-red-900/30',
  pptx: 'text-orange-400 bg-orange-900/30',
  xlsx: 'text-emerald-400 bg-emerald-900/30',
  docx: 'text-blue-400 bg-blue-900/30',
  csv: 'text-cyan-400 bg-cyan-900/30',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function DownloadCard({ data, title }: DownloadCardProps) {
  const Icon = FORMAT_ICONS[data.format] ?? FileText;
  const colorClass = FORMAT_COLORS[data.format] ?? 'text-gray-400 bg-gray-900/30';

  const handleDownload = () => {
    if (data.url) {
      window.open(data.url, '_blank');
    }
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {title && <div className="px-4 py-2 border-b border-border"><h4 className="text-sm font-medium text-foreground">{title}</h4></div>}
      <div className="p-4 flex items-center gap-4">
        <div className={`${colorClass} rounded-lg p-3`}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-foreground text-sm font-medium truncate">{data.filename}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
            <span className="uppercase font-mono">{data.format}</span>
            {data.size_bytes && <span>· {formatBytes(data.size_bytes)}</span>}
            {data.generated_at && <span>· {new Date(data.generated_at).toLocaleDateString()}</span>}
          </div>
        </div>
        <button
          onClick={handleDownload}
          disabled={!data.url}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" />
          Download
        </button>
      </div>
    </div>
  );
}
