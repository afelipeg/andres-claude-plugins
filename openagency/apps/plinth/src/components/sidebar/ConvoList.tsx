'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, Plus, MessageSquare, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count?: number;
}

interface ConvoListProps {
  activeId?: string;
  onSelect: (id: string) => void;
  onNew: () => void;
}

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  const lsToken = localStorage.getItem('plinth_token');
  if (lsToken) return lsToken;
  const match = document.cookie.match(/(?:^|;\s*)plinth_token=([^;]*)/);
  return match ? match[1] : null;
}

function groupConversations(conversations: Conversation[]): Record<string, Conversation[]> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  const groups: Record<string, Conversation[]> = {
    Today: [],
    Yesterday: [],
    'Previous 7 days': [],
    Older: [],
  };

  for (const convo of conversations) {
    const date = new Date(convo.updated_at || convo.created_at);
    if (date >= today) {
      groups['Today'].push(convo);
    } else if (date >= yesterday) {
      groups['Yesterday'].push(convo);
    } else if (date >= weekAgo) {
      groups['Previous 7 days'].push(convo);
    } else {
      groups['Older'].push(convo);
    }
  }

  return groups;
}

function truncateTitle(title: string, maxLen = 40): string {
  if (!title) return 'New conversation';
  if (title.length <= maxLen) return title;
  return title.slice(0, maxLen).trim() + '...';
}

export function ConvoList({ activeId, onSelect, onNew }: ConvoListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchConversations = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/v1/assistant/conversations', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error('Failed to load conversations');
      }
      const data = await res.json();
      // Handle both {conversations: [...]} and direct array
      const convos: Conversation[] = Array.isArray(data) ? data : data.conversations ?? data.data ?? [];
      // Sort by most recent first
      convos.sort((a, b) => {
        const dateA = new Date(b.updated_at || b.created_at).getTime();
        const dateB = new Date(a.updated_at || a.created_at).getTime();
        return dateA - dateB;
      });
      setConversations(convos);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
      // Keep showing existing conversations if any
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter((c) => c.title?.toLowerCase().includes(q));
  }, [conversations, search]);

  const grouped = useMemo(() => groupConversations(filtered), [filtered]);
  const groupOrder = ['Today', 'Yesterday', 'Previous 7 days', 'Older'];

  return (
    <div className="flex flex-col h-full">
      {/* New chat button */}
      <div className="p-3 flex-shrink-0">
        <button
          onClick={onNew}
          className="flex w-full items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-foreground transition-colors"
        >
          <Plus className="h-4 w-4" />
          New chat
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pb-2 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations..."
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900/30 pl-8 pr-3 py-1.5 text-sm text-foreground placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors"
          />
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-800">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
          </div>
        )}

        {!loading && error && conversations.length === 0 && (
          <div className="px-3 py-8 text-center">
            <p className="text-sm text-zinc-500">{error}</p>
            <button
              onClick={fetchConversations}
              className="mt-2 text-xs text-primary hover:text-primary/80 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && conversations.length === 0 && !error && (
          <div className="px-3 py-8 text-center">
            <MessageSquare className="mx-auto h-8 w-8 text-zinc-700 mb-2" />
            <p className="text-sm text-zinc-500">No conversations yet</p>
            <p className="text-xs text-zinc-600 mt-1">Start a new chat above</p>
          </div>
        )}

        {!loading && filtered.length === 0 && conversations.length > 0 && (
          <div className="px-3 py-8 text-center">
            <p className="text-sm text-zinc-500">No matching conversations</p>
          </div>
        )}

        {!loading &&
          groupOrder.map((groupName) => {
            const items = grouped[groupName];
            if (!items || items.length === 0) return null;
            return (
              <div key={groupName} className="mb-3">
                <div className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-600">
                  {groupName}
                </div>
                {items.map((convo) => (
                  <button
                    key={convo.id}
                    onClick={() => onSelect(convo.id)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors group',
                      activeId === convo.id
                        ? 'bg-zinc-800 text-foreground'
                        : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                    )}
                  >
                    <MessageSquare className="h-4 w-4 flex-shrink-0 text-zinc-600 group-hover:text-zinc-500" />
                    <span className="truncate text-sm">{truncateTitle(convo.title)}</span>
                  </button>
                ))}
              </div>
            );
          })}
      </div>
    </div>
  );
}
