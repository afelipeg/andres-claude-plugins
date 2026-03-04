import { useCallback, useRef, useState } from 'react';

interface FileUploadProps {
  onData: (data: unknown) => void;
  accept?: string;
}

export function FileUpload({ onData, accept = '.json,.csv,.xlsx,.xls,.pdf' }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFile = useCallback(
    (file: File) => {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const text = reader.result as string;
          const parsed = JSON.parse(text) as unknown;
          onData(parsed);
        } catch {
          onData(reader.result);
        }
      };
      reader.readAsText(file);
    },
    [onData],
  );

  return (
    <div
      className={`flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed p-8 transition-colors ${
        dragOver ? 'border-brand-400 bg-brand-50' : 'border-gray-300 hover:border-gray-400'
      }`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
      }}
    >
      <svg className="mb-3 h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
      </svg>
      {fileName ? (
        <p className="text-sm font-medium text-brand-600">{fileName}</p>
      ) : (
        <>
          <p className="text-sm font-medium text-gray-700">Drop a file or click to upload</p>
          <p className="mt-1 text-xs text-gray-500">JSON, CSV, Excel (.xlsx), or PDF</p>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={accept}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}
