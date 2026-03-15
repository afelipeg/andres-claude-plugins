// ─── Plinth Assistant Page ────────────────────────────────────────────
// Full-page conversational AI — Claude.ai layout adapted to Plinth tokens.
// Layout: dark conversation sidebar (zinc-950) + light chat area (zinc-50).

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plus,
  Send,
  Trash2,
  Bot,
  CheckCircle2,
  XCircle,
  Play,
  Loader2,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import {
  sendMessage,
  listConversations,
  getConversation,
  deleteConversation,
  type AssistantMessage,
  type Conversation,
} from '../api/assistant';
import { cn } from '../lib/utils';

// ─── Plinth accent colour ─────────────────────────────────────────────
const ACCENT = '#02c98d';

// ─── Inline markdown renderer ─────────────────────────────────────────
// Handles: **bold**, *italic*, `code`, ```block```, # headers, - lists

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? '';

    // Code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.startsWith('```')) {
        codeLines.push(lines[i]!);
        i++;
      }
      nodes.push(
        <pre
          key={i}
          className="my-2 overflow-x-auto rounded-lg bg-zinc-900 px-4 py-3 text-xs text-zinc-100 font-mono"
        >
          {lang && (
            <span className="mb-2 block text-[10px] font-medium uppercase tracking-widest text-zinc-500">
              {lang}
            </span>
          )}
          <code>{codeLines.join('\n')}</code>
        </pre>,
      );
      i++;
      continue;
    }

    // Heading
    if (line.startsWith('### ')) {
      nodes.push(
        <h3 key={i} className="mt-3 mb-1 text-sm font-semibold text-zinc-900">
          {inlineFormat(line.slice(4))}
        </h3>,
      );
    } else if (line.startsWith('## ')) {
      nodes.push(
        <h2 key={i} className="mt-4 mb-1 text-base font-semibold text-zinc-900">
          {inlineFormat(line.slice(3))}
        </h2>,
      );
    } else if (line.startsWith('# ')) {
      nodes.push(
        <h1 key={i} className="mt-4 mb-1 text-lg font-bold text-zinc-900">
          {inlineFormat(line.slice(2))}
        </h1>,
      );
    }
    // Bullet list
    else if (line.startsWith('- ') || line.startsWith('* ')) {
      const items: string[] = [line.slice(2)];
      let j = i + 1;
      while (j < lines.length && (lines[j]!.startsWith('- ') || lines[j]!.startsWith('* '))) {
        items.push(lines[j]!.slice(2));
        j++;
      }
      nodes.push(
        <ul key={i} className="my-1 ml-4 list-disc space-y-0.5">
          {items.map((item, k) => (
            <li key={k} className="text-sm text-zinc-700">
              {inlineFormat(item)}
            </li>
          ))}
        </ul>,
      );
      i = j;
      continue;
    }
    // Numbered list
    else if (/^\d+\. /.test(line)) {
      const items: string[] = [line.replace(/^\d+\. /, '')];
      let j = i + 1;
      while (j < lines.length && /^\d+\. /.test(lines[j]!)) {
        items.push(lines[j]!.replace(/^\d+\. /, ''));
        j++;
      }
      nodes.push(
        <ol key={i} className="my-1 ml-4 list-decimal space-y-0.5">
          {items.map((item, k) => (
            <li key={k} className="text-sm text-zinc-700">
              {inlineFormat(item)}
            </li>
          ))}
        </ol>,
      );
      i = j;
      continue;
    }
    // Horizontal rule
    else if (line.trim() === '---' || line.trim() === '***') {
      nodes.push(<hr key={i} className="my-3 border-zinc-200" />);
    }
    // Empty line → paragraph break
    else if (line.trim() === '') {
      nodes.push(<div key={i} className="h-2" />);
    }
    // Regular paragraph
    else {
      nodes.push(
        <p key={i} className="text-sm leading-relaxed text-zinc-700">
          {inlineFormat(line)}
        </p>,
      );
    }

    i++;
  }
  return nodes;
}

