'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Send } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SlashCommand {
  command: string;
  label: string;
  prompt: string;
}

const SLASH_COMMANDS: SlashCommand[] = [
  { command: '/analyze', label: 'Analyze campaign performance', prompt: '/analyze Run a full performance analysis across all active campaigns' },
  { command: '/waste', label: 'Run waste detection waterfall', prompt: '/waste Run the waste detection waterfall to identify budget leakage' },
  { command: '/optimize', label: 'Optimize channel allocation', prompt: '/optimize Optimize budget allocation across channels using Media Architect' },
  { command: '/report', label: 'Generate monthly report', prompt: '/report Generate a comprehensive monthly performance report' },
  { command: '/shapley', label: 'Run Shapley attribution', prompt: '/shapley Run Shapley value attribution analysis for current campaigns' },
  { command: '/mmm', label: 'Run Bayesian Media Mix Model', prompt: '/mmm Run a Bayesian Media Mix Model to estimate channel contributions and saturation curves' },
  { command: '/plan', label: 'Create media plan', prompt: '/plan Create an optimized media plan with budget allocation recommendations' },
  { command: '/audit', label: 'Supply chain audit', prompt: '/audit Run a supply chain transparency audit on current programmatic paths' },
];

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const [value, setValue] = useState('');
  const [showSlash, setShowSlash] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const filteredCommands = SLASH_COMMANDS.filter((cmd) =>
    cmd.command.startsWith(`/${slashFilter}`)
  );

  // Auto-resize textarea
  const resizeTextarea = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    const lineHeight = 24; // approx line-height
    const maxHeight = lineHeight * 6;
    ta.style.height = `${Math.min(ta.scrollHeight, maxHeight)}px`;
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [value, resizeTextarea]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setValue(newValue);

    // Slash command detection
    if (newValue === '/') {
      setShowSlash(true);
      setSlashFilter('');
      setSelectedIndex(0);
    } else if (newValue.startsWith('/') && !newValue.includes(' ')) {
      setShowSlash(true);
      setSlashFilter(newValue.slice(1));
      setSelectedIndex(0);
    } else {
      setShowSlash(false);
    }
  };

  const selectCommand = (cmd: SlashCommand) => {
    setValue(cmd.prompt);
    setShowSlash(false);
    textareaRef.current?.focus();
  };

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    setShowSlash(false);
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Slash command navigation
    if (showSlash && filteredCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        selectCommand(filteredCommands[selectedIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowSlash(false);
        return;
      }
    }

    // Enter to send, Shift+Enter for newline
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Keep selected index in bounds
  useEffect(() => {
    if (selectedIndex >= filteredCommands.length) {
      setSelectedIndex(Math.max(0, filteredCommands.length - 1));
    }
  }, [filteredCommands.length, selectedIndex]);

  // Scroll selected command into view
  useEffect(() => {
    if (showSlash && menuRef.current) {
      const items = menuRef.current.querySelectorAll('[data-slash-item]');
      items[selectedIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, showSlash]);

  const canSend = value.trim().length > 0 && !disabled;

  return (
    <div className="relative">
      {/* Slash command dropdown */}
      {showSlash && filteredCommands.length > 0 && (
        <div
          ref={menuRef}
          className="absolute bottom-full left-0 right-0 mb-2 max-h-72 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl shadow-black/30"
        >
          <div className="px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            Commands
          </div>
          {filteredCommands.map((cmd, i) => (
            <button
              key={cmd.command}
              data-slash-item
              onClick={() => selectCommand(cmd)}
              className={cn(
                'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors',
                i === selectedIndex ? 'bg-zinc-800 text-foreground' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
              )}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-800 border border-zinc-700 text-xs font-mono text-emerald-400">
                /
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{cmd.command}</div>
                <div className="text-xs text-zinc-500 truncate">{cmd.label}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="flex items-end gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/80 px-4 py-3 focus-within:border-zinc-600 focus-within:ring-1 focus-within:ring-zinc-700 transition-all">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Message Plinth... (type / for commands)"
          disabled={disabled}
          rows={1}
          className={cn(
            'flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-zinc-500 focus:outline-none disabled:opacity-50',
            'scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-700'
          )}
          style={{ maxHeight: '144px' /* 6 lines * 24px */ }}
        />
        <button
          onClick={handleSend}
          disabled={!canSend}
          className={cn(
            'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-all',
            canSend
              ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shadow-emerald-500/20'
              : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
          )}
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>

      <p className="mt-1.5 text-center text-[11px] text-zinc-600">
        Plinth can make mistakes. Verify important results.
      </p>
    </div>
  );
}
