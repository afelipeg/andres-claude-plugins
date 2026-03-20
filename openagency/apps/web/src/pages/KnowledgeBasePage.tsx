// ─── Knowledge Base Page ──────────────────────────────────────────────
// File explorer with folder tree (left) + document list (right).
// RAG-indexed documents, engine outputs, and uploaded files.

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  FolderOpen,
  FolderClosed,
  Lock,
  Plus,
  Trash2,
  Search,
  Upload,
  Download,
  FileText,
  ChevronRight,
  ChevronDown,
  Loader2,
  X,
  HardDrive,
  Database,
  PieChart,
  File,
} from 'lucide-react';
import {
  listFolders,
  listDocuments,
  createFolder,
  deleteFolder,
  uploadDocument,
  deleteDocument,
  getDocumentDownloadUrl,
  searchKB,
  getKBStats,
  type KBFolder,
  type KBDocument,
  type KBSearchResult,
  type KBStats,
} from '../api/kb';
import { cn } from '../lib/utils';

// ─── Helpers ────────────────────────────────────────────────────────

function fmtBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function fmtDate(s: string): string {
  return new Date(s).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// Use a default client ID (from localStorage or fallback)
function getClientId(): string {
  return localStorage.getItem('plinth_client_id') ?? 'default';
}

// ─── Source type badges ─────────────────────────────────────────────

const SOURCE_TYPE_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  engine_output: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Engine Output' },
  upload: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Upload' },
  external_report: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'External Report' },
  benchmark: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Benchmark' },
};

function SourceBadge({ type }: { type: string }) {
  const c = SOURCE_TYPE_CONFIG[type] ?? { bg: 'bg-zinc-100', text: 'text-zinc-600', label: type };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  );
}

// ─── Embedding status indicator ─────────────────────────────────────

function StatusDot({ status }: { status: string }) {
  switch (status) {
    case 'indexed':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Indexed
        </span>
      );
    case 'processing':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600">
          <Loader2 className="h-3 w-3 animate-spin" />
          Processing
        </span>
      );
    case 'failed':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-500">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
          Failed
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-400">
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-300" />
          Pending
        </span>
      );
  }
}

// ─── Stats bar ──────────────────────────────────────────────────────

