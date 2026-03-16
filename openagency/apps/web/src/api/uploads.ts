// ─── Upload API Client ───────────────────────────────────────────────

const API_URL = import.meta.env.VITE_API_URL ?? '';
const API_KEY = import.meta.env.VITE_API_KEY ?? '';

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = {};
  const token = localStorage.getItem('plinth_token');
  if (token) h['Authorization'] = `Bearer ${token}`;
  if (API_KEY) h['X-API-Key'] = API_KEY;
  return h;
}

// ─── Types ───────────────────────────────────────────────────────────

export interface UploadRecord {
  id: string;
  data_type: string;
  file_name: string;
  platform: string;
  format: string;
  row_count: number;
  columns: string[];
  uploaded_at: string;
}

export interface UploadResponse {
  format: string;
  platform: string;
  confidence: number;
  columns: string[];
  rows: number;
  data: Record<string, unknown>[];
  persisted: boolean;
  record_id?: string;
}

export interface UploadDetail {
  id: string;
  data_type: string;
  file_name: string;
  platform: string;
  format: string;
  row_count: number;
  columns: string[];
  data: Record<string, unknown>[];
  summary: Record<string, unknown>;
  uploaded_at: string;
}

// ─── API Functions ───────────────────────────────────────────────────

export async function uploadFile(
  file: File,
  clientId: string,
  dataType?: string,
): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('client_id', clientId);
  if (dataType) formData.append('data_type', dataType);

  const res = await fetch(`${API_URL}/v1/upload`, {
    method: 'POST',
    headers: authHeaders(), // no Content-Type — browser sets multipart boundary
    body: formData,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return res.json() as Promise<UploadResponse>;
}

export async function listUploads(clientId: string): Promise<UploadRecord[]> {
  const res = await fetch(`${API_URL}/v1/upload/client/${clientId}`, {
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
  });
  if (!res.ok) throw new Error(`Failed to list uploads: ${res.status}`);
  const data = await res.json();
  return data.records ?? data;
}

export async function getUpload(id: string): Promise<UploadDetail> {
  const res = await fetch(`${API_URL}/v1/upload/${id}`, {
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
  });
  if (!res.ok) throw new Error(`Failed to get upload: ${res.status}`);
  return res.json() as Promise<UploadDetail>;
}

export async function deleteUpload(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/v1/upload/${id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
  });
  if (!res.ok) throw new Error(`Failed to delete upload: ${res.status}`);
}

export async function updateColumnMap(
  id: string,
  columnMap: Record<string, string>,
): Promise<void> {
  const res = await fetch(`${API_URL}/v1/upload/${id}/column-map`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ column_map: columnMap }),
  });
  if (!res.ok) throw new Error(`Failed to update column map: ${res.status}`);
}
