'use client';

import React, { use, useCallback } from 'react';
import { useChat } from '@/hooks/useChat';
import { ChatMessages } from '@/components/chat/ChatMessages';
import { ChatInput } from '@/components/chat/ChatInput';
import { FileUploadZone } from '@/components/chat/FileUploadZone';
import { Loader2 } from 'lucide-react';
import { useBrandContext, serializeBrandContext } from '@/contexts/BrandContext';

export default function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { messages, sendMessage, isStreaming, error, loadingHistory } = useChat({
    conversationId: id,
  });
  const { currentBrand } = useBrandContext();

  const brandCtxStr = currentBrand ? serializeBrandContext(currentBrand) : undefined;

  const handleSend = useCallback(
    (text: string) => {
      sendMessage(text, id, brandCtxStr);
    },
    [sendMessage, id, brandCtxStr]
  );

  const handleSuggestionClick = useCallback(
    (text: string) => {
      sendMessage(text, id, brandCtxStr);
    },
    [sendMessage, id, brandCtxStr]
  );

  const handleFileUpload = useCallback(
    (filename: string, contentBase64: string) => {
      sendMessage(
        `Uploaded file: ${filename}\n\n[File data attached: ${filename}, ${Math.round((contentBase64.length * 3) / 4 / 1024)}KB]`,
        id,
        brandCtxStr
      );
    },
    [sendMessage, id, brandCtxStr]
  );

  // Loading state for conversation history
  if (loadingHistory) {
    return (
      <div className="flex flex-1 items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
          <p className="text-sm text-zinc-500">Loading conversation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <FileUploadZone onFileUpload={handleFileUpload}>
        {/* Messages area */}
        <ChatMessages
          messages={messages}
          isStreaming={isStreaming}
          onSuggestionClick={handleSuggestionClick}
        />
      </FileUploadZone>

      {/* Error banner */}
      {error && (
        <div className="mx-4 mb-2 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Input */}
      <div className="flex-shrink-0 border-t border-zinc-800 px-4 py-3 bg-zinc-950/30">
        <div className="mx-auto max-w-3xl">
          <ChatInput onSend={handleSend} disabled={isStreaming} />
        </div>
      </div>
    </div>
  );
}
