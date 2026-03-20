// ─── Skill: campaign-brief ───────────────────────────────────────────
// Generates a creative campaign brief (DOCX/PDF) using engine insights
// to inform strategic positioning, audience, and media approach.
// Tier: standard (narrative-heavy, creative strategy)

import type { CampaignBriefInput } from '@openagency/schemas';
import type { DeliverySkillOutput } from '@openagency/types';
import { generateDocx } from '../tools/file-generators/docx-generator.js';
import { generatePdf } from '../tools/file-generators/pdf-generator.js';
import {
  callDeliveryLLM,
  parseJsonResponse,
  persistGeneratedFile,
  summarizeLayerOne,
  tempPath,
} from './_skill-utils.js';

interface CampaignBriefLLM {
  campaign_overview: string;
  background: string;
  target_audience: { primary: string; secondary: string; psychographic: string; behavioral: string };
  key_message: string;
  supporting_messages: string[];
  tone_and_voice: string;
  creative_requirements: { format: string; specs: string; notes: string }[];
  media_strategy: string;
  channels: { channel: string; role: string; budget_pct: string }[];
  kpis: { kpi: string; target: string; measurement: string }[];
  timeline: { milestone: string; date: string; owner: string }[];
  mandatories: string[];
  summary: string;
}

const SYSTEM_PROMPT = `You are a senior brand strategist at Plinth by Polanyi.
Create a comprehensive creative campaign brief grounded in performance data.
Respond with valid JSON only.

JSON schema:
{
  "campaign_overview": "2-paragraph campaign overview",
  "background": "Context and strategic rationale from engine data",
  "target_audience": { "primary": "Primary audience description", "secondary": "Secondary", "psychographic": "Mindset and values", "behavioral": "Digital behavior patterns" },
  "key_message": "Single core campaign message",
  "supporting_messages": ["Supporting message"],
  "tone_and_voice": "Brand tone description",
  "creative_requirements": [ { "format": "Social Video 15s", "specs": "1080x1920px, MP4", "notes": "Key note" } ],
  "media_strategy": "Media strategy paragraph",
  "channels": [ { "channel": "Meta", "role": "Awareness", "budget_pct": "40%" } ],
  "kpis": [ { "kpi": "CTR", "target": "> 2%", "measurement": "Platform native" } ],
  "timeline": [ { "milestone": "Creative production", "date": "Week 1-2", "owner": "Creative team" } ],
  "mandatories": ["Brand logo always present"],
  "summary": "One-sentence brief summary"
}
Rules: Ground audience insights in engine data. KPIs must be measurable. Tone: strategic, creative-team-ready.`;

export async function run(input: CampaignBriefInput): Promise<DeliverySkillOutput> {
  const context = summarizeLayerOne(input.layer_one_results);
  const prompt = `Campaign: ${input.campaign_name}\nObjective: ${input.objective}\nBudget: ${input.budget ? `$${input.budget.toLocaleString()}` : 'TBD'}\nClient: ${input.client_id}\n\nENGINE INSIGHTS:\n${context}\n\nGenerate the campaign brief.`;

  let llm: CampaignBriefLLM;
  let tokenUsage: { input_tokens: number; output_tokens: number } | undefined;
  try {
    const result = await callDeliveryLLM(SYSTEM_PROMPT, prompt, 'standard');
    tokenUsage = result.usage;
    llm = parseJsonResponse<CampaignBriefLLM>(result.content);
  } catch {
    llm = {
      campaign_overview: `Campaign brief for "${input.campaign_name}" — ${input.objective}.`,
      background: 'Based on engine performance data.',
      target_audience: { primary: 'TBD', secondary: 'TBD', psychographic: 'TBD', behavioral: 'TBD' },
      key_message: 'To be defined with creative team.',
      supporting_messages: [],
      tone_and_voice: 'Professional, data-driven.',
      creative_requirements: [],
      media_strategy: 'Multi-channel based on engine recommendations.',
      channels: [],
      kpis: [{ kpi: input.objective, target: 'TBD', measurement: 'Platform native' }],
      timeline: [],
      mandatories: [],
      summary: `Campaign brief for "${input.campaign_name}".`,
    };
  }

  const title = `Campaign Brief: ${input.campaign_name}`;
  const subtitle = `${input.objective}  ·  ${input.client_id}`;
  const formats = input.output_formats ?? ['docx'];
  const primaryFormat = formats[0]!;

  const sections = [
    { heading: 'Campaign Overview', content: llm.campaign_overview },
    { heading: 'Background & Rationale', content: llm.background },
    { heading: 'Target Audience', content: '', table: { headers: ['Dimension', 'Description'], rows: [['Primary', llm.target_audience.primary], ['Secondary', llm.target_audience.secondary], ['Psychographic', llm.target_audience.psychographic], ['Behavioral', llm.target_audience.behavioral]] } },
    { heading: 'Key Message', content: `PRIMARY:\n${llm.key_message}\n\nSUPPORTING:\n${llm.supporting_messages.map(m => `  • ${m}`).join('\n') || '  (TBD)'}` },
    { heading: 'Tone & Voice', content: llm.tone_and_voice },
    { heading: 'Media Strategy', content: llm.media_strategy },
    { heading: 'Channel Plan', content: '', table: { headers: ['Channel', 'Role', 'Budget %'], rows: llm.channels.map(c => [c.channel, c.role, c.budget_pct]) } },
    { heading: 'KPIs & Measurement', content: '', table: { headers: ['KPI', 'Target', 'Measurement'], rows: llm.kpis.map(k => [k.kpi, k.target, k.measurement]) } },
    { heading: 'Creative Requirements', content: llm.creative_requirements.map(c => `${c.format} — ${c.specs}\n  ${c.notes}`).join('\n\n') || 'TBD' },
    { heading: 'Timeline', content: '', table: { headers: ['Milestone', 'Date', 'Owner'], rows: llm.timeline.map(t => [t.milestone, t.date, t.owner]) } },
    { heading: 'Mandatories', content: llm.mandatories.map(m => `  • ${m}`).join('\n') || 'TBD' },
  ];

  let localPath: string;
  let sizeBytes: number;

  if (primaryFormat === 'pdf') {
    localPath = tempPath('pdf');
    const r = await generatePdf({ title, subtitle, sections, output_path: localPath });
    sizeBytes = r.size_bytes;
  } else {
    localPath = tempPath('docx');
    const r = await generateDocx({ title, subtitle, sections, output_path: localPath });
    sizeBytes = r.size_bytes;
  }

  const { fileOutput } = await persistGeneratedFile({ clientId: input.client_id, skillId: 'campaign-brief', runId: input.run_id, fileType: primaryFormat, localPath, sizeBytes });

  const output: DeliverySkillOutput = { skill_id: 'campaign-brief', file: fileOutput, summary: llm.summary, generated_at: new Date().toISOString() };
  if (tokenUsage) {
    (output as DeliverySkillOutput & { token_usage?: unknown }).token_usage = tokenUsage;
  }
  return output;
}