function StatsBar({ stats }: { stats: KBStats | null }) {
  if (!stats) return null;
  const items = [
    { label: 'Documents', value: stats.total_documents.toLocaleString(), Icon: FileText },
    { label: 'Chunks', value: stats.total_chunks.toLocaleString(), Icon: Database },
    { label: 'Indexed', value: `${Math.round(stats.indexed_pct)}%`, Icon: PieChart },
    { label: 'Storage', value: fmtBytes(stats.storage_bytes), Icon: HardDrive },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-50 text-zinc-400">
            <item.Icon className="h-4.5 w-4.5" />
          </div>
          <div>
            <p className="text-lg font-semibold text-zinc-900 leading-none">{item.value}</p>
            <p className="text-[11px] text-zinc-400 mt-0.5">{item.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Folder tree item ───────────────────────────────────────────────

function FolderTreeItem({
  folder,
  depth,
  selectedId,
  onSelect,
  onDelete,
}: {
  folder: KBFolder;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(depth === 0);
  const hasChildren = folder.children && folder.children.length > 0;
  const isSelected = selectedId === folder.id;

  return (
    <div>
      <div
        className={cn(
          'group flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm cursor-pointer transition-colors',
          isSelected
            ? 'bg-blue-50 text-blue-700 font-medium'
            : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900',
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => onSelect(folder.id)}
      >
        {/* Expand/collapse chevron */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="shrink-0 p-0.5 text-zinc-400 hover:text-zinc-600"
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        ) : (
          <span className="w-4.5 shrink-0" />
        )}

        {/* Folder icon */}
        {expanded || isSelected ? (
          <FolderOpen className="h-4 w-4 shrink-0 text-blue-500" />
        ) : (
          <FolderClosed className="h-4 w-4 shrink-0 text-zinc-400" />
        )}

        {/* Name */}
        <span className="flex-1 truncate">{folder.name}</span>

        {/* Lock icon for system folders */}
        {folder.is_system && (
          <Lock className="h-3 w-3 shrink-0 text-zinc-300" />
        )}

        {/* Delete button for custom folders */}
        {!folder.is_system && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(folder.id);
            }}
            className="hidden group-hover:block shrink-0 rounded p-0.5 text-zinc-400 hover:text-red-500 transition-colors"
            title="Delete folder"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div>
          {folder.children!.map((child) => (
            <FolderTreeItem
              key={child.id}
              folder={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Drop zone ──────────────────────────────────────────────────────

function DropZone({
  onFiles,
  uploading,
}: {
  onFiles: (files: FileList) => void;
  uploading: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) onFiles(e.dataTransfer.files);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 transition-colors cursor-pointer',
        dragOver
          ? 'border-blue-400 bg-blue-50'
          : 'border-zinc-200 bg-zinc-50 hover:border-zinc-300 hover:bg-white',
      )}
      onClick={() => fileRef.current?.click()}
    >
      <input
        ref={fileRef}
        type="file"
        multiple
        accept=".csv,.xlsx,.xls,.pdf,.docx,.doc,.txt,.json,.pptx"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) onFiles(e.target.files);
          e.target.value = '';
        }}
      />
      {uploading ? (
        <Loader2 className="h-6 w-6 animate-spin text-blue-500 mb-2" />
      ) : (
        <Upload className="h-6 w-6 text-zinc-400 mb-2" />
      )}
      <p className="text-sm text-zinc-600 font-medium">
        {uploading ? 'Uploading...' : 'Drop files here or click to upload'}
      </p>
      <p className="text-[11px] text-zinc-400 mt-1">
        CSV, Excel, PDF, DOCX, TXT, JSON, PPTX
      </p>
    </div>
  );
}

// ─── Search results overlay ─────────────────────────────────────────

function SearchResults({
  results,
  onClose,
}: {
  results: KBSearchResult[];
  onClose: () => void;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-lg mb-4">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
        <span className="text-sm font-semibold text-zinc-900">
          {results.length} result{results.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="divide-y divide-zinc-100 max-h-80 overflow-y-auto">
        {results.map((r, idx) => (
          <div key={`${r.document_id}-${idx}`} className="px-4 py-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-zinc-900">{r.filename}</span>
              <SourceBadge type={r.source_type} />
              <span className="ml-auto text-[11px] text-zinc-400">
                {Math.round(r.relevance * 100)}% match
              </span>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed line-clamp-2">{r.snippet}</p>
          </div>
        ))}
        {results.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-zinc-400">No results found</div>
        )}
      </div>
    </div>
  );
}

// ─── Main page ──────────────────────────────────────────────────────

export function KnowledgeBasePage() {
  const clientId = getClientId();

  // State
  const [folders, setFolders] = useState<KBFolder[]>([]);
  const [documents, setDocuments] = useState<KBDocument[]>([]);
  const [stats, setStats] = useState<KBStats | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [docLoading, setDocLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<KBSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);

  // New folder
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const newFolderRef = useRef<HTMLInputElement>(null);

  // ── Load initial data ────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [f, s] = await Promise.all([
        listFolders(clientId).catch(() => []),
        getKBStats(clientId).catch(() => null),
      ]);
      setFolders(f);
      setStats(s);

      // Load all documents initially
      const docs = await listDocuments(clientId).catch(() => []);
      setDocuments(docs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load knowledge base');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // ── Load docs when folder changes ────────────────────────────────
  useEffect(() => {
    setDocLoading(true);
    void listDocuments(clientId, selectedFolder ?? undefined)
      .then(setDocuments)
      .catch(() => setDocuments([]))
      .finally(() => setDocLoading(false));
  }, [clientId, selectedFolder]);

  // ── Folder CRUD ──────────────────────────────────────────────────
  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    try {
      const folder = await createFolder(clientId, name, selectedFolder ?? undefined);
      setFolders((prev) => [...prev, folder]);
      setNewFolderName('');
      setShowNewFolder(false);
    } catch {
      // Silently fail
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!confirm('Delete this folder and all its documents?')) return;
    try {
      await deleteFolder(folderId);
      setFolders((prev) => prev.filter((f) => f.id !== folderId));
      if (selectedFolder === folderId) setSelectedFolder(null);
    } catch {
      // Silently fail
    }
  };

  // ── Document actions ─────────────────────────────────────────────
  const handleUpload = async (files: FileList) => {
    const folderId = selectedFolder ?? 'root';
    setUploading(true);
    try {
      const results: KBDocument[] = [];
      for (const file of Array.from(files)) {
        const doc = await uploadDocument(clientId, folderId, file);
        results.push(doc);
      }
      setDocuments((prev) => [...results, ...prev]);
      // Refresh stats
      void getKBStats(clientId).then(setStats).catch(() => {});
    } catch {
      // Silently fail
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    if (!confirm('Delete this document?')) return;
    try {
      await deleteDocument(docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      void getKBStats(clientId).then(setStats).catch(() => {});
    } catch {
      // Silently fail
    }
  };

  const handleDownload = async (docId: string) => {
    try {
      const url = await getDocumentDownloadUrl(docId);
      window.open(url, '_blank');
    } catch {
      // Silently fail
    }
  };

  // ── Search ───────────────────────────────────────────────────────
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    try {
      const results = await searchKB(clientId, q, 20);
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  // ── New folder input auto-focus ──────────────────────────────────
  useEffect(() => {
    if (showNewFolder) newFolderRef.current?.focus();
  }, [showNewFolder]);

  // ── Render ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height: '60vh' }}>
        <div className="text-center text-zinc-400">
          <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin" />
          <p className="text-sm">Loading Knowledge Base...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center" style={{ height: '60vh' }}>
        <div className="text-center">
          <p className="text-sm text-red-500 mb-2">{error}</p>
          <button
            onClick={() => void loadData()}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Stats */}
      <StatsBar stats={stats} />

      {/* Main content: folder tree + document list */}
      <div className="flex-1 flex gap-6 min-h-0">
        {/* ── Left: Folder tree ─────────────────────────── */}
        <div className="w-[280px] shrink-0 flex flex-col rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-100">
            <h3 className="text-sm font-semibold text-zinc-900">Folders</h3>
          </div>

          <div className="flex-1 overflow-y-auto py-2 px-1">
            {/* All files (root) */}
            <div
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm cursor-pointer transition-colors mb-1',
                selectedFolder === null
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900',
              )}
              onClick={() => setSelectedFolder(null)}
            >
              <File className="h-4 w-4 shrink-0" />
              <span>All Documents</span>
            </div>

            {/* Folder tree */}
            {folders.map((folder) => (
              <FolderTreeItem
                key={folder.id}
                folder={folder}
                depth={0}
                selectedId={selectedFolder}
                onSelect={setSelectedFolder}
                onDelete={(id) => void handleDeleteFolder(id)}
              />
            ))}

            {folders.length === 0 && (
              <p className="px-3 py-4 text-xs text-zinc-400 text-center">No folders yet</p>
            )}
          </div>

          {/* New folder */}
          <div className="border-t border-zinc-100 px-3 py-2">
            {showNewFolder ? (
              <div className="flex items-center gap-1.5">
                <input
                  ref={newFolderRef}
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleCreateFolder();
                    if (e.key === 'Escape') {
                      setShowNewFolder(false);
                      setNewFolderName('');
                    }
                  }}
                  placeholder="Folder name"
                  className="flex-1 rounded-lg border border-zinc-200 px-2 py-1 text-sm focus:border-blue-400 focus:outline-none"
                />
                <button
                  onClick={() => void handleCreateFolder()}
                  disabled={!newFolderName.trim()}
                  className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  Add
                </button>
                <button
                  onClick={() => {
                    setShowNewFolder(false);
                    setNewFolderName('');
                  }}
                  className="rounded-lg p-1 text-zinc-400 hover:text-zinc-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowNewFolder(true)}
                className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New Folder</span>
              </button>
            )}
          </div>
        </div>

        {/* ── Right: Document list ──────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Search bar */}
          <form onSubmit={handleSearch} className="flex items-center gap-2 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search knowledge base..."
                className="w-full rounded-xl border border-zinc-200 bg-white pl-10 pr-4 py-2.5 text-sm text-zinc-800 shadow-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400/20 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSearchResults(null);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={searching || !searchQuery.trim()}
              className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 transition-colors"
            >
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
            </button>
          </form>

          {/* Search results */}
          {searchResults !== null && (
            <SearchResults
              results={searchResults}
              onClose={() => setSearchResults(null)}
            />
          )}

          {/* Upload drop zone */}
          <div className="mb-4">
            <DropZone onFiles={(f) => void handleUpload(f)} uploading={uploading} />
          </div>

          {/* Document table */}
          <div className="flex-1 rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50">
                    <th className="px-4 py-3 text-left font-semibold text-zinc-700">Filename</th>
                    <th className="px-4 py-3 text-left font-semibold text-zinc-700">Type</th>
                    <th className="px-4 py-3 text-left font-semibold text-zinc-700">Size</th>
                    <th className="px-4 py-3 text-left font-semibold text-zinc-700">Status</th>
                    <th className="px-4 py-3 text-left font-semibold text-zinc-700">Chunks</th>
                    <th className="px-4 py-3 text-left font-semibold text-zinc-700">Date</th>
                    <th className="px-4 py-3 text-right font-semibold text-zinc-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {docLoading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center">
                        <Loader2 className="h-5 w-5 animate-spin text-zinc-300 mx-auto" />
                      </td>
                    </tr>
                  ) : documents.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-zinc-400 text-sm">
                        No documents{selectedFolder ? ' in this folder' : ''} yet. Upload files above.
                      </td>
                    </tr>
                  ) : (
                    documents.map((doc) => (
                      <tr key={doc.id} className="hover:bg-zinc-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-zinc-400 shrink-0" />
                            <span className="font-medium text-zinc-900 truncate max-w-[200px]">
                              {doc.filename}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <SourceBadge type={doc.source_type} />
                        </td>
                        <td className="px-4 py-3 text-zinc-500 tabular-nums">
                          {fmtBytes(doc.size_bytes)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusDot status={doc.embedding_status} />
                        </td>
                        <td className="px-4 py-3 text-zinc-500 tabular-nums">
                          {doc.chunk_count}
                        </td>
                        <td className="px-4 py-3 text-zinc-500 text-xs">
                          {fmtDate(doc.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => void handleDownload(doc.id)}
                              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors"
                              title="Download"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => void handleDeleteDoc(doc.id)}
                              className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
