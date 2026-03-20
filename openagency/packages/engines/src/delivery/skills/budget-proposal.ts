// ─── Skill: budget-proposal ──────────────────────────────────────────
// Generates a budget proposal (PDF/DOCX) using Layer-1 outputs to
// justify and structure a proposed media investment.
// Tier: standard (narrative-heavy, persuasive writing)

import type { BudgetProposalInput } from '@openagency/schemas';
import type { DeliverySkillOutput } from '@openagency/types';
import { generatePdf } from '../tools/file-generators/pdf-generator.js';
import { generateDocx } from '../tools/file-generators/docx-generator.js';
import {
  callDeliveryLLM,
  parseJsonResponse,
  persistGeneratedFile,
  summarizeLayerOne,
  tempPath,
} from './_skill-utils.js';

interface BudgetProposalLLM {
  rationale: string;
  investment_thesis: string;
  channel_allocation: { channel: string; amount: number; pct: number; rationale: string; kpi_targets: string[] }[];
  roi_projection: { scenario: string; projected_roas: string; projected_revenue: string; confidence: string }[];
  timeline: { phase: string; duration: string; budget: string; activities: string }[];
  risk_mitigations: { risk: string; mitigation: string }[];
  recommendations: string[];
  summary: string;
}

const SYSTEM_PROMPT = `You are a senior media strategist at Plinth by Polanyi.
Create a compelling budget proposal justifying a media investment using performance data.
Respond with valid JSON only.

JSON schema:
{
  "rationale": "2-3 paragraph investment rationale grounded in engine data",
  "investment_thesis": "One paragraph core investment thesis",
  "channel_allocation": [ { "channel": "Meta", "amount": 50000, "pct": 40, "rationale": "Why this allocation", "kpi_targets": ["CTR > 2%"] } ],
  "roi_projection": [ { "scenario": "Conservative", "projected_roas": "3.5x", "projected_revenue": "$175,000", "confidence": "High" } ],
  "timeline": [ { "phase": "Phase 1 - Launch", "duration": "Weeks 1-4", "budget": "$30,000", "activities": "Campaign setup and creative testing" } ],
  "risk_mitigations": [ { "risk": "Market saturation", "mitigation": "Diversify channels" } ],
  "recommendations": ["Priority action"],
  "summary": "One-sentence proposal summary"
}
Rules: Base projections on engine data. All amounts USD. Percentages must sum to 100. Tone: persuasive, CFO-ready.`;

const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export async function run(input: BudgetProposalInput): Promise<DeliverySkillOutput> {
  const context = summarizeLayerOne(input.layer_one_results);
  const prompt = `Client: ${input.client_id}\nProposed Budget: ${usd(input.proposed_budget)}\nPeriod: ${input.period_start} to ${input.period_end}\nObjectives: ${input.objectives?.join(', ') ?? 'Revenue growth, efficiency'}\n\nENGINE DATA:\n${context}\n\nGenerate the budget proposal.`;

  let llm: BudgetProposalLLM;
  let tokenUsage: { input_tokens: number; output_tokens: number } | undefined;
  try {
    const result = await callDeliveryLLM(SYSTEM_PROMPT, prompt, 'standard');
    tokenUsage = result.usage;
    llm = parseJsonResponse<BudgetProposalLLM>(result.content);
  } catch {
    llm = {
      rationale: `Budget proposal for ${usd(input.proposed_budget)} — ${input.period_start} to ${input.period_end}.`,
      investment_thesis: 'Data-driven media investment based on engine performance analysis.',
      channel_allocation: [{ channel: 'Mixed Channels', amount: input.proposed_budget, pct: 100, rationale: 'To be allocated.', kpi_targets: [] }],
      roi_projection: [{ scenario: 'Base Case', projected_roas: 'TBD', projected_revenue: 'TBD', confidence: 'Pending' }],
      timeline: [{ phase: 'Full Period', duration: `${input.period_start} – ${input.period_end}`, budget: usd(input.proposed_budget), activities: 'Media campaign execution.' }],
      risk_mitigations: [],
      recommendations: ['Review with ANTHROPIC_API_KEY configured.'],
      summary: `Budget proposal for ${usd(input.proposed_budget)}.`,
    };
  }

  const title = 'Media Investment Proposal';
  const subtitle = `${usd(input.proposed_budget)}  ·  ${input.period_start} → ${input.period_end}  ·  ${input.client_id}`;
  const formats = input.output_formats ?? ['pdf'];
  const primaryFormat = formats[0]!;

  const sections = [
    { heading: 'Investment Rationale', content: llm.rationale },
    { heading: 'Investment Thesis', content: llm.investment_thesis },
    { heading: 'Channel Allocation', content: '', table: { headers: ['Channel', 'Budget', '% of Total', 'Rationale', 'KPI Targets'], rows: llm.channel_allocation.map(c => [c.channel, usd(c.amount), `${c.pct}%`, c.rationale, c.kpi_targets.join(', ') || '—']) } },
    { heading: 'ROI Projections', content: '', table: { headers: ['Scenario', 'Projected ROAS', 'Projected Revenue', 'Confidence'], rows: llm.roi_projection.map(r => [r.scenario, r.projected_roas, r.projected_revenue, r.confidence]) } },
    { heading: 'Execution Timeline', content: '', table: { headers: ['Phase', 'Duration', 'Budget', 'Activities'], rows: llm.timeline.map(t => [t.phase, t.duration, t.budget, t.activities]) } },
    { heading: 'Risk Mitigations', content: llm.risk_mitigations.map(r => `${r.risk}: ${r.mitigation}`).join('\n') },
    { heading: 'Recommendations', content: llm.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n') },
  ];

  let localPath: string;
  let sizeBytes: number;

  if (primaryFormat === 'docx') {
    localPath = tempPath('docx');
    const r = await generateDocx({ title, subtitle, sections, output_path: localPath });
    sizeBytes = r.size_bytes;
  } else {
    localPath = tempPath('pdf');
    const r = await generatePdf({ title, subtitle, sections, output_path: localPath });
    sizeBytes = r.size_bytes;
  }

  const { fileOutput } = await persistGeneratedFile({ clientId: input.client_id, skillId: 'budget-proposal', runId: input.run_id, fileType: primaryFormat, localPath, sizeBytes });

  const output: DeliverySkillOutput = { skill_id: 'budget-proposal', file: fileOutput, summary: llm.summary, generated_at: new Date().toISOString() };
  if (tokenUsage) {
    (output as DeliverySkillOutput & { token_usage?: unknown }).token_usage = tokenUsage;
  }
  return output;
}
