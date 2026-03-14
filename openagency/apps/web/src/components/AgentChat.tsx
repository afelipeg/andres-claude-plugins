// ─── Agent Chat Component ───────────────────────────────────────────
// Human-to-agent feedback channel. Messages become observations.
// Enhanced: accept/reject decisions are persisted to the API.

import { useState, useEffect, useRef } from 'react';
import type { ChatMessage, PendingDecision } from '../api/agents';
import {
  getChatHistory,
  sendChatMessage,
  listPendingDecisions,
  approveDecision,
  rejectDecision,
} from '../api/agents';

interface AgentChatProps {
  agentId: string;
  onCycleTriggered?: () => void;
}

function DecisionCard({
  decision,
  onApprove,
  onReject,
  processing,
}: {
  decision: PendingDecision;
  onApprove: () => void;
  onReject: () => void;
  processing: boolean;
}) {
  const urgencyColor: Record<string, string> = {
    low: 'bg-green-100 text-green-700',
    medium: 'bg-yellow-100 text-yellow-700',
    high: 'bg-red-100 text-red-700',
  };

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
      <div className="flex items-center gap-2 text-xs">
        <span className="font-semibold text-amber-700">Pending Decision</span>
        <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${urgencyColor[decision.urgency] ?? 'bg-gray-100 text-gray-600'}`}>
          {decision.urgency}
        </span>
        <span className="text-gray-400 font-mono">run {decision.run_id.slice(0, 8)}</span>
      </div>
      <p className="mt-1.5 text-xs text-gray-700">{decision.reason}</p>
      <div className="mt-3 flex gap-2">
        <button
          onClick={onApprove}
          disabled={processing}
          className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
        >
          {processing ? '...' : 'Approve'}
        </button>
        <button
          onClick={onReject}
          disabled={processing}
          className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
        >
          {processing ? '...' : 'Reject'}
        </button>
      </div>
    </div>
  );
}

export function AgentChat({ agentId, onCycleTriggered }: AgentChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [decisions, setDecisions] = useState<PendingDecision[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [processingDecision, setProcessingDecision] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void getChatHistory(agentId).then(setMessages).catch(() => {});
    void listPendingDecisions()
      .then((all) => setDecisions(all.filter((d) => d.pipeline_id === agentId)))
      .catch(() => {});
  }, [agentId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, decisions]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      const res = await sendChatMessage(agentId, input.trim());
      setMessages(res.messages);
      setInput('');
      if (res.cycle_result) {
        onCycleTriggered?.();
        // Refresh decisions after cycle
        void listPendingDecisions()
          .then((all) => setDecisions(all.filter((d) => d.pipeline_id === agentId)))
          .catch(() => {});
      }
    } catch {
      // Keep current messages
    } finally {
      setSending(false);
    }
  };

  const handleApprove = async (decision: PendingDecision) => {
    setProcessingDecision(true);
    try {
      await approveDecision(decision.pipeline_id, decision.run_id);
      setDecisions((prev) => prev.filter((d) => d.id !== decision.id));
      setMessages((prev) => [
        ...prev,
        {
          role: 'system',
          content: `Decision approved: ${decision.reason.slice(0, 100)}`,
          timestamp: new Date().toISOString(),
        },
      ]);
      onCycleTriggered?.();
    } catch {
      // Keep decision visible
    } finally {
      setProcessingDecision(false);
    }
  };

  const handleReject = async (decision: PendingDecision) => {
    setProcessingDecision(true);
    try {
      await rejectDecision(decision.pipeline_id, decision.run_id);
      setDecisions((prev) => prev.filter((d) => d.id !== decision.id));
      setMessages((prev) => [
        ...prev,
        {
          role: 'system',
          content: `Decision rejected: ${decision.reason.slice(0, 100)}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch {
      // Keep decision visible
    } finally {
      setProcessingDecision(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="flex h-96 flex-col rounded-xl border border-gray-200 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <div>
          <h4 className="text-sm font-semibold text-gray-900">Agent Feedback</h4>
          <p className="text-xs text-gray-500">{agentId}</p>
        </div>
        {decisions.length > 0 && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
            {decisions.length} pending
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && decisions.length === 0 && (
          <p className="text-center text-xs text-gray-400 py-8">
            Send feedback to guide the agent&apos;s next analysis cycle.
          </p>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'human' ? 'justify-end' : msg.role === 'system' ? 'justify-center' : 'justify-start'}`}
          >
            {msg.role === 'system' ? (
              <div className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-500">
                {msg.content}
              </div>
            ) : (
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === 'human'
                    ? 'bg-zinc-900 text-white'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                <p>{msg.content}</p>
                <p className={`mt-1 text-xs ${msg.role === 'human' ? 'text-zinc-400' : 'text-gray-400'}`}>
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </p>
              </div>
            )}
          </div>
        ))}

        {/* Pending decisions */}
        {decisions.map((d) => (
          <DecisionCard
            key={d.id}
            decision={d}
            onApprove={() => void handleApprove(d)}
            onReject={() => void handleReject(d)}
            processing={processingDecision}
          />
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-100 px-4 py-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Provide feedback or request re-analysis..."
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400"
            disabled={sending}
          />
          <button
            onClick={() => void handleSend()}
            disabled={!input.trim() || sending}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50"
          >
            {sending ? '...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
