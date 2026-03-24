'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  artifacts?: VisualizationHint[];
}

export interface VisualizationHint {
  chart_type: string;
  title: string;
  data: unknown;
  options?: Record<string, unknown>;
}

interface UseChatOptions {
  api?: string;
  /** Pre-set the conversation ID (for loading existing conversations) */
  conversationId?: string;
}

interface UseChatReturn {
  messages: Message[];
  sendMessage: (text: string, conversationId?: string, brandContext?: string) => Promise<void>;
  isStreaming: boolean;
  conversationId: string | null;
  error: string | null;
  clearMessages: () => void;
  loadingHistory: boolean;
}

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  const lsToken = localStorage.getItem('plinth_token');
  if (lsToken) return lsToken;
  const match = document.cookie.match(/(?:^|;\s*)plinth_token=([^;]*)/);
  return match ? match[1] : null;
}

function generateId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Extracts visualization_hints JSON blocks from assistant content.
 * Looks for ```json blocks containing "visualization_hints" or
 * a top-level JSON array with chart_type fields.
 */
function extractArtifacts(content: string): VisualizationHint[] {
  const artifacts: VisualizationHint[] = [];
  const jsonBlockRegex = /```json\s*\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = jsonBlockRegex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.visualization_hints && Array.isArray(parsed.visualization_hints)) {
        artifacts.push(...parsed.visualization_hints);
      } else if (Array.isArray(parsed)) {
        const hints = parsed.filter(
          (item: Record<string, unknown>) => item && typeof item === 'object' && 'chart_type' in item
        );
        artifacts.push(...hints);
      } else if (parsed && typeof parsed === 'object' && 'chart_type' in parsed) {
        artifacts.push(parsed);
      }
    } catch {
      // Not valid JSON, skip
    }
  }

  return artifacts;
}

export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const { api = '/api/chat', conversationId: initialConvoId } = options;
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(initialConvoId ?? null);
  const [error, setError] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(!!initialConvoId);
  const abortRef = useRef<AbortController | null>(null);
  const loadedRef = useRef<string | null>(null);

  // Load existing conversation messages when conversationId is provided
  useEffect(() => {
    if (!initialConvoId || loadedRef.current === initialConvoId) return;
    loadedRef.current = initialConvoId;
    setConversationId(initialConvoId);

    const token = getAuthToken();
    if (!token) {
      setLoadingHistory(false);
      return;
    }

    (async () => {
      try {
        const res = await fetch(`/api/v1/assistant/conversations/${initialConvoId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          // Conversation might not exist yet, that's OK
          setLoadingHistory(false);
          return;
        }

        const data = await res.json();
        const rawMessages: Array<{ id?: string; role: string; content: string; timestamp?: string }> =
          data.messages ?? data.data?.messages ?? [];

        const loadedMessages: Message[] = rawMessages.map((m) => ({
          id: m.id ?? generateId(),
          role: m.role as 'user' | 'assistant',
          content: m.content,
          timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
          artifacts: m.role === 'assistant' ? extractArtifacts(m.content) : undefined,
        }));

        setMessages(loadedMessages);
      } catch {
        // Non-blocking: start with empty messages
      } finally {
        setLoadingHistory(false);
      }
    })();
  }, [initialConvoId]);

  const clearMessages = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setMessages([]);
    setConversationId(null);
    setError(null);
    setIsStreaming(false);
    loadedRef.current = null;
  }, []);

  const sendMessage = useCallback(
    async (text: string, convoId?: string, brandContext?: string) => {
      if (!text.trim()) return;

      const token = getAuthToken();
      if (!token) {
        setError('Not authenticated. Please log in.');
        return;
      }

      setError(null);

      // Append user message immediately
      const userMessage: Message = {
        id: generateId(),
        role: 'user',
        content: text.trim(),
        timestamp: new Date(),
      };

      // Create placeholder assistant message for streaming
      const assistantMessageId = generateId();
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsStreaming(true);

      // Abort any previous stream
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const activeConvoId = convoId ?? conversationId ?? undefined;

        const response = await fetch(api, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            message: text.trim(),
            conversationId: activeConvoId,
            brandContext,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errBody = await response.text();
          let errMsg: string;
          try {
            errMsg = JSON.parse(errBody).error || errBody;
          } catch {
            errMsg = errBody;
          }
          throw new Error(errMsg);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response stream available');
        }

        const decoder = new TextDecoder();
        let buffer = '';
        let accumulatedContent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (!data || data === '[DONE]') continue;

            try {
              const event = JSON.parse(data) as {
                type: 'text' | 'done' | 'error';
                text?: string;
                conversationId?: string;
                error?: string;
              };

              if (event.type === 'text' && event.text) {
                accumulatedContent += event.text;
                const currentContent = accumulatedContent;
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? { ...msg, content: currentContent, artifacts: extractArtifacts(currentContent) }
                      : msg
                  )
                );
              }

              if (event.type === 'done') {
                if (event.conversationId) {
                  setConversationId(event.conversationId);
                }
              }

              if (event.type === 'error') {
                throw new Error(event.error ?? 'Unknown streaming error');
              }
            } catch (parseError) {
              if (parseError instanceof Error) {
                // Re-throw actual streaming errors, skip JSON parse errors
                if (
                  parseError.message &&
                  !parseError.message.includes('JSON') &&
                  parseError.message !== 'Unexpected end of JSON input'
                ) {
                  throw parseError;
                }
              }
            }
          }
        }

        // Final artifact extraction after stream completes
        const finalContent = accumulatedContent;
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: finalContent, artifacts: extractArtifacts(finalContent) }
              : msg
          )
        );
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        const errorMsg = err instanceof Error ? err.message : 'An unexpected error occurred';
        setError(errorMsg);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: `Error: ${errorMsg}` }
              : msg
          )
        );
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [api, conversationId]
  );

  return {
    messages,
    sendMessage,
    isStreaming,
    conversationId,
    error,
    clearMessages,
    loadingHistory,
  };
}
