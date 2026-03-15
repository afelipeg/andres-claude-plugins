// ─── Assistant Routes ────────────────────────────────────────────────
// Conversational AI interface: pipeline results, HFL decisions, engines.
// Powered by core callLLM abstraction (Anthropic / DeepSeek fallback).

import { Hono } from 'hono';
import { ulid } from 'ulid';
import type { LLMConfig } from '@openagency/types';
import { callLLM } from '@openagency/core';
import type { MeshCoordinator, MeshRun } from '@openagency/agent';
import type { HFLCoordinator, HFLDecision } from '@openagency/hfl';

// ─── In-memory conversation store ─────────────────────────────────────

interface ConvMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  actions?: Array<{ type: string; result: unknown }>;
}

interface Conversation {
  id: string;
  title: string;
  messages: ConvMessage[];
  created_at: string;
  updated_at: string;
}

const conversations = new Map<string, Conversation>();

// ─── System prompt builder ─────────────────────────────────────────────

function buildSystemPrompt(mesh: MeshCoordinator, hfl: HFLCoordinator): string {
  const runs = mesh.listRuns();
  const latestRun: MeshRun | undefined = runs[runs.length - 1];
  const pendingDecisions: HFLDecision[] = hfl.listPending();

  const runContext = latestRun
    ? `## Latest Pipeline Run
- Run ID: ${latestRun.id}
- Pipeline: ${latestRun.pipeline_id}
- Status: ${latestRun.status}
- Duration: ${((latestRun.total_duration_ms ?? 0) / 1000).toFixed(1)}s
- Client: ${latestRun.usage?.agent_client_id ?? 'N/A'}
- Stages completed: ${latestRun.context.stage_results.size}`
    : '## Latest Pipeline Run\nNo pipeline runs yet. Use the Command Center to trigger a run.';

  const hflContext =
    pendingDecisions.length > 0
      ? `## Pending HFL Decisions (${pendingDecisions.length} awaiting review)\n${pendingDecisions
          .map(
            (d) =>
              `- Run ${d.run_id.slice(0, 8)} | urgency: ${d.urgency} | ${d.reason}`,
          )
          .join('\n')}`
      : '## HFL Decisions\nNo pending decisions — pipeline is running autonomously.';

  return `You are the Plinth Assistant — the conversational interface to Plinth, an agentic media intelligence platform by Polanyi that helps agencies recover waste and optimize advertising spend.

## Your Role

<primary>
Expert in Bayesian Marketing Mix Modeling (MMM), specialized in:
- Causal inference of marketing effects
- Geo-temporal hierarchical modeling
- Advertising budget optimization
- Uncertainty quantification in estimates
- AdOps implementation and campaign optimization across Meta, Google Ads, DV360, TikTok Ads, and Amazon Ads
</primary>

<secondary>
- Multi-platform marketing data analyst
- Media strategy consultant
- Adstock and saturation transformation specialist
- Incrementality experiment calibration expert
</secondary>

## Live Platform Context

${runContext}

${hflContext}

## Available Actions

When the user asks you to perform an action, confirm it and embed the action tag so the system can execute it:
- **Approve a run**: include [ACTION:APPROVE_RUN:runId] in your response
- **Reject a run**: include [ACTION:REJECT_RUN:runId] in your response
- **Trigger pipeline**: include [ACTION:RUN_PIPELINE:full-optimization] in your response

## Communication Style
- Respond in the same language as the user (Spanish or English)
- Be concise and precise — this is a professional tool for media practitioners
- Use actual numbers from context above when available; never fabricate data
- Format with markdown for clarity (bold, bullet lists, code blocks for IDs)
- For actions: confirm what you are doing before embedding the action tag`;
}

// ─── Action detection & execution ─────────────────────────────────────

type DetectedAction =
  | { type: 'approve_run'; run_id: string }
  | { type: 'reject_run'; run_id: string }
  | { type: 'run_pipeline'; pipeline_id: string };

function detectActions(text: string): DetectedAction[] {
  const actions: DetectedAction[] = [];
  const approveRe = /\[ACTION:APPROVE_RUN:([^\]]+)\]/g;
  const rejectRe = /\[ACTION:REJECT_RUN:([^\]]+)\]/g;
  const pipelineRe = /\[ACTION:RUN_PIPELINE:([^\]]+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = approveRe.exec(text)) !== null) {
    actions.push({ type: 'approve_run', run_id: m[1]! });
  }
  while ((m = rejectRe.exec(text)) !== null) {
    actions.push({ type: 'reject_run', run_id: m[1]! });
  }
  while ((m = pipelineRe.exec(text)) !== null) {
    actions.push({ type: 'run_pipeline', pipeline_id: m[1]! });
  }
  return actions;
}

function stripActionTags(text: string): string {
  return text.replace(/\[ACTION:[^\]]+\]/g, '').trim();
}

