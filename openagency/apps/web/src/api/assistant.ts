// ─── Assistant API Client ─────────────────────────────────────────────

const API_URL = import.meta.env.VITE_API_URL ?? '';

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('plinth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  actions?: Array<{ type: string; result: unknown }>;
}

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  preview: string;
}

export interface ConversationDetail {
  id: string;
  title: string;
  messages: AssistantMessage[];
  created_at: string;
  updated_at: string;
}

export interface ChatResponse {
  conversation_id: string;
  message: AssistantMessage;
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
  return res.json() as Promise<ChatResponse>;
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

export async function deleteConversation(id: string): Promise<void> {
  await fetch(`${API_URL}/v1/assistant/conversations/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
}
