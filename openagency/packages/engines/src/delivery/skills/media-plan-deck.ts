// ─── Skill: media-plan-deck ──────────────────────────────────────────
// Generates a PPTX/PDF media plan deck using MediaArchitect outputs
// showing channel allocation, flight calendar, and optimization approach.

import type { MediaPlanDeckInput } from '@openagency/schemas';
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

interface MediaPlanLLM {
  strategy_rationale: string;
  channel_plan: { channel: string; budget: string; pct: string; objective: string; targeting: string; kpis: string }[];
  flight_strategy: string;
  weekly_rhythm: { week: string; focus: string; budget_pct: string; key_activity: string }[];
  creative_strategy: string;
  measurement_framework: { kpi: string; target: string; platform: string; frequency: string }[];
  optimization_approach: string;
  budget_summary: { total: string; working_media: string; fees: string; contingency: string };
  summary: string;
}

const SYSTEM_PROMPT = `You are a senior media planner at Plinth by Polanyi.
Create a comprehensive media plan deck grounded in engine-recommended optimizations.
Respond with valid JSON only.

JSON schema:
{
  "strategy_rationale": "2-paragraph media strategy rationale",
  "channel_plan": [ { "channel": "Meta", "budget": "$60,000", "pct": "40%", "objective": "Awareness & conversion", "targeting": "Custom audiences + LAL", "kpis": "ROAS > 4x, CTR > 2%" } ],
  "flight_strategy": "Paragraph describing flight pacing and scheduling approach",
  "weekly_rhythm": [ { "week": "Week 1", "focus": "Testing", "budget_pct": "10%", "key_activity": "Creative A/B test" } ],
  "creative_strategy": "Paragraph on creative approach and rotation",
  "measurement_framework": [ { "kpi": "ROAS", "target": "4.0x", "platform": "Platform native", "frequency": "Daily" } ],
  "optimization_approach": "Paragraph on optimization rules and triggers",
  "budget_summary": { "total": "$150,000", "working_media": "$130,000", "fees": "$15,000", "contingency": "$5,000" },
  "summary": "One-sentence plan summary"
}
Rules: Budget percentages must sum to 100. Ground channel selection in MediaArchitect data. Tone: strategic, client-facing.`;

export async function run(input: MediaPlanDeckInput): Promise<DeliverySkillOutput> {
  const context = summarizeLayerOne(input.layer_one_results);
  const budgetStr = input.total_budget ? `$${input.total_budget.toLocaleString()}` : 'TBD';
  const prompt = `Client: ${input.client_id}\nPeriod: ${input.period_start} to ${input.period_end}\nTotal Budget: ${budgetStr}\n\nENGINE DATA (MediaArchitect recommendations):\n${context}\n\nGenerate the media plan deck.`;

  let llm: MediaPlanLLM;
  try {
    llm = parseJsonResponse<MediaPlanLLM>(await callDeliveryLLM(SYSTEM_PROMPT, prompt));
  } catch {
    llm = {
      strategy_rationale: `Media plan for ${input.period_start} to ${input.period_end} — ${input.client_id}.`,
      channel_plan: [],
      flight_strategy: 'To be defined based on campaign objectives.',
      weekly_rhythm: [],
      creative_strategy: 'Rotate creative every 2 weeks.',
      measurement_framework: [],
      optimization_approach: 'Weekly optimization reviews.',
      budget_summary: { total: budgetStr, working_media: 'TBD', fees: 'TBD', contingency: 'TBD' },
      summary: `Media plan for ${input.period_start} to ${input.period_end}.`,
    };
  }

  const title = 'Media Plan';
  const subtitle = `${input.period_start} → ${input.period_end}  ·  ${budgetStr}  ·  ${input.client_id}`;
  const formats = input.output_formats ?? ['pptx'];
  const primaryFormat = formats[0]!;

  const channelTable = { headers: ['Channel', 'Budget', '%', 'Objective', 'Targeting', 'KPIs'], rows: llm.channel_plan.map(c => [c.channel, c.budget, c.pct, c.objective, c.targeting, c.kpis]) };
  const weeklyTable = { headers: ['Week', 'Focus', 'Budget %', 'Key Activity'], rows: llm.weekly_rhythm.map(w => [w.week, w.focus, w.budget_pct, w.key_activity]) };
  const measureTable = { headers: ['KPI', 'Target', 'Platform', 'Frequency'], rows: llm.measurement_framework.map(m => [m.kpi, m.target, m.platform, m.frequency]) };
  const budgetTable = { headers: ['Category', 'Amount'], rows: [['Total', llm.budget_summary.total], ['Working Media', llm.budget_summary.working_media], ['Fees', llm.budget_summary.fees], ['Contingency', llm.budget_summary.contingency]] };

  let localPath: string;
  let sizeBytes: number;

  if (primaryFormat === 'pdf') {
    localPath = tempPath('pdf');
    const r = await generatePdf({ title, subtitle, sections: [
      { heading: 'Strategy Rationale', content: llm.strategy_rationale },
      { heading: 'Channel Plan', content: '', table: channelTable },
      { heading: 'Budget Summary', content: '', table: budgetTable },
      { heading: 'Flight Strategy', content: llm.flight_strategy },
      { heading: 'Weekly Rhythm', content: '', table: weeklyTable },
      { heading: 'Creative Strategy', content: llm.creative_strategy },
      { heading: 'Measurement Framework', content: '', table: measureTable },
      { heading: 'Optimization Approach', content: llm.optimization_approach },
    ], output_path: localPath });
    sizeBytes = r.size_bytes;
  } else {
    localPath = tempPath('pptx');
    const r = await generatePptx({ title, subtitle, slides: [
      { heading: 'Strategy Rationale', body: llm.strategy_rationale },
      { heading: 'Channel Plan', table: channelTable },
      { heading: 'Budget Summary', table: budgetTable },
      { heading: 'Flight Strategy', body: llm.flight_strategy },
      { heading: 'Weekly Rhythm', table: weeklyTable },
      { heading: 'Creative Strategy', body: llm.creative_strategy },
      { heading: 'Measurement Framework', table: measureTable },
      { heading: 'Optimization Approach', body: llm.optimization_approach },
    ], output_path: localPath });
    sizeBytes = r.size_bytes;
  }

  const { fileOutput } = await persistGeneratedFile({ clientId: input.client_id, skillId: 'media-plan-deck', runId: input.run_id, fileType: primaryFormat, localPath, sizeBytes });
  return { skill_id: 'media-plan-deck', file: fileOutput, summary: llm.summary, generated_at: new Date().toISOString() };
}