async function executeActions(
  actions: DetectedAction[],
  hfl: HFLCoordinator,
  mesh: MeshCoordinator,
): Promise<Array<{ type: string; result: unknown }>> {
  const results: Array<{ type: string; result: unknown }> = [];
  for (const action of actions) {
    try {
      if (action.type === 'approve_run') {
        const decision = await hfl.approveRun(action.run_id, 'Approved via Plinth Assistant');
        results.push({ type: 'approve_run', result: { run_id: action.run_id, status: decision ? 'approved' : 'not_found' } });
      } else if (action.type === 'reject_run') {
        const decision = await hfl.rejectRun(action.run_id, 'Rejected via Plinth Assistant');
        results.push({ type: 'reject_run', result: { run_id: action.run_id, status: decision ? 'rejected' : 'not_found' } });
      } else if (action.type === 'run_pipeline') {
        void mesh.executePipeline(action.pipeline_id).catch(() => {});
        results.push({ type: 'run_pipeline', result: { pipeline_id: action.pipeline_id, status: 'triggered' } });
      }
    } catch {
      results.push({ type: action.type, result: { error: 'action_failed' } });
    }
  }
  return results;
}

// ─── Route factory ─────────────────────────────────────────────────────

export function assistantRoutes(
  llmConfig: LLMConfig,
  mesh: MeshCoordinator,
  hfl: HFLCoordinator,
) {
  const app = new Hono();

  // ─── POST /v1/assistant/chat ─────────────────────────────────────────
  app.post('/v1/assistant/chat', async (c) => {
    try {
      const body = await c.req.json<{
        message: string;
        conversation_id?: string;
        context?: { run_id?: string; client_id?: string };
      }>();

      if (!body.message?.trim()) {
        return c.json({ error: 'message is required' }, 400);
      }

      // Get or create conversation
      let conv = body.conversation_id ? conversations.get(body.conversation_id) : undefined;
      if (!conv) {
        conv = {
          id: ulid(),
          title: body.message.slice(0, 60),
          messages: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        conversations.set(conv.id, conv);
      }

      // Append user message
      const userMsg: ConvMessage = {
        id: ulid(),
        role: 'user',
        content: body.message,
        timestamp: new Date().toISOString(),
      };
      conv.messages.push(userMsg);

      // Build LLM message list (system + history)
      const systemPrompt = buildSystemPrompt(mesh, hfl);
      const llmMessages = [
        { role: 'system' as const, content: systemPrompt },
        ...conv.messages.map((m) => ({
          role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
          content: m.content,
        })),
      ];

      // Call Claude (or DeepSeek fallback)
      const llmResponse = await callLLM(
        { ...llmConfig, maxTokens: 2048, temperature: 0.4 },
        llmMessages,
      );

      // Detect + execute embedded actions
      const detectedActions = detectActions(llmResponse.content);
      const actionResults =
        detectedActions.length > 0 ? await executeActions(detectedActions, hfl, mesh) : [];

      const cleanContent = stripActionTags(llmResponse.content);

      // Append assistant message
      const assistantMsg: ConvMessage = {
        id: ulid(),
        role: 'assistant',
        content: cleanContent,
        timestamp: new Date().toISOString(),
        actions: actionResults.length > 0 ? actionResults : undefined,
      };
      conv.messages.push(assistantMsg);
      conv.updated_at = new Date().toISOString();

      return c.json({
        conversation_id: conv.id,
        message: {
          id: assistantMsg.id,
          role: 'assistant' as const,
          content: cleanContent,
          timestamp: assistantMsg.timestamp,
          actions: actionResults.length > 0 ? actionResults : undefined,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal error';
      return c.json({ error: 'chat_failed', message }, 500);
    }
  });

  // ─── GET /v1/assistant/conversations ─────────────────────────────────
  app.get('/v1/assistant/conversations', (c) => {
    const list = Array.from(conversations.values())
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .map(({ id, title, created_at, updated_at, messages }) => ({
        id,
        title,
        created_at,
        updated_at,
        message_count: messages.length,
        preview: messages.at(-2)?.content?.slice(0, 80) ?? '',
      }));
    return c.json({ conversations: list });
  });

  // ─── GET /v1/assistant/conversations/:id ─────────────────────────────
  app.get('/v1/assistant/conversations/:id', (c) => {
    const id = c.req.param('id');
    const conv = conversations.get(id);
    if (!conv) {
      return c.json({ error: 'not_found', message: `Conversation ${id} not found` }, 404);
    }
    return c.json(conv);
  });

  // ─── DELETE /v1/assistant/conversations/:id ───────────────────────────
  app.delete('/v1/assistant/conversations/:id', (c) => {
    const id = c.req.param('id');
    const existed = conversations.delete(id);
    if (!existed) return c.json({ error: 'not_found' }, 404);
    return c.json({ deleted: id });
  });

  return app;
}
