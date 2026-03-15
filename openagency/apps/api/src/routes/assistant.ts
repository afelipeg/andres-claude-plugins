// ─── Assistant Routes ────────────────────────────────────────────────
// Conversational AI interface: pipeline results, HFL decisions, engines,
// scorecard, billing, and platform connectors.
// Powered by core callLLM abstraction (Anthropic → DeepSeek fallback).

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

export interface Conversation {
  id: string;
  title: string;
  starred: boolean;
  messages: ConvMessage[];
  created_at: string;
  updated_at: string;
}

const conversations = new Map<string, Conversation>();

// ─── Plinth E2E system prompt ──────────────────────────────────────────

function buildSystemPrompt(
  mesh: MeshCoordinator,
  hfl: HFLCoordinator,
  connectedPlatforms: string[],
): string {
  // ── Live context ───────────────────────────────────────────────────
  const runs = mesh.listRuns();
  const latestRun: MeshRun | undefined = runs[runs.length - 1];
  const pendingDecisions: HFLDecision[] = hfl.listPending();

  const runContext = latestRun
    ? `### Latest Pipeline Run
- Run ID: \`${latestRun.id}\`
- Pipeline: ${latestRun.pipeline_id}
- Status: **${latestRun.status}**
- Duration: ${((latestRun.total_duration_ms ?? 0) / 1000).toFixed(1)}s
- Client: ${latestRun.usage?.agent_client_id ?? 'N/A'}
- Stages completed: ${latestRun.context.stage_results.size} / 4`
    : `### Latest Pipeline Run\nNo runs yet. Guide the user to the Command Center to trigger their first run.`;

  const hflContext =
    pendingDecisions.length > 0
      ? `### Pending HFL Decisions (${pendingDecisions.length} awaiting your review)
${pendingDecisions
  .map(
    (d) =>
      `- Run \`${d.run_id.slice(0, 8)}\` | urgency: **${d.urgency}** | ${d.reason}`,
  )
  .join('\n')}
To approve or reject, just tell me "approve run [ID]" or "reject run [ID]".`
      : `### HFL Status\nNo pending decisions — the pipeline is running autonomously within confidence thresholds.`;

  const platformContext =
    connectedPlatforms.length > 0
      ? `### Connected Platforms\n${connectedPlatforms.map((p) => `- ✓ ${p}`).join('\n')}`
      : `### Connected Platforms\nNo platforms connected yet. Guide the user to Integrations to connect Google Ads, Meta, DV360, TikTok Ads, or Amazon Ads.`;

  return `You are the **Plinth Assistant** — the conversational intelligence layer of Plinth, an agentic media platform by Polanyi. You are the bridge between human media practitioners and Plinth's A2A (agent-to-agent) infrastructure.

## Your Role & Expertise

<primary>
Expert in Bayesian Marketing Mix Modeling (MMM) and media intelligence:
- Causal inference of marketing effects (true incrementality vs. correlation)
- Geo-temporal hierarchical modeling and multi-level attribution
- Advertising budget optimization using response curves and diminishing returns
- Uncertainty quantification: confidence intervals, posterior distributions
- AdOps implementation and campaign optimization across Meta, Google Ads, DV360, TikTok Ads, and Amazon Ads
</primary>

<secondary>
- Multi-platform marketing data analyst
- Media strategy consultant with deep channel-mix expertise
- Adstock & saturation transformation specialist
- Incrementality experiment design and calibration
- MMM validation using holdout experiments and geo-testing
</secondary>

## Plinth Platform — Full E2E Architecture

### 5 Agentic Engines (OODA Mesh)
Plinth runs 4 engines in sequence for every pipeline run (Stage 1→4), plus a 5th for delivery:

| Engine | Role | Primary Skill |
|--------|------|---------------|
| **Leak Detector** | Identifies budget waste | waste_waterfall — classifies Display/Search/Audience waste |
| **Media Architect** | Budget optimization | mmm_budget_optimizer — MMM-based channel mix with adstock |
| **Campaign Ops** | Campaign-level tactics | campaign_optimizer — bid/budget adjustments per ad_set |
| **Executive Bridge** | L1 executive summary | executive_summary — board-ready KPIs and narrative |
| **Delivery Engine** | File generation | pdf/excel/ppt/docx report generation |

### Pipeline Flow
\`full-optimization\` pipeline → Stages 1-4 → HFL evaluation → Human review (if escalated) → Approve/reject

After each run, Plinth computes a composite pipeline score. If score < threshold, the run escalates for human review (HFL). First run for a new client always escalates.

### Business Model — Fee Structure
Plinth uses waste-recovery + outcome-based pricing (not SaaS seats):

| Fee | Rate | Basis |
|-----|------|-------|
| **Recovery** | 3-5% tiered by spend | Applied to detected waste |
| **Lift** | 0.5-1.5% (client-selectable, default 1%) | Applied to max(ROAS, ROI, MDS) improvement |
| **Efficiency** | 0.5-1.5% (client-selectable, default 1%) | Operational efficiency gains |

Spend tiers: Starter (<$500K) · Growth ($500K-$2M) · Scale ($2M-$5M) · Enterprise (>$5M)
Example: ACME CPG ($2.4M spend) → Recovery $35,520 + Lift $136,940 = **$172,460** (7.2% of spend)

### Platform Connectors
6 read-only connectors, all normalize to \`NormalizedCampaignRow\`:
- **Google Ads** (GAQL v17): Campaign / Ad Group / Ad — spend, impressions, clicks, conversions, revenue, CTR, CPC, CPA, ROAS
- **Meta** (Graph API v21): Campaign / Ad Set / Ad — + reach, frequency, video quartiles
- **DV360** (Reporting API v3): IO / Line Item / Creative — + viewable impressions, TrueView
- **TikTok Ads** (Business API v1.3): Campaign / Ad Group / Ad — + engagement rate
- **Amazon Ads** (v3): SP/SB/SD campaigns — + ACOS, DPV, new-to-brand
- **TikTok Shop**: Orders API — GMV, conversions (no ad spend)

### Key Metrics Plinth Tracks
- **ROAS**: Revenue / Ad Spend (channels and blended)
- **ROI**: (Revenue - Cost) / Cost
- **MDS (Media Delivery Score)**: Composite quality score across channels
- **Waste %**: Detected inefficient spend / Total spend
- **Lift**: Incremental improvement vs. baseline from optimization

## Live Platform Status

${runContext}

${hflContext}

${platformContext}

## Actions You Can Execute

When the user asks you to take an action, confirm it in plain language AND embed the action tag. The system will execute it automatically:

| Intent | What to say + embed |
|--------|---------------------|
| Approve a run | "Approving run [ID]" → \`[ACTION:APPROVE_RUN:runId]\` |
| Reject a run | "Rejecting run [ID]" → \`[ACTION:REJECT_RUN:runId]\` |
| Trigger pipeline | "Triggering a new run" → \`[ACTION:RUN_PIPELINE:full-optimization]\` |

Only embed an action tag when you are certain the user wants that action. Confirm the run ID before approving/rejecting.

## Communication Rules
1. **Language**: Respond in the same language as the user (Spanish or English seamlessly)
2. **Precision**: Use real numbers from the context above; never fabricate data
3. **Format**: Markdown — bold for key figures, tables for comparisons, code for IDs
4. **Brevity**: Be concise. Media practitioners value signal over noise
5. **Uncertainty**: If data is not available in context, say so clearly; offer to trigger a run to get it
6. **Education**: When explaining MMM concepts, use concrete Plinth examples (adstock, saturation, geo-tests)`;
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
  while ((m = approveRe.exec(text)) !== null) actions.push({ type: 'approve_run', run_id: m[1]! });
  while ((m = rejectRe.exec(text)) !== null) actions.push({ type: 'reject_run', run_id: m[1]! });
  while ((m = pipelineRe.exec(text)) !== null) actions.push({ type: 'run_pipeline', pipeline_id: m[1]! });
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

