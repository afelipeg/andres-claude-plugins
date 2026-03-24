// Agent SDK Chat Endpoint
// Receives user messages, runs Claude with 63 MCP tools, streams response

import { NextRequest } from 'next/server';
import { getPlinth } from '@/lib/plinth';
import { getSystemPrompt, getSdkOptions } from '@/lib/plinth-sdk';

export const runtime = 'nodejs';
export const maxDuration = 300;

// In-process MCP server reference (embedded, no HTTP)
let mcpServerReady = false;

async function ensureMcpServer() {
  if (mcpServerReady) return;
  // The MCP server is initialized as part of Plinth bootstrap
  // For SDK integration, we'll use direct engine calls via the agency instance
  mcpServerReady = true;
}

export async function POST(request: NextRequest) {
  try {
    // Auth from middleware headers
    const authSub = request.headers.get('x-auth-sub');
    const _authRole = request.headers.get('x-auth-role');
    const _agencyId = request.headers.get('x-auth-agency');

    if (!authSub) {
      return Response.json({ error: 'unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { message, conversationId, brandContext } = body as {
      message: string;
      conversationId?: string;
      brandContext?: string;
    };

    if (!message?.trim()) {
      return Response.json({ error: 'message is required' }, { status: 400 });
    }

    await ensureMcpServer();
    const plinth = await getPlinth();

    // Build system prompt with brand context
    const systemPrompt = getSystemPrompt(brandContext);

    // Load conversation history if resuming
    let history: Array<{ role: string; content: string }> = [];
    if (conversationId && plinth.repos.conversation) {
      try {
        const convo = await plinth.repos.conversation.findById(conversationId);
        if (convo?.messages) {
          history = convo.messages.map((m: { role: string; content: string }) => ({
            role: m.role,
            content: m.content,
          }));
        }
      } catch {
        // New conversation
      }
    }

    // For now, use direct Anthropic API call with streaming
    // This will be replaced with Agent SDK query() once the SDK is installed
    const anthropicKey = process.env['ANTHROPIC_API_KEY'];
    if (!anthropicKey) {
      return Response.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
    }

    const messages = [
      ...history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user' as const, content: message },
    ];

    // Stream response using Anthropic Messages API
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': anthropicKey,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: getSdkOptions().model,
              max_tokens: 8192,
              system: systemPrompt,
              messages,
              stream: true,
            }),
          });

          if (!response.ok) {
            const errText = await response.text();
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: errText })}\n\n`));
            controller.close();
            return;
          }

          const reader = response.body?.getReader();
          if (!reader) {
            controller.close();
            return;
          }

          const decoder = new TextDecoder();
          let fullResponse = '';
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const data = line.slice(6).trim();
              if (data === '[DONE]') continue;

              try {
                const event = JSON.parse(data);

                if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
                  const text = event.delta.text;
                  fullResponse += text;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text', text })}\n\n`));
                }

                if (event.type === 'message_stop') {
                  // Persist conversation
                  if (plinth.repos.conversation) {
                    const convoId = conversationId ?? crypto.randomUUID();
                    try {
                      const now = new Date().toISOString();
                      const allMessages = [
                        ...history.map((m) => ({
                          id: crypto.randomUUID(),
                          role: m.role as 'user' | 'assistant',
                          content: m.content,
                          timestamp: now,
                        })),
                        { id: crypto.randomUUID(), role: 'user' as const, content: message, timestamp: now },
                        { id: crypto.randomUUID(), role: 'assistant' as const, content: fullResponse, timestamp: now },
                      ];
                      await plinth.repos.conversation.save({
                        id: convoId,
                        user_id: authSub,
                        title: message.slice(0, 80),
                        starred: false,
                        run_type: 'chat',
                        messages: allMessages,
                        message_count: allMessages.length,
                        created_at: now,
                        updated_at: now,
                      });
                    } catch {
                      // Non-blocking
                    }
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', conversationId: convoId })}\n\n`));
                  }
                }
              } catch {
                // Skip malformed events
              }
            }
          }
        } catch (err) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: String(err) })}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
