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
import { ConversationRepo, type ConversationRecord, type ConvMessage } from '@openagency/memory';
import type { OpenAgency } from '@openagency/core';

// ─── Anthropic tool use types ─────────────────────────────────────────

interface AnthropicToolProperty {
  type: string;
  description?: string;
  enum?: string[];
}

interface AnthropicTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, AnthropicToolProperty>;
    required: string[];
  };
}

interface AnthropicContentBlock {
  type: 'text' | 'tool_use';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

interface AnthropicMessageResponse {
  content: AnthropicContentBlock[];
  stop_reason: 'end_turn' | 'tool_use' | 'max_tokens';
  model: string;
  usage: { input_tokens: number; output_tokens: number };
}

// ─── Plinth tool definitions ──────────────────────────────────────────

const PLINTH_TOOLS: AnthropicTool[] = [
  {
    name: 'approve_run',
    description: 'Approve a pipeline run that is pending HFL (Human Feedback Loop) review. Use when the user asks to approve a run.',
    input_schema: {
      type: 'object',
      properties: {
        run_id: { type: 'string', description: 'Full ULID of the run to approve' },
        feedback: { type: 'string', description: 'Optional approval message or comments' },
      },
      required: ['run_id'],
    },
  },
  {
    name: 'reject_run',
    description: 'Reject a pipeline run that is pending HFL review. Use when the user asks to reject, decline, or deny a run.',
    input_schema: {
      type: 'object',
      properties: {
        run_id: { type: 'string', description: 'Full ULID of the run to reject' },
        feedback: { type: 'string', description: 'Reason for rejection (required for audit trail)' },
      },
      required: ['run_id'],
    },
  },
  {
    name: 'run_pipeline',
    description: 'Trigger a new pipeline run. Use when the user asks to run, re-run, start, or execute the pipeline.',
    input_schema: {
      type: 'object',
      properties: {
        pipeline_id: {
          type: 'string',
          description: "Pipeline to execute. 'full-optimization' runs all 4 engines. 'full-with-deliverables' also generates reports.",
          enum: ['full-optimization', 'full-with-deliverables'],
        },
        client_id: { type: 'string', description: 'Client identifier (optional, defaults to current context)' },
      },
      required: ['pipeline_id'],
    },
  },
  {
    name: 'get_pipeline_status',
    description: 'Get the current status of the latest pipeline run and any pending HFL decisions. Use when the user asks "what happened", "show me the status", or similar.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'generate_report',
    description: 'Generate a report using the Delivery Engine (Engine 5). Returns a download URL.',
    input_schema: {
      type: 'object',
      properties: {
        format: {
          type: 'string',
          description: 'Output format',
          enum: ['pdf', 'excel', 'ppt', 'docx'],
        },
        report_type: {
          type: 'string',
          description: "Type of report content: 'executive_summary', 'campaign_performance', 'budget_analysis', 'full_report'",
          enum: ['executive_summary', 'campaign_performance', 'budget_analysis', 'full_report'],
        },
      },
      required: ['format'],
    },
  },
];

// ─── In-memory fallback store (used when DB unavailable) ──────────────

interface ConvMessageLocal {
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
  messages: ConvMessageLocal[];
  created_at: string;
  updated_at: string;
}

const memConversations = new Map<string, Conversation>();

// ─── Unified conversation store (DB-first, Map fallback) ──────────────

let convRepo: ConversationRepo | null = null;

export function setConversationRepo(repo: ConversationRepo): void {
  convRepo = repo;
}

async function getConv(id: string): Promise<Conversation | null> {
  if (convRepo) {
    const r = await convRepo.findById(id).catch(() => null);
    if (!r) return null;
    return {
      id: r.id, title: r.title, starred: r.starred,
      created_at: r.created_at, updated_at: r.updated_at,
      messages: r.messages.map((m) => ({
        id: m.id, role: m.role, content: m.content,
        timestamp: m.timestamp, actions: m.actions,
      })),
    };
  }
  return memConversations.get(id) ?? null;
}

async function saveConv(conv: Conversation): Promise<void> {
  if (convRepo) {
    const record: ConversationRecord = {
      id: conv.id, title: conv.title, starred: conv.starred,
      run_type: 'standard', created_at: conv.created_at, updated_at: conv.updated_at,
      message_count: conv.messages.length,
      messages: conv.messages.map((m) => ({
        id: m.id, role: m.role, content: m.content,
        timestamp: m.timestamp, actions: m.actions,
      } as ConvMessage)),
    };
    await convRepo.save(record).catch(() => {});
  }
  memConversations.set(conv.id, conv);
}

async function listConvSummaries(): Promise<Array<{
  id: string; title: string; starred: boolean; created_at: string; updated_at: string;
  message_count: number; preview: string;
}>> {
  if (convRepo) {
    const rows = await convRepo.list().catch(() => []);
    return rows.map((r) => ({
      id: r.id, title: r.title, starred: r.starred,
      created_at: r.created_at, updated_at: r.updated_at,
      message_count: r.message_count, preview: r.preview,
    }));
  }
  return Array.from(memConversations.values())
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .map(({ id, title, starred, created_at, updated_at, messages }) => ({
      id, title, starred, created_at, updated_at,
      message_count: messages.length,
      preview: messages.at(-2)?.content?.slice(0, 80) ?? '',
    }));
}

async function deleteConv(id: string): Promise<boolean> {
  if (convRepo) await convRepo.delete(id).catch(() => {});
  return memConversations.delete(id);
}

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

// ─── Anthropic tool execution ─────────────────────────────────────────

async function executeTool(
  name: string,
  input: Record<string, unknown>,
  mesh: MeshCoordinator,
  hfl: HFLCoordinator,
  agency?: OpenAgency,
): Promise<{ type: string; result: unknown }> {
  try {
    switch (name) {
      case 'approve_run': {
        const runId = input['run_id'] as string;
        const feedback = (input['feedback'] as string | undefined) ?? 'Approved via Plinth Assistant';
        const decision = await hfl.approveRun(runId, feedback);
        return { type: 'approve_run', result: { run_id: runId, status: decision ? 'approved' : 'not_found' } };
      }
      case 'reject_run': {
        const runId = input['run_id'] as string;
        const feedback = (input['feedback'] as string | undefined) ?? 'Rejected via Plinth Assistant';
        const decision = await hfl.rejectRun(runId, feedback);
        return { type: 'reject_run', result: { run_id: runId, status: decision ? 'rejected' : 'not_found' } };
      }
      case 'run_pipeline': {
        const pipelineId = (input['pipeline_id'] as string) ?? 'full-optimization';
        const clientId = input['client_id'] as string | undefined;
        void mesh.executePipeline(pipelineId, undefined, clientId).catch(() => {});
        return { type: 'run_pipeline', result: { pipeline_id: pipelineId, status: 'triggered' } };
      }
      case 'get_pipeline_status': {
        const runs = mesh.listRuns();
        const latest = runs[runs.length - 1];
        const pending = hfl.listPending();
        return {
          type: 'get_pipeline_status',
          result: {
            latest_run: latest
              ? {
                  run_id: latest.id,
                  pipeline: latest.pipeline_id,
                  status: latest.status,
                  duration_s: ((latest.total_duration_ms ?? 0) / 1000).toFixed(1),
                  client: latest.usage?.agent_client_id ?? 'N/A',
                  stages_completed: latest.context.stage_results.size,
                }
              : null,
            pending_decisions: pending.map((d) => ({
              run_id: d.run_id,
              urgency: d.urgency,
              reason: d.reason,
            })),
          },
        };
      }
      case 'generate_report': {
        const format = (input['format'] as string) ?? 'pdf';
        const reportType = (input['report_type'] as string) ?? 'executive_summary';

        // Map format to delivery skill ID
        const skillMap: Record<string, string> = {
          pdf: 'monthly-report',
          excel: 'client-scorecard-export',
          ppt: 'media-plan-deck',
          docx: 'campaign-brief',
        };
        const skillId = skillMap[format] ?? 'monthly-report';

        if (agency) {
          try {
            const latestRun = mesh.listRuns().at(-1);
            const deliveryInput = {
              output_formats: [format === 'ppt' ? 'pptx' : format === 'excel' ? 'xlsx' : format],
              report_type: reportType,
              client_id: latestRun?.usage?.agent_client_id ?? 'default',
              run_id: latestRun?.id,
              title: `${reportType.replace(/_/g, ' ')} — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
            };
            const result = await (agency.run('delivery', skillId, deliveryInput) as Promise<unknown>);
            const output = result as Record<string, unknown>;
            const fileId = (output['file_id'] as string | undefined) ?? (output['id'] as string | undefined);
            const baseUrl = process.env['API_BASE_URL'] ?? 'http://localhost:3100';
            return {
              type: 'generate_report',
              result: {
                format,
                skill_id: skillId,
                file_id: fileId,
                status: fileId ? 'ready' : 'generated',
                download_url: fileId ? `${baseUrl}/v1/delivery/files/${fileId}/download` : null,
                message: fileId
                  ? `Your ${format.toUpperCase()} report is ready. Download URL: ${baseUrl}/v1/delivery/files/${fileId}/download`
                  : `Report generated successfully.`,
              },
            };
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Generation failed';
            return {
              type: 'generate_report',
              result: { format, skill_id: skillId, status: 'error', message: msg },
            };
          }
        }

        return {
          type: 'generate_report',
          result: {
            format, skill_id: skillId, status: 'queued',
            message: `Report queued. Use /v1/delivery/files to check status and download.`,
          },
        };
      }
      default:
        return { type: name, result: { error: `Unknown tool: ${name}` } };
    }
  } catch {
    return { type: name, result: { error: 'tool_execution_failed' } };
  }
}

// ─── Anthropic native tool use call ──────────────────────────────────
// Handles multi-turn tool execution: send → tool_use → execute → final response.
// Falls back to text-based action detection for non-Anthropic providers.

async function callWithTools(
  llmMessages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  mesh: MeshCoordinator,
  hfl: HFLCoordinator,
  agencyRef?: OpenAgency,
): Promise<{ text: string; actions: Array<{ type: string; result: unknown }> }> {
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY required for tool use');

  const systemMsg = llmMessages.find((m) => m.role === 'system');
  const userMsgs = llmMessages.filter((m) => m.role !== 'system');

  // Turn 1: send messages + tools
  const res1 = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      temperature: 0.3,
      system: systemMsg?.content,
      tools: PLINTH_TOOLS,
      messages: userMsgs.map((m) => ({ role: m.role, content: m.content })),
    }),
  });

  if (!res1.ok) {
    const err = await res1.text();
    throw new Error(`Anthropic API error (${res1.status}): ${err}`);
  }

  const data1 = (await res1.json()) as AnthropicMessageResponse;

  // No tool use — just return text
  if (data1.stop_reason !== 'tool_use') {
    const text = data1.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('');
    return { text, actions: [] };
  }

  // Execute tools
  const toolUseBlocks = data1.content.filter((b) => b.type === 'tool_use');
  const actions: Array<{ type: string; result: unknown }> = [];
  const toolResults: Array<{ type: 'tool_result'; tool_use_id: string; content: string }> = [];

  for (const block of toolUseBlocks) {
    if (!block.id || !block.name) continue;
    const action = await executeTool(block.name, block.input ?? {}, mesh, hfl, agencyRef);
    actions.push(action);
    toolResults.push({
      type: 'tool_result',
      tool_use_id: block.id,
      content: JSON.stringify(action.result),
    });
  }

  // Turn 2: send tool results, get final response
  const messagesWithTools = [
    ...userMsgs.map((m) => ({ role: m.role, content: m.content })),
    { role: 'assistant' as const, content: data1.content },
    { role: 'user' as const, content: toolResults },
  ];

  const res2 = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      temperature: 0.3,
      system: systemMsg?.content,
      tools: PLINTH_TOOLS,
      messages: messagesWithTools,
    }),
  });

  if (!res2.ok) {
    const err = await res2.text();
    throw new Error(`Anthropic API error turn 2 (${res2.status}): ${err}`);
  }

  const data2 = (await res2.json()) as AnthropicMessageResponse;
  const text = data2.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('');

  return { text, actions };
}

// ─── Auto-create conversation on pipeline completion ──────────────────
// Called by app.ts after HFL evaluates a completed pipeline run.
// Generates an LLM briefing proactively and stores it in the conv Map.

export async function autoCreatePipelineConversation(
  run: MeshRun,
  llmConfig: LLMConfig,
  mesh: MeshCoordinator,
  hfl: HFLCoordinator,
  connectedPlatforms: string[],
): Promise<string> {
  const pending = hfl.listPending();
  const thisPending = pending.find((d) => d.run_id === run.id);
  const duration = ((run.total_duration_ms ?? 0) / 1000).toFixed(1);
  const clientId = run.usage?.agent_client_id ?? 'N/A';
  const stageCount = run.context.stage_results.size;

  // Synthetic trigger message — becomes the first user turn that Claude responds to
  const triggerMsg = `A pipeline run just completed. Generate a comprehensive briefing for the operator:

Run ID: ${run.id}
Pipeline: ${run.pipeline_id}
Status: ${run.status}
Client: ${clientId}
Duration: ${duration}s
Stages completed: ${stageCount}/4
HFL Decision: ${thisPending
    ? `ESCALATED — urgency: ${thisPending.urgency} — ${thisPending.reason}`
    : 'auto-approved (no human review needed)'}

Your briefing must cover:
1. What each engine found (waste, optimizations, campaign insights, executive KPIs)
2. Key numbers — waste %, estimated Recovery/Lift/Efficiency fees
3. Whether human approval is required and why
4. Your recommendation: approve, reject, or re-run

End with a direct question asking the operator what they'd like to do next.`;

  const systemPrompt = buildSystemPrompt(mesh, hfl, connectedPlatforms);
  const llmMessages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: triggerMsg },
  ];

  const response = await callLLM({ ...llmConfig, maxTokens: 2048, temperature: 0.3 }, llmMessages);
  const content = stripActionTags(response.content);

  const dateLabel = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const clientLabel = clientId !== 'N/A' ? ` · ${clientId}` : '';
  const isHighUrgency = thisPending?.urgency === 'critical' || thisPending?.urgency === 'high';

  const convId = ulid();
  const conv: Conversation = {
    id: convId,
    title: `Pipeline Run ${dateLabel}${clientLabel}`,
    starred: isHighUrgency,
    messages: [
      {
        id: ulid(),
        role: 'assistant',
        content,
        timestamp: new Date().toISOString(),
      },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  await saveConv(conv);
  return convId;
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
  agencyRef?: OpenAgency,
  convRepoInstance?: ConversationRepo,
) {
  if (convRepoInstance) setConversationRepo(convRepoInstance);
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

      // Get or create conversation (DB-first, in-memory fallback)
      let conv: Conversation | null = body.conversation_id
        ? await getConv(body.conversation_id)
        : null;
      if (!conv) {
        conv = {
          id: ulid(),
          title: body.message.slice(0, 60),
          starred: false,
          messages: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }

      // Append user message
      const userMsg: ConvMessageLocal = {
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

      // Use Anthropic native tool use when available, text-based fallback otherwise
      let cleanContent: string;
      let actionResults: Array<{ type: string; result: unknown }> = [];

      if (llmConfig.provider === 'anthropic' && process.env['ANTHROPIC_API_KEY']) {
        const result = await callWithTools(llmMessages, mesh, hfl, agencyRef);
        cleanContent = result.text;
        actionResults = result.actions;
      } else {
        // DeepSeek / Ollama fallback — text-based action detection
        const llmResponse = await callLLM(
          { ...llmConfig, maxTokens: 4096, temperature: 0.3 },
          llmMessages,
        );
        const detectedActions = detectActions(llmResponse.content);
        actionResults =
          detectedActions.length > 0 ? await executeActions(detectedActions, hfl, mesh) : [];
        cleanContent = stripActionTags(llmResponse.content);
      }

      // Append assistant message
      const assistantMsg: ConvMessageLocal = {
        id: ulid(),
        role: 'assistant',
        content: cleanContent,
        timestamp: new Date().toISOString(),
        actions: actionResults.length > 0 ? actionResults : undefined,
      };
      conv.messages.push(assistantMsg);
      conv.updated_at = new Date().toISOString();
      await saveConv(conv);

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
  app.get('/v1/assistant/conversations', async (c) => {
    const list = await listConvSummaries();
    return c.json({ conversations: list });
  });

  // ─── GET /v1/assistant/conversations/:id ─────────────────────────────
  app.get('/v1/assistant/conversations/:id', async (c) => {
    const id = c.req.param('id');
    const conv = await getConv(id);
    if (!conv) return c.json({ error: 'not_found', message: `Conversation ${id} not found` }, 404);
    return c.json(conv);
  });

  // ─── PATCH /v1/assistant/conversations/:id — rename or star ──────────
  app.patch('/v1/assistant/conversations/:id', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json<{ title?: string; starred?: boolean }>()
      .catch(() => ({} as { title?: string; starred?: boolean }));
    // Update in DB
    if (convRepo) await convRepo.patch(id, body).catch(() => {});
    // Update in memory fallback
    const mem = memConversations.get(id);
    if (mem) {
      if (body.title !== undefined) mem.title = body.title.slice(0, 100);
      if (body.starred !== undefined) mem.starred = body.starred;
      mem.updated_at = new Date().toISOString();
    }
    return c.json({ id, title: body.title, starred: body.starred, updated: true });
  });

  // ─── DELETE /v1/assistant/conversations/:id ───────────────────────────
  app.delete('/v1/assistant/conversations/:id', async (c) => {
    const id = c.req.param('id');
    await deleteConv(id);
    return c.json({ deleted: id });
  });

  return app;
}
