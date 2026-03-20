// ─── Assistant API Client ─────────────────────────────────────────────

const API_URL = import.meta.env.VITE_API_URL ?? '';

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('plinth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface KBSourceRef {
  document_id: string;
  filename: string;
  source_type: string;
  run_id?: string;
  date: string;
  relevance: number;
  snippet: string;
}

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  actions?: Array<{ type: string; result: unknown }>;
  kb_sources?: KBSourceRef[];
}

export interface Conversation {
  id: string;
  title: string;
  starred: boolean;
  created_at: string;
  updated_at: string;
  message_count: number;
  preview: string;
}

export interface ConversationDetail {
  id: string;
  title: string;
  starred: boolean;
  messages: AssistantMessage[];
  created_at: string;
  updated_at: string;
}

export interface ChatResponse {
  conversation_id: string;
  message: AssistantMessage;
  kb_sources?: KBSourceRef[];
}

export async function sendMessage(
  message: string,
  conversation_id?: string,
  context?: { run_id?: string; client_id?: string },
): Promise<ChatResponse> {
  const res = await fetch(`${API_URL}/v1/assistant/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ message, conversation_id, context }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Request failed' })) as { message?: string };
    throw new Error(err.message ?? `HTTP ${res.status}`);
  }
  const data = await res.json() as ChatResponse;
  // Merge top-level kb_sources into the message for convenience
  if (data.kb_sources && data.kb_sources.length > 0 && !data.message.kb_sources) {
    data.message.kb_sources = data.kb_sources;
  }
  return data;
}

export async function listConversations(): Promise<Conversation[]> {
  const res = await fetch(`${API_URL}/v1/assistant/conversations`, {
    headers: authHeaders(),
  });
  if (!res.ok) return [];
  const data = await res.json() as { conversations: Conversation[] };
  return data.conversations;
}

export async function getConversation(id: string): Promise<ConversationDetail> {
  const res = await fetch(`${API_URL}/v1/assistant/conversations/${id}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Conversation ${id} not found`);
  return res.json() as Promise<ConversationDetail>;
}

export async function renameConversation(id: string, title: string): Promise<void> {
  await fetch(`${API_URL}/v1/assistant/conversations/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ title }),
  });
}

export async function toggleStarConversation(id: string, starred: boolean): Promise<void> {
  await fetch(`${API_URL}/v1/assistant/conversations/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ starred }),
  });
}

export async function deleteConversation(id: string): Promise<void> {
  await fetch(`${API_URL}/v1/assistant/conversations/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
}

// ─── Upload and analyze a file through Plinth engines ─────────────────

export interface UploadAnalysisResult {
  filename: string;
  platform_detected: string;
  rows_parsed: number;
  engines_run: string[];
  billing?: {
    total_fee: number;
    recovery_fee: number;
    lift_fee: number;
    efficiency_fee: number;
  };
  summary_text: string;
}

export async function uploadAndAnalyzeFile(
  file: File,
  adSpend: number,
): Promise<UploadAnalysisResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('ad_spend', String(adSpend));

  const res = await fetch(`${API_URL}/v1/analyze/file`, {
    method: 'POST',
    headers: authHeaders(), // no Content-Type — browser sets multipart boundary
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Upload failed' })) as { message?: string };
    throw new Error(err.message ?? `HTTP ${res.status}`);
  }

  const data = await res.json() as Record<string, unknown>;

  // Normalize response into a display-friendly summary
  const billing = data['billing'] as Record<string, number> | undefined;
  const parsed = data['parsed'] as Record<string, unknown> | undefined;
  const engines = (data['engines'] as string[]) ?? [];

  return {
    filename: file.name,
    platform_detected: (data['platform'] as string) ?? (parsed?.['platform'] as string) ?? 'unknown',
    rows_parsed: (parsed?.['row_count'] as number) ?? 0,
    engines_run: engines,
    billing: billing
      ? {
          total_fee: (billing['total_fee'] ?? 0),
          recovery_fee: (billing['recovery_fee'] ?? 0),
          lift_fee: (billing['lift_fee'] ?? 0),
          efficiency_fee: (billing['efficiency_fee'] ?? 0),
        }
      : undefined,
    summary_text: JSON.stringify(data, null, 2).slice(0, 3000),
  };
}
