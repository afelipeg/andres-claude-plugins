// ─── Plinth Assistant Page ────────────────────────────────────────────
// Chat area with slash command palette + file upload.
// Conversation sidebar lives in Layout.tsx.

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Send, Bot, CheckCircle2, XCircle, Play, Loader2, Sparkles,
  Paperclip, HelpCircle, FileText, Activity, X, BarChart2,
} from 'lucide-react';
import {
  sendMessage,
  getConversation,
  uploadAndAnalyzeFile,
  type AssistantMessage,
} from '../api/assistant';
import { cn } from '../lib/utils';

const ACCENT = '#02c98d';
const PENDING_ID = '__pending__';

// ─── Slash commands ───────────────────────────────────────────────────

interface SlashCommand {
  cmd: string;
  label: string;
  description: string;
  Icon: React.ComponentType<{ className?: string }>;
  message: string | null; // null = special action
  action?: 'UPLOAD';
}

const SLASH_COMMANDS: SlashCommand[] = [
  {
    cmd: '/run',
    label: 'Trigger pipeline run',
    description: 'Start full-optimization for all 4 engines',
    Icon: Play,
    message: 'Run a new full-optimization pipeline run',
  },
  {
    cmd: '/status',
    label: 'Pipeline status',
    description: 'Show latest run and HFL decisions',
    Icon: Activity,
    message: 'Show the current pipeline status and any pending HFL decisions',
  },
  {
    cmd: '/approve',
    label: 'Approve latest run',
    description: 'Approve the most recent pending HFL decision',
    Icon: CheckCircle2,
    message: 'Approve the latest pending pipeline run',
  },
  {
    cmd: '/reject',
    label: 'Reject latest run',
    description: 'Reject the most recent pending HFL decision',
    Icon: XCircle,
    message: 'Reject the latest pending pipeline run',
  },
  {
    cmd: '/report pdf',
    label: 'Generate PDF report',
    description: 'Executive summary as PDF via Delivery Engine',
    Icon: FileText,
    message: 'Generate a PDF executive summary report of the latest pipeline results',
  },
  {
    cmd: '/report excel',
    label: 'Generate Excel export',
    description: 'Full data export as Excel workbook',
    Icon: BarChart2,
    message: 'Generate an Excel export of the latest pipeline results with all metrics',
  },
  {
    cmd: '/report ppt',
    label: 'Generate PowerPoint deck',
    description: 'Board-ready presentation via Delivery Engine',
    Icon: FileText,
    message: 'Generate a PowerPoint presentation of the latest pipeline results for executive review',
  },
  {
    cmd: '/upload',
    label: 'Upload & analyze file',
    description: 'CSV, Excel, PDF or DOCX campaign data',
    Icon: Paperclip,
    message: null,
    action: 'UPLOAD',
  },
  {
    cmd: '/help',
    label: 'Show capabilities',
    description: 'List all commands and what I can do',
    Icon: HelpCircle,
    message: 'What can you help me with? List all your capabilities, available commands, and the Plinth engines you can interact with.',
  },
];