function inlineFormat(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  // Split by bold, italic, inline code
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let idx = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      parts.push(<span key={idx++}>{text.slice(last, m.index)}</span>);
    }
    const tok = m[0];
    if (tok.startsWith('**')) {
      parts.push(<strong key={idx++} className="font-semibold text-zinc-900">{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith('*')) {
      parts.push(<em key={idx++}>{tok.slice(1, -1)}</em>);
    } else if (tok.startsWith('`')) {
      parts.push(
        <code key={idx++} className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs text-zinc-800">
          {tok.slice(1, -1)}
        </code>,
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(<span key={idx++}>{text.slice(last)}</span>);
  return <>{parts}</>;
}

// ─── Action result card ───────────────────────────────────────────────

function ActionCard({ action }: { action: { type: string; result: unknown } }) {
  const res = action.result as Record<string, unknown>;
  const icons: Record<string, React.ReactNode> = {
    approve_run: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
    reject_run: <XCircle className="h-4 w-4 text-red-400" />,
    run_pipeline: <Play className="h-4 w-4" style={{ color: ACCENT }} />,
  };
  const labels: Record<string, string> = {
    approve_run: 'Run approved',
    reject_run: 'Run rejected',
    run_pipeline: 'Pipeline triggered',
  };

  return (
    <div className="mt-2 flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs">
      {icons[action.type] ?? <Sparkles className="h-4 w-4 text-zinc-400" />}
      <span className="font-medium text-zinc-700">{labels[action.type] ?? action.type}</span>
      {res['run_id'] != null && (
        <span className="font-mono text-zinc-400">{String(res['run_id']).slice(0, 8)}</span>
      )}
      {res['status'] != null && (
        <span
          className={cn(
            'ml-auto rounded-full px-2 py-0.5 font-semibold',
            res['status'] === 'approved' || res['status'] === 'triggered'
              ? 'bg-emerald-50 text-emerald-700'
              : res['status'] === 'rejected'
              ? 'bg-red-50 text-red-600'
              : 'bg-zinc-100 text-zinc-500',
          )}
        >
          {String(res['status'])}
        </span>
      )}
    </div>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: AssistantMessage & { pending?: boolean } }) {
  const isUser = msg.role === 'user';
  const pending = 'pending' in msg && msg.pending;

  if (isUser) {
    return (
      <div className="flex justify-end px-4 py-1">
        <div className="max-w-[70%] rounded-2xl rounded-tr-sm bg-zinc-900 px-4 py-2.5 text-sm text-white shadow-sm">
          {msg.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 px-4 py-2">
      {/* Plinth logo avatar */}
      <div
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${ACCENT}20`, color: ACCENT }}
      >
        <Bot className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        {pending ? (
          <div className="flex items-center gap-1.5 py-1">
            <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
            <span className="text-sm text-zinc-400">Plinth is thinking…</span>
          </div>
        ) : (
          <>
            <div className="prose-sm max-w-none">{renderMarkdown(msg.content)}</div>
            {msg.actions && msg.actions.length > 0 && (
              <div className="mt-2 space-y-1">
                {msg.actions.map((a, i) => (
                  <ActionCard key={i} action={a} />
                ))}
              </div>
            )}
            <p className="mt-1.5 text-[11px] text-zinc-400">
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Welcome screen ───────────────────────────────────────────────────

const SUGGESTIONS = [
  'What happened in the last pipeline run?',
  '¿Cómo se calcula el fee de Recovery?',
  'Show me the HFL decisions pending review',
  'Explain the Leak Detector findings',
  'Trigger a new pipeline run for ACME',
  'What is the current ROAS lift estimate?',
];

function WelcomeScreen({ onSuggest }: { onSuggest: (text: string) => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div
        className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl"
        style={{ backgroundColor: `${ACCENT}18`, color: ACCENT }}
      >
        <Bot className="h-7 w-7" />
      </div>
      <h2 className="mb-1 text-xl font-semibold text-zinc-900">Plinth Assistant</h2>
      <p className="mb-8 max-w-sm text-center text-sm text-zinc-500">
        Ask me about pipeline results, HFL decisions, billing, or any media strategy question.
      </p>
      <div className="grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onSuggest(s)}
            className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left text-sm text-zinc-700 shadow-sm transition-colors hover:border-zinc-300 hover:bg-zinc-50"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Conversation sidebar item ─────────────────────────────────────────

function ConvItem({
  conv,
  active,
  onSelect,
  onDelete,
}: {
  conv: Conversation;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const [showDel, setShowDel] = useState(false);

  return (
    <div
      className={cn(
        'group relative flex cursor-pointer items-start gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors',
        active ? 'bg-white/[0.08] text-white' : 'text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-200',
      )}
      onClick={onSelect}
      onMouseEnter={() => setShowDel(true)}
      onMouseLeave={() => setShowDel(false)}
    >
      <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 opacity-60" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium leading-snug">{conv.title}</p>
        {conv.preview && (
          <p className="mt-0.5 truncate text-xs opacity-50">{conv.preview}</p>
        )}
      </div>
      {showDel && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="shrink-0 rounded p-0.5 text-zinc-500 hover:text-red-400 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// ─── Main page component ──────────────────────────────────────────────

const PENDING_ID = '__pending__';

export function AssistantPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<(AssistantMessage & { pending?: boolean })[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingConv, setLoadingConv] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load conversation list on mount
  useEffect(() => {
    void listConversations().then(setConversations).catch(() => {});
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [input]);

  const loadConversation = useCallback(async (id: string) => {
    setLoadingConv(true);
    setActiveId(id);
    try {
      const conv = await getConversation(id);
      setMessages(conv.messages);
    } catch {
      setMessages([]);
    } finally {
      setLoadingConv(false);
    }
  }, []);

  const startNewConversation = useCallback(() => {
    setActiveId(null);
    setMessages([]);
    setInput('');
    textareaRef.current?.focus();
  }, []);

  const handleDeleteConv = useCallback(
    async (id: string) => {
      await deleteConversation(id).catch(() => {});
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeId === id) startNewConversation();
    },
    [activeId, startNewConversation],
  );

  const handleSend = useCallback(
    async (text?: string) => {
      const msg = (text ?? input).trim();
      if (!msg || sending) return;

      setInput('');
      setSending(true);

      // Optimistic user message
      const userMsg: AssistantMessage = {
        id: `u_${Date.now()}`,
        role: 'user',
        content: msg,
        timestamp: new Date().toISOString(),
      };
      // Pending assistant placeholder
      const pendingMsg: AssistantMessage & { pending: boolean } = {
        id: PENDING_ID,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        pending: true,
      };
      setMessages((prev) => [...prev, userMsg, pendingMsg]);

      try {
        const res = await sendMessage(msg, activeId ?? undefined);

        // Replace pending placeholder with real response
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== PENDING_ID),
          res.message,
        ]);

        // Update active conversation
        if (!activeId) {
          setActiveId(res.conversation_id);
          // Refresh conversation list
          void listConversations().then(setConversations).catch(() => {});
        } else {
          // Update preview in sidebar
          setConversations((prev) =>
            prev.map((c) =>
              c.id === res.conversation_id
                ? { ...c, updated_at: res.message.timestamp, message_count: c.message_count + 2 }
                : c,
            ),
          );
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Failed to get response';
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== PENDING_ID),
          {
            id: `err_${Date.now()}`,
            role: 'assistant',
            content: `⚠️ ${errMsg}`,
            timestamp: new Date().toISOString(),
          },
        ]);
      } finally {
        setSending(false);
        textareaRef.current?.focus();
      }
    },
    [input, sending, activeId],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  // Group conversations by date
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  const groups: { label: string; items: Conversation[] }[] = [];
  const todayItems = conversations.filter(
    (c) => new Date(c.updated_at).toDateString() === today,
  );
  const yesterdayItems = conversations.filter(
    (c) => new Date(c.updated_at).toDateString() === yesterday,
  );
  const olderItems = conversations.filter(
    (c) =>
      new Date(c.updated_at).toDateString() !== today &&
      new Date(c.updated_at).toDateString() !== yesterday,
  );
  if (todayItems.length) groups.push({ label: 'Today', items: todayItems });
  if (yesterdayItems.length) groups.push({ label: 'Yesterday', items: yesterdayItems });
  if (olderItems.length) groups.push({ label: 'Older', items: olderItems });

  return (
    // Escape the Layout's p-6 and overflow-y-auto — this page manages its own layout
    <div className="-m-6 flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* ── Conversation sidebar ─────────────────────────────────────── */}
      <aside className="flex w-64 shrink-0 flex-col border-r border-white/[0.06] bg-zinc-950">
        {/* New chat button */}
        <div className="shrink-0 p-3">
          <button
            onClick={startNewConversation}
            className="flex w-full items-center gap-2 rounded-lg border border-white/[0.10] px-3 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <Plus className="h-4 w-4" />
            New conversation
          </button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto px-2 py-1">
          {groups.length === 0 && (
            <p className="px-3 py-4 text-xs text-zinc-600">No conversations yet</p>
          )}
          {groups.map((group) => (
            <div key={group.label} className="mb-3">
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
                {group.label}
              </p>
              {group.items.map((conv) => (
                <ConvItem
                  key={conv.id}
                  conv={conv}
                  active={conv.id === activeId}
                  onSelect={() => void loadConversation(conv.id)}
                  onDelete={() => void handleDeleteConv(conv.id)}
                />
              ))}
            </div>
          ))}
        </div>

        {/* Footer label */}
        <div className="shrink-0 border-t border-white/[0.06] px-4 py-3">
          <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-600">
            Plinth Assistant
          </p>
          <p className="text-[10px] text-zinc-700">Powered by Claude Sonnet</p>
        </div>
      </aside>

      {/* ── Chat area ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col bg-zinc-50">
        {/* Chat header */}
        <div className="flex h-12 shrink-0 items-center border-b border-zinc-200 bg-white px-5">
          <div
            className="mr-2 h-2 w-2 rounded-full"
            style={{ backgroundColor: ACCENT }}
          />
          <span className="text-sm font-medium text-zinc-700">
            {activeId
              ? (conversations.find((c) => c.id === activeId)?.title ?? 'Conversation')
              : 'New conversation'}
          </span>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto py-4">
          {loadingConv ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-300" />
            </div>
          ) : messages.length === 0 ? (
            <WelcomeScreen onSuggest={(s) => void handleSend(s)} />
          ) : (
            <div className="mx-auto max-w-2xl space-y-1 pb-4">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} />
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Input bar — Claude.ai style */}
        <div className="shrink-0 border-t border-zinc-200 bg-white px-4 py-3">
          <div className="mx-auto max-w-2xl">
            <div className="relative flex items-end gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm transition-shadow focus-within:border-zinc-300 focus-within:shadow-md">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about pipeline results, approve runs, generate reports…"
                rows={1}
                disabled={sending}
                className="flex-1 resize-none bg-transparent text-sm text-zinc-800 placeholder:text-zinc-400 focus:outline-none disabled:opacity-60"
                style={{ lineHeight: '1.5', maxHeight: 180 }}
              />
              <button
                onClick={() => void handleSend()}
                disabled={!input.trim() || sending}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white transition-all disabled:opacity-40"
                style={{
                  backgroundColor: input.trim() && !sending ? ACCENT : '#d1d5db',
                }}
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="mt-1.5 text-center text-[11px] text-zinc-400">
              Press <kbd className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[10px]">Enter</kbd> to send
              · <kbd className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[10px]">Shift+Enter</kbd> for new line
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
