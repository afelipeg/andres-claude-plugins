'use client';

import React, { useRef, useEffect } from 'react';
import { BarChart3, Shield, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MessageBubble } from './MessageBubble';
import type { Message } from '@/hooks/useChat';

interface ChatMessagesProps {
  messages: Message[];
  isStreaming: boolean;
  onSuggestionClick?: (text: string) => void;
}

const SUGGESTIONS = [
  {
    icon: BarChart3,
    title: 'Analyze performance',
    prompt: '/analyze Run a full performance analysis across all active campaigns',
    color: 'text-emerald-400',
  },
  {
    icon: Shield,
    title: 'Detect waste',
    prompt: '/waste Run the waste detection waterfall on current spend data',
    color: 'text-amber-400',
  },
  {
    icon: FileText,
    title: 'Generate report',
    prompt: '/report Generate a monthly performance report for stakeholders',
    color: 'text-blue-400',
  },
];

export function ChatMessages({ messages, isStreaming, onSuggestionClick }: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages or streaming content
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, messages.length > 0 ? messages[messages.length - 1]?.content : '']);

  // Empty state
  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4">
        <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-blue-600 shadow-lg shadow-emerald-500/20">
          <span className="text-2xl font-bold text-white">P</span>
        </div>
        <h2 className="mb-2 text-xl font-semibold text-foreground">Start a conversation</h2>
        <p className="mb-8 max-w-md text-center text-sm text-muted-foreground">
          Ask Plinth to analyze campaigns, detect waste, optimize media mix, or generate reports across all your connected platforms.
        </p>
        <div className="grid w-full max-w-lg gap-3">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion.title}
              onClick={() => onSuggestionClick?.(suggestion.prompt)}
              className="group flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 text-left transition-all hover:border-zinc-700 hover:bg-zinc-800/70"
            >
              <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-800 group-hover:bg-zinc-700 transition-colors', suggestion.color)}>
                <suggestion.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{suggestion.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                  {suggestion.prompt.replace(/^\/\w+\s+/, '')}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl py-4">
        {messages.map((message, index) => {
          const isLastAssistant =
            isStreaming &&
            message.role === 'assistant' &&
            index === messages.length - 1;

          return (
            <MessageBubble
              key={message.id}
              message={message}
              isStreaming={isLastAssistant}
            />
          );
        })}

        {/* Streaming indicator when assistant message is still empty */}
        {isStreaming && messages.length > 0 && messages[messages.length - 1]?.role === 'assistant' && messages[messages.length - 1]?.content === '' && (
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-blue-600 text-xs font-bold text-white">
              P
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" style={{ animationDelay: '0ms' }} />
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" style={{ animationDelay: '200ms' }} />
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" style={{ animationDelay: '400ms' }} />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
