// ─── Knowledge Base API Client ────────────────────────────────────────

const API_URL = import.meta.env.VITE_API_URL ?? '';

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('plinth_token');
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...init?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Request failed' })) as { message?: string };
    throw new Error(err.message ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ─── Types ──────────────────────────────────────────────────────────

export interface KBFolder {
  id: string;
  name: string;
  parent_folder_id?: string;
  is_system: boolean;
  children?: KBFolder[];
  created_at: string;
}

export interface KBDocument {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  source_type: string;
  embedding_status: string;
  chunk_count: number;
  run_id?: string;
  created_at: string;
}

export interface KBSearchResult {
  document_id: string;
  filename: string;
  source_type: string;
  run_id?: string;
  date: string;
  relevance: number;
  snippet: string;
}

export interface KBStats {
  total_documents: number;
  total_chunks: number;
  indexed_pct: number;
  storage_bytes: number;
}

// ─── Folders ────────────────────────────────────────────────────────

export async function listFolders(clientId: string): Promise<KBFolder[]> {
  return fetchJson<KBFolder[]>(`/v1/kb/folders?client_id=${encodeURIComponent(clientId)}`);
}

export async function createFolder(
  clientId: string,
  name: string,
  parentId?: string,
): Promise<KBFolder> {
  return fetchJson<KBFolder>(`/v1/kb/folders`, {
    method: 'POST',
    body: JSON.stringify({ client_id: clientId, name, parent_folder_id: parentId }),
  });
}

export async function deleteFolder(folderId: string): Promise<void> {
  await fetchJson<void>(`/v1/kb/folders/${folderId}`, { method: 'DELETE' });
}

// ─── Documents ──────────────────────────────────────────────────────

export async function listDocuments(
  clientId: string,
  folderId?: string,
): Promise<KBDocument[]> {
  const params = new URLSearchParams({ client_id: clientId });
  if (folderId) params.set('folder_id', folderId);
  return fetchJson<KBDocument[]>(`/v1/kb/documents?${params.toString()}`);
}

export async function uploadDocument(
  clientId: string,
  folderId: string,
  file: File,
): Promise<KBDocument> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder_id', folderId);
  formData.append('client_id', clientId);

  const token = localStorage.getItem('plinth_token');
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/v1/kb/documents/upload`, {
    method: 'POST',
    headers,
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Upload failed' })) as { message?: string };
    throw new Error(err.message ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<KBDocument>;
}

export async function deleteDocument(documentId: string): Promise<void> {
  await fetchJson<void>(`/v1/kb/documents/${documentId}`, { method: 'DELETE' });
}

export async function getDocumentDownloadUrl(documentId: string): Promise<string> {
  const data = await fetchJson<{ url: string }>(`/v1/kb/documents/${documentId}/download`);
  return data.url;
}

// ─── Search ─────────────────────────────────────────────────────────

export async function searchKB(
  clientId: string,
  query: string,
  limit?: number,
): Promise<KBSearchResult[]> {
  const params = new URLSearchParams({ client_id: clientId, q: query });
  if (limit) params.set('limit', String(limit));
  return fetchJson<KBSearchResult[]>(`/v1/kb/search?${params.toString()}`);
}

// ─── Stats ──────────────────────────────────────────────────────────

export async function getKBStats(clientId: string): Promise<KBStats> {
  return fetchJson<KBStats>(`/v1/kb/stats?client_id=${encodeURIComponent(clientId)}`);
}
