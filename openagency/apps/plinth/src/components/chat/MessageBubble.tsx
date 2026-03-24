'use client';

import React, { useState, useMemo } from 'react';
import { User, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ArtifactRenderer, type VisualizationHint } from '@/components/artifacts/ArtifactRenderer';

export interface MessageBubbleMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  artifacts?: VisualizationHint[];
}

interface MessageBubbleProps {
  message: MessageBubbleMessage;
  isStreaming?: boolean;
}

/* ---------- relative time ---------- */
function relativeTime(date: Date): string {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 10) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

/* ---------- lightweight markdown renderer ---------- */

interface RenderedSegment {
  type: 'text' | 'code';
  language?: string;
  content: string;
}

function splitByCodeBlocks(text: string): RenderedSegment[] {
  const segments: RenderedSegment[] = [];
  const regex = /```(\w*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }
    segments.push({ type: 'code', language: match[1] || undefined, content: match[2] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) });
  }

  return segments;
}

function renderInlineMarkdown(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Process: **bold**, *italic*, `code`, [text](url)
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      nodes.push(text.slice(lastIdx, match.index));
    }
    if (match[2]) {
      nodes.push(<strong key={key++} className="font-semibold text-foreground">{match[2]}</strong>);
    } else if (match[3]) {
      nodes.push(<em key={key++} className="italic text-zinc-300">{match[3]}</em>);
    } else if (match[4]) {
      nodes.push(
        <code key={key++} className="rounded bg-zinc-800 px-1.5 py-0.5 text-sm font-mono text-emerald-400">
          {match[4]}
        </code>
      );
    } else if (match[5] && match[6]) {
      nodes.push(
        <a key={key++} href={match[6]} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">
          {match[5]}
        </a>
      );
    }
    lastIdx = match.index + match[0].length;
  }

  if (lastIdx < text.length) {
    nodes.push(text.slice(lastIdx));
  }

  return nodes;
}

function renderTextBlock(text: string): React.ReactNode {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: { level: number; content: string }[] = [];
  let orderedItems: { num: string; content: string }[] = [];

  function flushUnorderedList() {
    if (listItems.length > 0) {
      elements.push(
        <ul key={elements.length} className="list-disc pl-5 space-y-0.5 my-1">
          {listItems.map((item, i) => (
            <li key={i} className="text-zinc-300">{renderInlineMarkdown(item.content)}</li>
          ))}
        </ul>
      );
      listItems = [];
    }
  }

  function flushOrderedList() {
    if (orderedItems.length > 0) {
      elements.push(
        <ol key={elements.length} className="list-decimal pl-5 space-y-0.5 my-1">
          {orderedItems.map((item, i) => (
            <li key={i} className="text-zinc-300">{renderInlineMarkdown(item.content)}</li>
          ))}
        </ol>
      );
      orderedItems = [];
    }
  }

  for (const line of lines) {
    // Heading detection
    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      flushUnorderedList();
      flushOrderedList();
      const level = headingMatch[1].length;
      const Tag = `h${Math.min(level + 1, 6)}` as keyof React.JSX.IntrinsicElements;
      const sizeClass = level === 1 ? 'text-lg font-bold' : level === 2 ? 'text-base font-semibold' : 'text-sm font-semibold';
      elements.push(
        <Tag key={elements.length} className={cn(sizeClass, 'text-foreground mt-3 mb-1')}>
          {renderInlineMarkdown(headingMatch[2])}
        </Tag>
      );
      continue;
    }

    // Unordered list
    const ulMatch = line.match(/^(\s*)[*-]\s+(.+)$/);
    if (ulMatch) {
      flushOrderedList();
      listItems.push({ level: ulMatch[1].length, content: ulMatch[2] });
      continue;
    }

    // Ordered list
    const olMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (olMatch) {
      flushUnorderedList();
      orderedItems.push({ num: olMatch[1], content: olMatch[2] });
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      flushUnorderedList();
      flushOrderedList();
      elements.push(<hr key={elements.length} className="border-zinc-700 my-3" />);
      continue;
    }

    // Regular paragraph line
    flushUnorderedList();
    flushOrderedList();

    if (line.trim() === '') {
      elements.push(<div key={elements.length} className="h-2" />);
    } else {
      elements.push(
        <p key={elements.length} className="text-zinc-300 leading-relaxed">
          {renderInlineMarkdown(line)}
        </p>
      );
    }
  }

  flushUnorderedList();
  flushOrderedList();

  return <>{elements}</>;
}

function isVisualizationHintBlock(content: string): boolean {
  try {
    const parsed = JSON.parse(content);
    if (parsed.visualization_hints) return true;
    if (Array.isArray(parsed) && parsed[0]?.chart_type) return true;
    if (parsed.chart_type) return true;
  } catch {
    // not JSON
  }
  return false;
}

/* ---------- component ---------- */

export function MessageBubble({ message, isStreaming = false }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [showCopy, setShowCopy] = useState(false);

  const isUser = message.role === 'user';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API unavailable
    }
  };

  const segments = useMemo(() => splitByCodeBlocks(message.content), [message.content]);
  const artifacts = message.artifacts ?? [];

  return (
    <div
      className={cn('group flex gap-3 px-4 py-3', isUser ? 'justify-end' : 'justify-start')}
      onMouseEnter={() => setShowCopy(true)}
      onMouseLeave={() => setShowCopy(false)}
    >
      {/* Assistant avatar */}
      {!isUser && (
        <div className="flex-shrink-0 mt-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-blue-600 text-xs font-bold text-white">
            P
          </div>
        </div>
      )}

      <div className={cn('flex flex-col max-w-[85%]', isUser ? 'items-end' : 'items-start', isUser ? '' : 'flex-1 min-w-0')}>
        {/* Message content */}
        <div
          className={cn(
            'relative rounded-2xl px-4 py-3 text-sm',
            isUser
              ? 'bg-primary/10 text-foreground border border-primary/20'
              : 'bg-zinc-900/60 text-zinc-200 w-full'
          )}
        >
          {/* Rendered content */}
          <div className="space-y-1">
            {segments.map((seg, i) => {
              if (seg.type === 'code') {
                // Check if this is a visualization hint block — hide the raw JSON
                if (isVisualizationHintBlock(seg.content)) {
                  return null;
                }
                return (
                  <div key={i} className="my-2 rounded-lg bg-zinc-950 border border-zinc-800 overflow-hidden">
                    {seg.language && (
                      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-zinc-800">
                        <span className="text-xs text-zinc-500 font-mono">{seg.language}</span>
                      </div>
                    )}
                    <pre className="p-3 overflow-x-auto">
                      <code className="text-sm font-mono text-emerald-400 whitespace-pre">{seg.content}</code>
                    </pre>
                  </div>
                );
              }
              return <div key={i}>{renderTextBlock(seg.content)}</div>;
            })}
          </div>

          {/* Streaming cursor */}
          {isStreaming && !isUser && (
            <span className="inline-block w-1.5 h-4 bg-emerald-500 animate-pulse ml-0.5 align-middle rounded-sm" />
          )}

          {/* Copy button */}
          {!isStreaming && message.content && (
            <button
              onClick={handleCopy}
              className={cn(
                'absolute -bottom-3 right-2 p-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-all duration-150',
                showCopy ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1 pointer-events-none'
              )}
              aria-label="Copy message"
            >
              {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            </button>
          )}
        </div>

        {/* Artifacts rendered below message */}
        {artifacts.length > 0 && (
          <div className="mt-3 w-full space-y-3">
            {artifacts.map((hint, i) => (
              <ArtifactRenderer key={`${hint.chart_type}-${i}`} hint={hint} />
            ))}
          </div>
        )}

        {/* Timestamp */}
        <span className="mt-1 text-[11px] text-zinc-600 px-1">
          {relativeTime(message.timestamp instanceof Date ? message.timestamp : new Date(message.timestamp))}
        </span>
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="flex-shrink-0 mt-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 border border-zinc-700">
            <User className="h-4 w-4 text-zinc-400" />
          </div>
        </div>
      )}
    </div>
  );
}