// ─── Inline markdown renderer ─────────────────────────────────────────

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? '';

    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.startsWith('```')) { codeLines.push(lines[i]!); i++; }
      nodes.push(
        <pre key={`code-${i}`} className="my-2 overflow-x-auto rounded-lg bg-zinc-900 px-4 py-3 text-xs text-zinc-100 font-mono">
          {lang && <span className="mb-2 block text-[10px] font-medium uppercase tracking-widest text-zinc-500">{lang}</span>}
          <code>{codeLines.join('\n')}</code>
        </pre>,
      );
      i++;
      continue;
    }

    if (line.startsWith('|') && line.endsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i]!.startsWith('|') && lines[i]!.endsWith('|')) {
        const cells = lines[i]!.split('|').slice(1, -1).map((c) => c.trim());
        if (!cells.every((c) => /^[-:]+$/.test(c))) rows.push(cells);
        i++;
      }
      if (rows.length > 0) {
        nodes.push(
          <div key={`tbl-${i}`} className="my-2 overflow-x-auto rounded-lg border border-zinc-200">
            <table className="w-full text-xs">
              <thead className="bg-zinc-50">
                <tr>{rows[0]!.map((h, k) => <th key={k} className="px-3 py-2 text-left font-semibold text-zinc-700">{inlineFormat(h)}</th>)}</tr>
              </thead>
              <tbody>
                {rows.slice(1).map((row, ri) => (
                  <tr key={ri} className="border-t border-zinc-100">
                    {row.map((cell, ci) => <td key={ci} className="px-3 py-2 text-zinc-600">{inlineFormat(cell)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>,
        );
      }
      continue;
    }

    if (line.startsWith('### ')) nodes.push(<h3 key={`h3-${i}`} className="mt-3 mb-1 text-sm font-semibold text-zinc-900">{inlineFormat(line.slice(4))}</h3>);
    else if (line.startsWith('## ')) nodes.push(<h2 key={`h2-${i}`} className="mt-4 mb-1 text-base font-semibold text-zinc-900">{inlineFormat(line.slice(3))}</h2>);
    else if (line.startsWith('# ')) nodes.push(<h1 key={`h1-${i}`} className="mt-4 mb-1 text-lg font-bold text-zinc-900">{inlineFormat(line.slice(2))}</h1>);
    else if (line.startsWith('- ') || line.startsWith('* ')) {
      const items: string[] = [line.slice(2)];
      let j = i + 1;
      while (j < lines.length && (lines[j]!.startsWith('- ') || lines[j]!.startsWith('* '))) { items.push(lines[j]!.slice(2)); j++; }
      nodes.push(<ul key={`ul-${i}`} className="my-1 ml-4 list-disc space-y-0.5">{items.map((it, k) => <li key={k} className="text-sm text-zinc-700">{inlineFormat(it)}</li>)}</ul>);
      i = j; continue;
    } else if (/^\d+\. /.test(line)) {
      const items: string[] = [line.replace(/^\d+\. /, '')];
      let j = i + 1;
      while (j < lines.length && /^\d+\. /.test(lines[j]!)) { items.push(lines[j]!.replace(/^\d+\. /, '')); j++; }
      nodes.push(<ol key={`ol-${i}`} className="my-1 ml-4 list-decimal space-y-0.5">{items.map((it, k) => <li key={k} className="text-sm text-zinc-700">{inlineFormat(it)}</li>)}</ol>);
      i = j; continue;
    } else if (line.trim() === '---') nodes.push(<hr key={`hr-${i}`} className="my-3 border-zinc-200" />);
    else if (line.trim() === '') nodes.push(<div key={`br-${i}`} className="h-2" />);
    else nodes.push(<p key={`p-${i}`} className="text-sm leading-relaxed text-zinc-700">{inlineFormat(line)}</p>);
    i++;
  }
  return nodes;
}

function inlineFormat(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0; let m: RegExpExecArray | null; let idx = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(<span key={idx++}>{text.slice(last, m.index)}</span>);
    const tok = m[0]!;
    if (tok.startsWith('**')) parts.push(<strong key={idx++} className="font-semibold text-zinc-900">{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith('*')) parts.push(<em key={idx++}>{tok.slice(1, -1)}</em>);
    else parts.push(<code key={idx++} className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-xs text-zinc-800">{tok.slice(1, -1)}</code>);
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
    get_pipeline_status: <Activity className="h-4 w-4 text-zinc-400" />,
    generate_report: <FileText className="h-4 w-4 text-blue-500" />,
  };
  const labels: Record<string, string> = {
    approve_run: 'Run approved',
    reject_run: 'Run rejected',
    run_pipeline: 'Pipeline triggered',
    get_pipeline_status: 'Status retrieved',
    generate_report: 'Report queued',
  };
  return (
    <div className="mt-2 flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs">
      {icons[action.type] ?? <Sparkles className="h-4 w-4 text-zinc-400" />}
      <span className="font-medium text-zinc-700">{labels[action.type] ?? action.type}</span>
      {res['run_id'] != null && <span className="font-mono text-zinc-400">{String(res['run_id']).slice(0, 8)}</span>}
      {res['status'] != null && (
        <span className={cn('ml-auto rounded-full px-2 py-0.5 font-semibold',
          res['status'] === 'approved' || res['status'] === 'triggered' ? 'bg-emerald-50 text-emerald-700'
          : res['status'] === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-zinc-100 text-zinc-500'
        )}>
          {String(res['status'])}
        </span>
      )}
    </div>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: AssistantMessage & { pending?: boolean; fileCard?: string } }) {
  const pending = 'pending' in msg && msg.pending;
  const fileCard = 'fileCard' in msg ? (msg.fileCard as string | undefined) : undefined;

  if (msg.role === 'user') {
    return (
      <div className="flex justify-end px-4 py-1">
        <div className="max-w-[70%] rounded-2xl rounded-tr-sm bg-zinc-900 px-4 py-2.5 text-sm text-white shadow-sm">
          {fileCard ? (
            <div className="flex items-center gap-2">
              <Paperclip className="h-4 w-4 text-zinc-400 shrink-0" />
              <span>{fileCard}</span>
            </div>
          ) : msg.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 px-4 py-2">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${ACCENT}20`, color: ACCENT }}>
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
                {msg.actions.map((a, i) => <ActionCard key={i} action={a} />)}
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
  'Show me pending HFL decisions',
  'Explain the Leak Detector waste findings',
  '/run',
  '/report pdf',
];

function WelcomeScreen({ onSuggest }: { onSuggest: (text: string) => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: `${ACCENT}18`, color: ACCENT }}>
        <Bot className="h-7 w-7" />
      </div>
      <h2 className="mb-1 text-xl font-semibold text-zinc-900">Plinth Assistant</h2>
      <p className="mb-2 max-w-sm text-center text-sm text-zinc-500">
        Ask about pipeline results, approve runs, or generate reports.
      </p>
      <p className="mb-8 text-xs text-zinc-400">
        Type <kbd className="rounded bg-zinc-100 px-1 font-mono">/</kbd> for commands
      </p>
      <div className="grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map((s) => (
          <button key={s} onClick={() => onSuggest(s)}
            className={cn(
              'rounded-xl border px-4 py-3 text-left text-sm shadow-sm transition-colors',
              s.startsWith('/')
                ? 'border-[#02c98d]/30 bg-[#02c98d]/5 font-mono text-zinc-700 hover:bg-[#02c98d]/10'
                : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50',
            )}>
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────

type ExtendedMessage = AssistantMessage & { pending?: boolean; fileCard?: string };

export function AssistantPage() {
  const { id: urlId } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  const [messages, setMessages] = useState<ExtendedMessage[]>([]);
  const [activeId, setActiveId] = useState<string | null>(urlId ?? null);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  // Slash command palette
  const [slashIdx, setSlashIdx] = useState(0);

  // File upload mode
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [adSpendInput, setAdSpendInput] = useState('');
  const [uploading, setUploading] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const adSpendRef = useRef<HTMLInputElement>(null);

  // ── Slash command filtering ──────────────────────────────────────────
  const showPalette = input.startsWith('/') && !pendingFile;
  const slashFilter = input.slice(1).toLowerCase();
  const filteredCommands = useMemo(
    () => SLASH_COMMANDS.filter((c) => c.cmd.slice(1).includes(slashFilter) || c.label.toLowerCase().includes(slashFilter)),
    [slashFilter],
  );

  // Reset selection when filter changes
  useEffect(() => { setSlashIdx(0); }, [slashFilter]);

  // Focus ad spend input when file is attached
  useEffect(() => {
    if (pendingFile) setTimeout(() => adSpendRef.current?.focus(), 50);
  }, [pendingFile]);

  // Load conversation when URL param changes
  useEffect(() => {
    const id = urlId ?? null;
    setActiveId(id);
    if (!id) { setMessages([]); return; }
    setLoading(true);
    void getConversation(id)
      .then((conv) => setMessages(conv.messages))
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
  }, [urlId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [input]);

  // ── Command selection ────────────────────────────────────────────────
  const selectCommand = useCallback((cmd: SlashCommand) => {
    if (cmd.action === 'UPLOAD') {
      setInput('');
      fileInputRef.current?.click();
      return;
    }
    if (cmd.message) {
      setInput(cmd.message);
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }, []);

  // ── Send message ─────────────────────────────────────────────────────
  const handleSend = useCallback(
    async (text?: string) => {
      const msg = (text ?? input).trim();
      if (!msg || sending) return;
      setInput('');
      setSending(true);

      const userMsg: ExtendedMessage = { id: `u_${Date.now()}`, role: 'user', content: msg, timestamp: new Date().toISOString() };
      const pendingMsg: ExtendedMessage = { id: PENDING_ID, role: 'assistant', content: '', timestamp: new Date().toISOString(), pending: true };
      setMessages((prev) => [...prev, userMsg, pendingMsg]);

      try {
        const res = await sendMessage(msg, activeId ?? undefined);
        setMessages((prev) => [...prev.filter((m) => m.id !== PENDING_ID), res.message]);
        if (!activeId) {
          setActiveId(res.conversation_id);
          navigate(`/app/assistant/${res.conversation_id}`, { replace: true });
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Failed to get response';
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== PENDING_ID),
          { id: `err_${Date.now()}`, role: 'assistant', content: `⚠️ ${errMsg}`, timestamp: new Date().toISOString() },
        ]);
      } finally {
        setSending(false);
        textareaRef.current?.focus();
      }
    },
    [input, sending, activeId, navigate],
  );

  // ── File upload ──────────────────────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setAdSpendInput('');
    e.target.value = ''; // reset so same file can be re-selected
  };

  const handleFileAnalyze = useCallback(async () => {
    if (!pendingFile || uploading) return;
    const adSpend = parseFloat(adSpendInput.replace(/[^0-9.]/g, ''));
    if (!adSpend || adSpend <= 0) {
      adSpendRef.current?.focus();
      return;
    }

    setUploading(true);

    // Show file attachment as user message
    const fileUserMsg: ExtendedMessage = {
      id: `file_${Date.now()}`,
      role: 'user',
      content: `Uploading ${pendingFile.name}…`,
      timestamp: new Date().toISOString(),
      fileCard: pendingFile.name,
    };
    const loadingMsg: ExtendedMessage = { id: PENDING_ID, role: 'assistant', content: '', timestamp: new Date().toISOString(), pending: true };
    setMessages((prev) => [...prev, fileUserMsg, loadingMsg]);
    setPendingFile(null);
    setAdSpendInput('');

    try {
      const result = await uploadAndAnalyzeFile(pendingFile, adSpend);
      // Send analysis results to assistant for interpretation
      const summaryPrompt = `I uploaded the file **${result.filename}** for analysis.

**Platform detected:** ${result.platform_detected}
**Rows parsed:** ${result.rows_parsed}
**Engines run:** ${result.engines_run.join(', ') || 'N/A'}
${result.billing ? `**Fees:** Recovery $${result.billing.recovery_fee.toLocaleString()} | Lift $${result.billing.lift_fee.toLocaleString()} | Total $${result.billing.total_fee.toLocaleString()}` : ''}

Raw analysis data:
\`\`\`json
${result.summary_text}
\`\`\`

Please provide a clear briefing of these results: waste found, optimization recommendations, billing breakdown, and next steps.`;

      setSending(true);
      const res = await sendMessage(summaryPrompt, activeId ?? undefined);
      setMessages((prev) => [...prev.filter((m) => m.id !== PENDING_ID), res.message]);

      if (!activeId) {
        setActiveId(res.conversation_id);
        navigate(`/app/assistant/${res.conversation_id}`, { replace: true });
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Upload or analysis failed';
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== PENDING_ID),
        { id: `err_${Date.now()}`, role: 'assistant', content: `⚠️ ${errMsg}`, timestamp: new Date().toISOString() },
      ]);
    } finally {
      setUploading(false);
      setSending(false);
      textareaRef.current?.focus();
    }
  }, [pendingFile, adSpendInput, uploading, activeId, navigate]);

  // ── Keyboard handling ────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showPalette && filteredCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashIdx((i) => (i + 1) % filteredCommands.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashIdx((i) => (i - 1 + filteredCommands.length) % filteredCommands.length);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = filteredCommands[slashIdx];
        if (cmd) selectCommand(cmd);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setInput('');
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleAdSpendKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); void handleFileAnalyze(); }
    if (e.key === 'Escape') { e.preventDefault(); setPendingFile(null); textareaRef.current?.focus(); }
  };

  return (
    <div className="flex h-full flex-col bg-zinc-50">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx,.xls,.pdf,.docx"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-300" />
          </div>
        ) : messages.length === 0 ? (
          <WelcomeScreen onSuggest={(s) => {
            if (s.startsWith('/') && SLASH_COMMANDS.find(c => c.action === 'UPLOAD' && c.cmd === s)) {
              fileInputRef.current?.click();
            } else if (s.startsWith('/')) {
              const cmd = SLASH_COMMANDS.find(c => c.cmd === s);
              if (cmd?.message) void handleSend(cmd.message);
              else setInput(s);
            } else {
              void handleSend(s);
            }
          }} />
        ) : (
          <div className="mx-auto max-w-2xl space-y-1 pb-4">
            {messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="shrink-0 border-t border-zinc-200 bg-white px-4 py-3">
        <div className="mx-auto max-w-2xl">

          {/* ── File mode: attach + ad spend ── */}
          {pendingFile && (
            <div className="mb-2 flex items-center gap-2 rounded-xl border border-[#02c98d]/30 bg-[#02c98d]/5 px-3 py-2.5">
              <Paperclip className="h-4 w-4 shrink-0" style={{ color: ACCENT }} />
              <span className="flex-1 truncate text-sm font-medium text-zinc-700">{pendingFile.name}</span>
              <span className="text-xs text-zinc-500">Ad spend $</span>
              <input
                ref={adSpendRef}
                type="text"
                value={adSpendInput}
                onChange={(e) => setAdSpendInput(e.target.value)}
                onKeyDown={handleAdSpendKeyDown}
                placeholder="2400000"
                className="w-28 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-800 focus:border-zinc-400 focus:outline-none"
              />
              <button
                onClick={() => void handleFileAnalyze()}
                disabled={uploading || !adSpendInput.trim()}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                style={{ backgroundColor: ACCENT }}
              >
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Analyze'}
              </button>
              <button onClick={() => setPendingFile(null)} className="text-zinc-400 hover:text-zinc-600">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* ── Slash command palette ── */}
          {showPalette && filteredCommands.length > 0 && (
            <div className="mb-2 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg">
              <div className="border-b border-zinc-100 px-3 py-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400">Commands</span>
              </div>
              {filteredCommands.map((cmd, i) => (
                <button
                  key={cmd.cmd}
                  onClick={() => selectCommand(cmd)}
                  className={cn(
                    'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors',
                    i === slashIdx ? 'bg-zinc-50' : 'hover:bg-zinc-50',
                  )}
                >
                  <cmd.Icon className={cn('h-4 w-4 shrink-0', i === slashIdx ? 'text-[#02c98d]' : 'text-zinc-400')} />
                  <div className="flex-1 min-w-0">
                    <span className="font-mono text-xs text-zinc-500">{cmd.cmd}</span>
                    <span className="ml-2 text-sm text-zinc-800">{cmd.label}</span>
                  </div>
                  <span className="text-xs text-zinc-400 truncate">{cmd.description}</span>
                </button>
              ))}
              <div className="border-t border-zinc-100 px-3 py-1">
                <span className="text-[10px] text-zinc-400">↑↓ navigate · Enter select · Esc close</span>
              </div>
            </div>
          )}

          {/* ── Main input ── */}
          <div className="relative flex items-end gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm transition-shadow focus-within:border-zinc-300 focus-within:shadow-md">
            {/* Paperclip */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mb-0.5 shrink-0 rounded-lg p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600"
              title="Upload file for analysis"
              type="button"
            >
              <Paperclip className="h-4 w-4" />
            </button>

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything… or type / for commands"
              rows={1}
              disabled={sending || uploading}
              className="flex-1 resize-none bg-transparent text-sm text-zinc-800 placeholder:text-zinc-400 focus:outline-none disabled:opacity-60"
              style={{ lineHeight: '1.5', maxHeight: 180 }}
            />
            <button
              onClick={() => void handleSend()}
              disabled={!input.trim() || sending || uploading}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white transition-all disabled:opacity-40"
              style={{ backgroundColor: input.trim() && !sending ? ACCENT : '#d1d5db' }}
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>

          <p className="mt-1.5 text-center text-[11px] text-zinc-400">
            <kbd className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[10px]">Enter</kbd> send ·{' '}
            <kbd className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[10px]">Shift+Enter</kbd> new line ·{' '}
            <kbd className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[10px}">/</kbd> commands
          </p>
        </div>
      </div>
    </div>
  );
}
