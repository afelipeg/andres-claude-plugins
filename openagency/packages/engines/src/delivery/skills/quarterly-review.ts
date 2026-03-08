// ─── Skill: quarterly-review ─────────────────────────────────────────
// Generates a QBR executive presentation (PPTX/PDF) with quarter summary,
// channel deep dive, wins & losses, and next quarter roadmap.

import type { QuarterlyReviewInput } from '@openagency/schemas';
import type { DeliverySkillOutput } from '@openagency/types';
import { generatePptx } from '../tools/file-generators/pptx-generator.js';
import { generatePdf } from '../tools/file-generators/pdf-generator.js';
import {
  callDeliveryLLM,
  parseJsonResponse,
  persistGeneratedFile,
  summarizeLayerOne,
  tempPath,
} from './_skill-utils.js';

interface QBRLLM {
  quarter_overview: string;
  key_metrics: { label: string; value: string; delta?: string }[];
  top_wins: { win: string; impact: string }[];
  key_challenges: { challenge: string; action_taken: string }[];
  channel_performance: { channel: string; spend: string; roas: string; impressions: string; trend: string }[];
  learnings: string[];
  next_quarter_plan: { priority: string; initiative: string; expected_impact: string }[];
  executive_outlook: string;
  summary: string;
}

const SYSTEM_PROMPT = `You are a senior client success manager at Plinth by Polanyi preparing a Quarterly Business Review.
Create an executive QBR presentation with data-driven narrative and strategic outlook.
Respond with valid JSON only.

JSON schema:
{
  "quarter_overview": "2-3 paragraph quarter summary",
  "key_metrics": [ { "label": "Total ROAS", "value": "4.2x", "delta": "+12% vs Q3" } ],
  "top_wins": [ { "win": "Win description", "impact": "Business impact" } ],
  "key_challenges": [ { "challenge": "Challenge faced", "action_taken": "What was done" } ],
  "channel_performance": [ { "channel": "Meta", "spend": "$120,000", "roas": "4.5x", "impressions": "2.1M", "trend": "Up 15%" } ],
  "learnings": ["Key learning from the quarter"],
  "next_quarter_plan": [ { "priority": "1", "initiative": "Creative refresh", "expected_impact": "+20% CTR" } ],
  "executive_outlook": "1-2 paragraph forward-looking statement",
  "summary": "One-sentence QBR headline"
}
Rules: key_metrics: 6-8 KPIs. top_wins: 3-5. Tone: executive, confident, strategic.`;

export async function run(input: QuarterlyReviewInput): Promise<DeliverySkillOutput> {
  const context = summarizeLayerOne(input.layer_one_results);
  const prompt = `Client: ${input.client_id}\nQuarter: ${input.quarter}\n\nENGINE DATA:\n${context}\n\nGenerate the QBR.`;

  let llm: QBRLLM;
  try {
    llm = parseJsonResponse<QBRLLM>(await callDeliveryLLM(SYSTEM_PROMPT, prompt));
  } catch {
    llm = {
      quarter_overview: `QBR for ${input.quarter} — ${input.client_id}.`,
      key_metrics: [{ label: 'Quarter', value: input.quarter }],
      top_wins: [],
      key_challenges: [],
      channel_performance: [],
      learnings: [],
      next_quarter_plan: [],
      executive_outlook: 'Outlook pending full data analysis.',
      summary: `QBR for ${input.quarter}.`,
    };
  }

  const title = `Quarterly Business Review`;
  const subtitle = `${input.quarter}  ·  ${input.client_id}`;
  const formats = input.output_formats ?? ['pptx'];
  const primaryFormat = formats[0]!;

  const channelTable = { headers: ['Channel', 'Spend', 'ROAS', 'Impressions', 'Trend'], rows: llm.channel_performance.map(c => [c.channel, c.spend, c.roas, c.impressions, c.trend]) };
  const nextQTable = { headers: ['Priority', 'Initiative', 'Expected Impact'], rows: llm.next_quarter_plan.map(n => [n.priority, n.initiative, n.expected_impact]) };
  const winsTable = { headers: ['Win', 'Impact'], rows: llm.top_wins.map(w => [w.win, w.impact]) };
  const challengesTable = { headers: ['Challenge', 'Action Taken'], rows: llm.key_challenges.map(c => [c.challenge, c.action_taken]) };

  let localPath: string;
  let sizeBytes: number;

  if (primaryFormat === 'pdf') {
    localPath = tempPath('pdf');
    const r = await generatePdf({ title, subtitle, sections: [
      { heading: 'Quarter Overview', content: llm.quarter_overview },
      { heading: 'Channel Performance', content: '', table: channelTable },
      { heading: 'Top Wins', content: '', table: winsTable },
      { heading: 'Key Challenges', content: '', table: challengesTable },
      { heading: 'Learnings', content: llm.learnings.map((l, i) => `${i + 1}. ${l}`).join('\n') },
      { heading: 'Next Quarter Plan', content: '', table: nextQTable },
      { heading: 'Executive Outlook', content: llm.executive_outlook },
    ], output_path: localPath });
    sizeBytes = r.size_bytes;
  } else {
    localPath = tempPath('pptx');
    const r = await generatePptx({ title, subtitle, slides: [
      { heading: 'Quarter Overview', body: llm.quarter_overview },
      { heading: 'Key Metrics', kpis: llm.key_metrics },
      { heading: 'Channel Performance', table: channelTable },
      { heading: 'Top Wins', table: winsTable },
      { heading: 'Key Challenges', table: challengesTable },
      { heading: 'Learnings', body: llm.learnings.map((l, i) => `${i + 1}. ${l}`).join('\n') },
      { heading: 'Next Quarter Plan', table: nextQTable },
      { heading: 'Executive Outlook', body: llm.executive_outlook },
    ], output_path: localPath });
    sizeBytes = r.size_bytes;
  }

  const { fileOutput } = await persistGeneratedFile({ clientId: input.client_id, skillId: 'quarterly-review', runId: input.run_id, fileType: primaryFormat, localPath, sizeBytes });
  return { skill_id: 'quarterly-review', file: fileOutput, summary: llm.summary, generated_at: new Date().toISOString() };
}
