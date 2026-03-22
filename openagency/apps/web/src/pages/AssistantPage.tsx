// ─── Plinth Assistant Page ─────────────────────────────────────────────
// Minimal AI interface. Chat + slash commands + file upload.
// Conversation sidebar lives in Layout.tsx.

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Send, CheckCircle2, XCircle, Play, Loader2, Sparkles,
  Paperclip, HelpCircle, FileText, Activity, X, BarChart2,
} from 'lucide-react';
import {
  sendMessage,
  getConversation,
  uploadAndAnalyzeFile,
  type AssistantMessage,
  type KBSourceRef,
} from '../api/assistant';
import { KBSourcesPill } from '../components/KBSourcesPill';
import { cn } from '../lib/utils';

const ACCENT = '#00F5FF';
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
        <pre key={`code-${i}`} className="my-3 overflow-x-auto rounded border border-white/[0.06] bg-[#050508] px-4 py-3 text-xs font-mono leading-relaxed text-[#00F5FF]/70">
          {lang && <span className="mb-2 block text-[9px] font-medium uppercase tracking-[0.2em] text-white/20">{lang}</span>}
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
          <div key={`tbl-${i}`} className="my-3 overflow-x-auto rounded border border-white/[0.06]">
            <table className="w-full text-xs font-mono">
              <thead className="bg-white/[0.03]">
                <tr>{rows[0]!.map((h, k) => <th key={k} className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-white/50">{inlineFormat(h)}</th>)}</tr>
              </thead>
              <tbody>
                {rows.slice(1).map((row, ri) => (
                  <tr key={ri} className="border-t border-white/[0.04]">
                    {row.map((cell, ci) => <td key={ci} className="px-3 py-2 text-white/50">{inlineFormat(cell)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>,
        );
      }
      continue;
    }

    if (line.startsWith('### ')) nodes.push(<h3 key={`h3-${i}`} className="mt-4 mb-1 text-xs font-medium uppercase tracking-[0.15em] text-white/80">{inlineFormat(line.slice(4))}</h3>);
    else if (line.startsWith('## ')) nodes.push(<h2 key={`h2-${i}`} className="mt-5 mb-1 text-sm font-medium uppercase tracking-wider text-white/90">{inlineFormat(line.slice(3))}</h2>);
    else if (line.startsWith('# ')) nodes.push(<h1 key={`h1-${i}`} className="mt-5 mb-2 text-base font-semibold uppercase tracking-wider text-white/95">{inlineFormat(line.slice(2))}</h1>);
    else if (line.startsWith('- ') || line.startsWith('* ')) {
      const items: string[] = [line.slice(2)];
      let j = i + 1;
      while (j < lines.length && (lines[j]!.startsWith('- ') || lines[j]!.startsWith('* '))) { items.push(lines[j]!.slice(2)); j++; }
      nodes.push(<ul key={`ul-${i}`} className="my-1.5 ml-4 list-disc space-y-0.5">{items.map((it, k) => <li key={k} className="text-sm text-white/55 leading-relaxed">{inlineFormat(it)}</li>)}</ul>);
      i = j; continue;
    } else if (/^\d+\. /.test(line)) {
      const items: string[] = [line.replace(/^\d+\. /, '')];
      let j = i + 1;
      while (j < lines.length && /^\d+\. /.test(lines[j]!)) { items.push(lines[j]!.replace(/^\d+\. /, '')); j++; }
      nodes.push(<ol key={`ol-${i}`} className="my-1.5 ml-4 list-decimal space-y-0.5">{items.map((it, k) => <li key={k} className="text-sm text-white/55 leading-relaxed">{inlineFormat(it)}</li>)}</ol>);
      i = j; continue;
    } else if (line.trim() === '---') nodes.push(<hr key={`hr-${i}`} className="my-4 border-white/[0.06]" />);
    else if (line.trim() === '') nodes.push(<div key={`br-${i}`} className="h-2" />);
    else nodes.push(<p key={`p-${i}`} className="text-sm leading-relaxed text-white/60">{inlineFormat(line)}</p>);
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
    if (tok.startsWith('**')) parts.push(<strong key={idx++} className="font-semibold text-white/90">{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith('*')) parts.push(<em key={idx++}>{tok.slice(1, -1)}</em>);
    else parts.push(<code key={idx++} className="rounded bg-[#050508] border border-white/[0.06] px-1 py-0.5 font-mono text-xs text-[#00F5FF]/70">{tok.slice(1, -1)}</code>);
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(<span key={idx++}>{text.slice(last)}</span>);
  return <>{parts}</>;
}

// ─── Action result card ───────────────────────────────────────────────

function ActionCard({ action }: { action: { type: string; result: unknown } }) {
  const res = action.result as Record<string, unknown>;
  const icons: Record<string, React.ReactNode> = {
    approve_run: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />,
    reject_run: <XCircle className="h-3.5 w-3.5 text-red-400" />,
    run_pipeline: <Play className="h-3.5 w-3.5" style={{ color: ACCENT }} />,
    get_pipeline_status: <Activity className="h-3.5 w-3.5 text-white/30" />,
    generate_report: <FileText className="h-3.5 w-3.5 text-[#7000FF]" />,
  };
  const labels: Record<string, string> = {
    approve_run: 'PROTOCOL_APPROVED',
    reject_run: 'PROTOCOL_REJECTED',
    run_pipeline: 'PIPELINE_INITIATED',
    get_pipeline_status: 'STATUS_RETRIEVED',
    generate_report: 'REPORT_QUEUED',
  };
  return (
    <div className="mt-2 flex items-center gap-3 rounded border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm px-3 py-2.5 text-xs font-mono">
      {icons[action.type] ?? <Sparkles className="h-3.5 w-3.5 text-white/30" />}
      <span className="uppercase tracking-wider text-white/50">{labels[action.type] ?? action.type}</span>
      {res['run_id'] != null && <span className="text-white/20">{String(res['run_id']).slice(0, 8)}</span>}
      {res['status'] != null && (
        <span className={cn('ml-auto rounded border px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium',
          res['status'] === 'approved' || res['status'] === 'triggered' ? 'bg-emerald-500/10 border-emerald-400/20 text-emerald-400'
          : res['status'] === 'rejected' ? 'bg-red-500/10 border-red-400/20 text-red-400' : 'bg-white/5 border-white/10 text-white/40'
        )}>
          {String(res['status'])}
        </span>
      )}
    </div>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: ExtendedMessage }) {
  const pending = 'pending' in msg && msg.pending;
  const fileCard = 'fileCard' in msg ? (msg.fileCard as string | undefined) : undefined;

  if (msg.role === 'user') {
    return (
      <div className="flex justify-end px-4 py-2">
        <div className="max-w-[70%] border-r-2 border-[#00F5FF]/30 pr-4 py-1">
          {fileCard ? (
            <div className="flex items-center gap-2 font-mono text-sm text-white/80">
              <Paperclip className="h-3.5 w-3.5 text-[#00F5FF]/50 shrink-0" />
              <span className="text-[10px] uppercase tracking-wider text-white/40 mr-1">FILE:</span>
              <span>{fileCard}</span>
            </div>
          ) : (
            <p className="text-sm text-white/85 leading-relaxed text-right">{msg.content}</p>
          )}
          <p className="mt-1 text-right font-mono text-[10px] text-white/15 tracking-wider">
            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-4 px-4 py-3">
      {/* Thin cyan accent line */}
      <div className="mt-1 w-px shrink-0 self-stretch bg-gradient-to-b from-[#00F5FF]/40 via-[#00F5FF]/15 to-transparent" />
      <div className="min-w-0 flex-1">
        {pending ? (
          <div className="flex items-center gap-2 py-1">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#00F5FF]/40" />
            <span className="font-mono text-xs uppercase tracking-wider text-white/25">processing...</span>
          </div>
        ) : (
          <>
            <div className="prose-sm max-w-none">{renderMarkdown(msg.content)}</div>
            {msg.actions && msg.actions.length > 0 && (
              <div className="mt-2 space-y-1">
                {msg.actions.map((a, i) => <ActionCard key={i} action={a} />)}
              </div>
            )}
            {/* KB Sources pill */}
            {msg.kb_sources && msg.kb_sources.length > 0 && (
              <div className="mt-2">
                <KBSourcesPill sources={msg.kb_sources} />
              </div>
            )}
            <p className="mt-2 font-mono text-[10px] text-white/15 tracking-wider">
              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
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
  'Como se calcula el fee de Recovery?',
  'Show me pending HFL decisions',
  'Explain the Leak Detector waste findings',
  '/run',
  '/report pdf',
];

function WelcomeScreen({ onSuggest }: { onSuggest: (text: string) => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6">
      <div className="w-full max-w-xl">

        {/* Minimal divider — the only visual element */}
        <div className="mb-16 flex justify-center">
          <div className="h-px w-12 bg-white/[0.08]" />
        </div>

        {/* Suggestion buttons — clean grid, no label */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => onSuggest(s)}
              className={cn(
                'rounded-xl px-4 py-3 text-left transition-all duration-200',
                s.startsWith('/')
                  ? 'bg-[#00F5FF]/[0.03] border border-[#00F5FF]/[0.08] hover:bg-[#00F5FF]/[0.06] hover:border-[#00F5FF]/[0.15]'
                  : 'bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.10]',
              )}
            >
              <span className={cn(
                'text-[13px] leading-relaxed',
                s.startsWith('/')
                  ? 'font-mono text-[#00F5FF]/50'
                  : 'text-white/40',
              )}>
                {s}
              </span>
            </button>
          ))}
        </div>

      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────

type ExtendedMessage = AssistantMessage & { pending?: boolean; fileCard?: string; kb_sources?: KBSourceRef[] };

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
          { id: `err_${Date.now()}`, role: 'assistant', content: `Warning: ${errMsg}`, timestamp: new Date().toISOString() },
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
      content: `Uploading ${pendingFile.name}...`,
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
        { id: `err_${Date.now()}`, role: 'assistant', content: `Warning: ${errMsg}`, timestamp: new Date().toISOString() },
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
    <div className="flex h-full flex-col bg-transparent">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx,.xls,.pdf,.docx"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Minimal top border — replaces the old status bar */}
      <div className="h-px bg-white/[0.04]" />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-white/20" />
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
          <div className="mx-auto max-w-2xl space-y-0 py-4">
            {messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="shrink-0 border-t border-white/[0.04] px-4 py-3">
        <div className="mx-auto max-w-2xl">

          {/* ── File mode: attach + ad spend ── */}
          {pendingFile && (
            <div className="mb-3 rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm px-4 py-3">
              <div className="flex items-center gap-3">
                <Paperclip className="h-3.5 w-3.5 shrink-0 text-white/25" />
                <span className="flex-1 min-w-0 text-sm text-white/60 truncate">{pendingFile.name}</span>
                <button onClick={() => setPendingFile(null)} className="text-white/20 hover:text-white/50 transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <span className="font-mono text-xs text-white/25">$</span>
                <input
                  ref={adSpendRef}
                  type="text"
                  value={adSpendInput}
                  onChange={(e) => setAdSpendInput(e.target.value)}
                  onKeyDown={handleAdSpendKeyDown}
                  placeholder="Ad spend amount"
                  className="flex-1 bg-transparent border-b border-white/[0.08] text-sm text-white/80 placeholder:text-white/15 focus:border-white/20 focus:outline-none py-1"
                />
                <button
                  onClick={() => void handleFileAnalyze()}
                  disabled={uploading || !adSpendInput.trim()}
                  className="text-xs text-white/40 hover:text-white/70 disabled:text-white/10 disabled:cursor-not-allowed transition-colors px-2 py-1"
                >
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Analyze'}
                </button>
              </div>
            </div>
          )}

          {/* ── Slash command palette ── */}
          {showPalette && filteredCommands.length > 0 && (
            <div className="mb-3 overflow-hidden rounded-xl border border-white/[0.06] bg-[#0A0A0F]/95 backdrop-blur-xl shadow-2xl">
              {filteredCommands.map((cmd, i) => (
                <button
                  key={cmd.cmd}
                  onClick={() => selectCommand(cmd)}
                  className={cn(
                    'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-all duration-150',
                    i === slashIdx ? 'bg-white/[0.04]' : 'hover:bg-white/[0.02]',
                  )}
                >
                  <cmd.Icon className={cn('h-3.5 w-3.5 shrink-0', i === slashIdx ? 'text-[#00F5FF]/70' : 'text-white/15')} />
                  <span className={cn('font-mono text-xs', i === slashIdx ? 'text-[#00F5FF]/70' : 'text-[#00F5FF]/30')}>{cmd.cmd}</span>
                  <span className={cn('text-xs', i === slashIdx ? 'text-white/60' : 'text-white/25')}>{cmd.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* ── Main input ── */}
          <div className="relative flex items-end gap-3">
            {/* Paperclip */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="mb-1 shrink-0 text-white/15 transition-colors hover:text-white/40"
              title="Upload file"
              type="button"
            >
              <Paperclip className="h-4 w-4" />
            </button>

            <div className="flex-1 border-b border-white/[0.08] transition-colors focus-within:border-white/[0.15]">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything..."
                rows={1}
                disabled={sending || uploading}
                className="w-full resize-none bg-transparent text-sm text-white/80 placeholder:text-white/20 focus:outline-none disabled:opacity-40 py-1.5"
                style={{ lineHeight: '1.5', maxHeight: 180 }}
              />
            </div>

            <button
              onClick={() => void handleSend()}
              disabled={!input.trim() || sending || uploading}
              className="mb-1 shrink-0 text-white/15 transition-all duration-200 hover:text-white/50 disabled:text-white/[0.05] disabled:cursor-not-allowed"
              style={input.trim() && !sending ? { color: 'rgba(255,255,255,0.5)' } : undefined}
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