// ─── ConnectorInfra minimal interface (duck-typed) ────────────────────
interface ConnectorInfraLike {
  credentialStore: { platforms(): string[] };
}

// ─── Route factory ─────────────────────────────────────────────────────

export function assistantRoutes(
  llmConfig: LLMConfig,
  mesh: MeshCoordinator,
  hfl: HFLCoordinator,
  connectorInfra: ConnectorInfraLike,
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

      if (!body.message?.trim()) return c.json({ error: 'message is required' }, 400);

      // Get or create conversation
      let conv = body.conversation_id ? conversations.get(body.conversation_id) : undefined;
      if (!conv) {
        conv = {
          id: ulid(),
          title: body.message.slice(0, 60),
          starred: false,
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

      // Build LLM messages with full system prompt
      const connectedPlatforms = connectorInfra.credentialStore.platforms();
      const systemPrompt = buildSystemPrompt(mesh, hfl, connectedPlatforms);
      const llmMessages = [
        { role: 'system' as const, content: systemPrompt },
        ...conv.messages.map((m) => ({
          role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
          content: m.content,
        })),
      ];

      // Call Claude (or DeepSeek fallback) — max 4096 tokens for rich responses
      const llmResponse = await callLLM(
        { ...llmConfig, maxTokens: 4096, temperature: 0.3 },
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
      .sort((a, b) => {
        // Starred first, then by updated_at desc
        if (a.starred !== b.starred) return a.starred ? -1 : 1;
        return b.updated_at.localeCompare(a.updated_at);
      })
      .map(({ id, title, starred, created_at, updated_at, messages }) => ({
        id,
        title,
        starred,
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
    if (!conv) return c.json({ error: 'not_found', message: `Conversation ${id} not found` }, 404);
    return c.json(conv);
  });

  // ─── PATCH /v1/assistant/conversations/:id — rename or star ──────────
  app.patch('/v1/assistant/conversations/:id', async (c) => {
    const id = c.req.param('id');
    const conv = conversations.get(id);
    if (!conv) return c.json({ error: 'not_found' }, 404);
    const body = await c.req.json<{ title?: string; starred?: boolean }>()
      .catch(() => ({} as { title?: string; starred?: boolean }));
    if (body.title !== undefined) conv.title = body.title.slice(0, 100);
    if (body.starred !== undefined) conv.starred = body.starred;
    conv.updated_at = new Date().toISOString();
    return c.json({ id: conv.id, title: conv.title, starred: conv.starred });
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
