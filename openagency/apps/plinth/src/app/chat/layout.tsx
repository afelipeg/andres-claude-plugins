'use client';

import React, { useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConvoList } from '@/components/sidebar/ConvoList';
import { BrandSelector } from '@/components/sidebar/BrandSelector';
import { ConnectionsPanel } from '@/components/sidebar/ConnectionsPanel';

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [currentBrand, setCurrentBrand] = useState<{ id: string; name: string } | undefined>();
  const router = useRouter();
  const pathname = usePathname();

  // Extract conversation ID from pathname
  const activeConvoId = pathname.startsWith('/chat/') ? pathname.slice(6) : undefined;

  const handleSelectConvo = useCallback(
    (id: string) => {
      router.push(`/chat/${id}`);
      setMobileSidebarOpen(false);
    },
    [router]
  );

  const handleNewChat = useCallback(() => {
    router.push('/chat');
    setMobileSidebarOpen(false);
  }, [router]);

  const handleBrandSelect = useCallback(
    (brand: { id: string; name: string }) => {
      setCurrentBrand(brand);
      // Brand context will be passed through to useChat via page components
    },
    []
  );

  /* ---- Sidebar Content (shared between desktop and mobile) ---- */
  const sidebarContent = (
    <div className="flex flex-col h-full w-full">
      {/* Logo + Brand selector */}
      <div className="p-3 border-b border-zinc-800 flex-shrink-0">
        <div className="flex items-center gap-2 mb-3 px-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-blue-600 text-xs font-bold text-white flex-shrink-0">
            P
          </div>
          <span className="text-sm font-semibold text-foreground">Plinth</span>
        </div>
        <BrandSelector currentBrand={currentBrand} onSelect={handleBrandSelect} />
      </div>

      {/* Conversation list */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ConvoList
          activeId={activeConvoId}
          onSelect={handleSelectConvo}
          onNew={handleNewChat}
        />
      </div>

      {/* Connections (compact) */}
      <div className="flex-shrink-0">
        <ConnectionsPanel compact />
      </div>
    </div>
  );

  return (
    <div className="flex h-full w-full">
      {/* Desktop sidebar */}
      <div
        className={cn(
          'hidden md:flex flex-shrink-0 border-r border-zinc-800 bg-zinc-950/50 transition-all duration-200 overflow-hidden',
          sidebarOpen ? 'w-[280px]' : 'w-0'
        )}
      >
        <div className="w-[280px] h-full">{sidebarContent}</div>
      </div>

      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
          {/* Slide-out panel */}
          <div className="fixed inset-y-0 left-0 z-50 w-[280px] border-r border-zinc-800 bg-zinc-950 md:hidden shadow-xl shadow-black/30">
            <div className="absolute right-2 top-2 z-10">
              <button
                onClick={() => setMobileSidebarOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                aria-label="Close sidebar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {sidebarContent}
          </div>
        </>
      )}

      {/* Main area */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top bar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800 flex-shrink-0 bg-zinc-950/30">
          {/* Desktop toggle */}
          <button
            onClick={() => setSidebarOpen((prev) => !prev)}
            className="hidden md:flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          >
            {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </button>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="flex md:hidden h-8 w-8 items-center justify-center rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
            aria-label="Open sidebar"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>

          {/* Brand name indicator (mobile) */}
          {currentBrand && (
            <span className="md:hidden text-xs text-zinc-500 truncate">
              {currentBrand.name}
            </span>
          )}

          <div className="flex-1" />

          <a
            href="/settings"
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1 rounded-md hover:bg-zinc-800"
          >
            Settings
          </a>
        </div>

        {/* Chat content */}
        <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
