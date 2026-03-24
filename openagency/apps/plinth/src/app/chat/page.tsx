'use client';

import React, { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useChat } from '@/hooks/useChat';
import { ChatMessages } from '@/components/chat/ChatMessages';
import { ChatInput } from '@/components/chat/ChatInput';
import { FileUploadZone } from '@/components/chat/FileUploadZone';
import { useBrandContext, serializeBrandContext } from '@/contexts/BrandContext';

export default function NewChatPage() {
  const router = useRouter();
  const { messages, sendMessage, isStreaming, conversationId, error } = useChat();
  const { currentBrand } = useBrandContext();

  // Redirect to conversation page once we have an ID and streaming is done
  if (conversationId && messages.length > 0 && !isStreaming) {
    router.replace(`/chat/${conversationId}`);
  }

  const brandCtxStr = currentBrand ? serializeBrandContext(currentBrand) : undefined;

  const handleSend = useCallback(
    (text: string) => {
      sendMessage(text, undefined, brandCtxStr);
    },
    [sendMessage, brandCtxStr]
  );

  const handleSuggestionClick = useCallback(
    (text: string) => {
      sendMessage(text, undefined, brandCtxStr);
    },
    [sendMessage, brandCtxStr]
  );

  const handleFileUpload = useCallback(
    (filename: string, contentBase64: string) => {
      sendMessage(
        `Uploaded file: ${filename}\n\n[File data attached: ${filename}, ${Math.round((contentBase64.length * 3) / 4 / 1024)}KB]`,
        undefined,
        brandCtxStr
      );
    },
    [sendMessage, brandCtxStr]
  );

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
