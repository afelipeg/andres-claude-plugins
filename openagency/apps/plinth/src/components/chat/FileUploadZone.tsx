'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploadZoneProps {
  onFileUpload: (filename: string, contentBase64: string) => void;
  children: React.ReactNode;
}

const ACCEPTED_TYPES: Record<string, string> = {
  'text/csv': 'CSV',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
  'application/vnd.ms-excel': 'XLS',
  'application/pdf': 'PDF',
  'application/json': 'JSON',
};

const ACCEPTED_EXTENSIONS = ['.csv', '.xlsx', '.xls', '.pdf', '.json'];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isAcceptedFile(file: File): boolean {
  if (ACCEPTED_TYPES[file.type]) return true;
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  return ACCEPTED_EXTENSIONS.includes(ext);
}

export function FileUploadZone({ onFileUpload, children }: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState<{ name: string; progress: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const processFile = useCallback(
    async (file: File) => {
      if (!isAcceptedFile(file)) {
        setError(`Unsupported file type. Accepted: ${ACCEPTED_EXTENSIONS.join(', ')}`);
        setTimeout(() => setError(null), 4000);
        return;
      }

      // Max 25MB
      if (file.size > 25 * 1024 * 1024) {
        setError('File too large. Maximum size is 25MB.');
        setTimeout(() => setError(null), 4000);
        return;
      }

      setError(null);
      setUploading({ name: file.name, progress: 0 });

      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onprogress = (e) => {
            if (e.lengthComputable) {
              setUploading((prev) =>
                prev ? { ...prev, progress: Math.round((e.loaded / e.total) * 100) } : null
              );
            }
          };
          reader.onload = () => {
            const result = reader.result as string;
            // Strip the data URI prefix to get pure base64
            const base64Data = result.includes(',') ? result.split(',')[1] : result;
            resolve(base64Data);
          };
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(file);
        });

        onFileUpload(file.name, base64);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to process file');
        setTimeout(() => setError(null), 4000);
      } finally {
        setUploading(null);
      }
    },
    [onFileUpload]
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (dragCounterRef.current === 1) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      dragCounterRef.current = 0;

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        processFile(files[0]);
      }
    },
    [processFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        processFile(files[0]);
      }
      // Reset input so the same file can be re-selected
      e.target.value = '';
    },
    [processFile]
  );

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div
      className="relative flex flex-col flex-1 min-h-0"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS.join(',')}
        onChange={handleFileSelect}
        className="hidden"
        aria-label="Upload file"
      />

      {/* Children (chat content) */}
      {children}

      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm border-2 border-dashed border-primary/50 rounded-xl m-2">
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20">
              <Upload className="h-7 w-7 text-primary" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">Drop file here</p>
              <p className="text-xs text-muted-foreground mt-1">CSV, XLSX, PDF, or JSON</p>
            </div>
          </div>
        </div>
      )}

      {/* Upload progress toast */}
      {uploading && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 shadow-xl shadow-black/30">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <div className="min-w-0">
            <p className="text-sm text-foreground truncate max-w-[200px]">{uploading.name}</p>
            <div className="mt-1 h-1 w-40 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${uploading.progress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Error toast */}
      {error && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 shadow-xl">
          <X className="h-4 w-4 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Upload button (exposed for external use) */}
      <button
        onClick={openFilePicker}
        className="absolute bottom-[72px] right-6 flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
        aria-label="Upload file"
        title="Upload file (CSV, XLSX, PDF, JSON)"
      >
        <Upload className="h-4 w-4" />
      </button>
    </div>
  );
}
