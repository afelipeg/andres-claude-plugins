// ─── Skill: quarterly-review ─────────────────────────────────────────
// Generates a QBR executive presentation (PPTX/PDF) with quarter summary,
// channel deep dive, wins & losses, and next quarter roadmap.
// Now includes native charts for channel performance and budget allocation.
// Tier: standard (executive narrative, strategic outlook)

import type { QuarterlyReviewInput } from '@openagency/schemas';
import type { DeliverySkillOutput } from '@openagency/types';
import { generatePptx } from '../tools/file-generators/pptx-generator.js';
import { generatePdf } from '../tools/file-generators/pdf-generator.js';
import { extractChartsFromLayerOne } from '../tools/chart-generator.js';
import type { ChartData } from '../tools/chart-generator.js';
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
  let tokenUsage: { input_tokens: number; output_tokens: number } | undefined;
  try {
    const result = await callDeliveryLLM(SYSTEM_PROMPT, prompt, 'standard');
    tokenUsage = result.usage;
    llm = parseJsonResponse<QBRLLM>(result.content);
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

  // ── Extract charts from Layer-1 data ─────────────────────────────
  let charts: ChartData[] = [];
  try {
    charts = extractChartsFromLayerOne(input.layer_one_results);
  } catch {
    // Chart extraction failed — continue without charts
  }

  // Also build charts from LLM-generated channel_performance data
  const channelChartFromLLM = buildChannelChartFromLLM(llm.channel_performance);
  const allocationChartFromLLM = buildAllocationPieFromLLM(llm.channel_performance);

  // Pick charts: prefer engine-extracted, fall back to LLM-derived
  const spendChart = charts.find(c => c.title.includes('Spend')) ?? channelChartFromLLM;
  const pieChart = charts.find(c => c.type === 'pie') ?? allocationChartFromLLM;
  const wasteChart = charts.find(c => c.type === 'waterfall');
  const trendChart = charts.find(c => c.type === 'line');

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
      { heading: 'Channel Performance', content: '', table: channelTable, chart: spendChart },
      { heading: 'Channel Contribution', content: '', chart: pieChart },
      { heading: 'Top Wins', content: '', table: winsTable },
      { heading: 'Key Challenges', content: '', table: challengesTable },
      ...(wasteChart ? [{ heading: 'Waste Decomposition', content: '', chart: wasteChart }] : []),
      ...(trendChart ? [{ heading: 'KPI Trends', content: '', chart: trendChart }] : []),
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
      { heading: 'Channel Performance', table: channelTable, chart: spendChart },
      { heading: 'Channel Contribution', chart: pieChart },
      { heading: 'Top Wins', table: winsTable },
      { heading: 'Key Challenges', table: challengesTable },
      ...(wasteChart ? [{ heading: 'Waste Decomposition', chart: wasteChart }] : []),
      ...(trendChart ? [{ heading: 'KPI Trends', chart: trendChart }] : []),
      { heading: 'Learnings', body: llm.learnings.map((l, i) => `${i + 1}. ${l}`).join('\n') },
      { heading: 'Next Quarter Plan', table: nextQTable },
      { heading: 'Executive Outlook', body: llm.executive_outlook },
    ], output_path: localPath });
    sizeBytes = r.size_bytes;
  }

  const { fileOutput } = await persistGeneratedFile({ clientId: input.client_id, skillId: 'quarterly-review', runId: input.run_id, fileType: primaryFormat, localPath, sizeBytes });

  const output: DeliverySkillOutput = { skill_id: 'quarterly-review', file: fileOutput, summary: llm.summary, generated_at: new Date().toISOString() };
  if (tokenUsage) {
    (output as DeliverySkillOutput & { token_usage?: unknown }).token_usage = tokenUsage;
  }
  return output;
}

// ─── Build charts from LLM channel_performance data ─────────────────

function buildChannelChartFromLLM(
  channels: QBRLLM['channel_performance'],
): ChartData | undefined {
  if (channels.length === 0) return undefined;

  const data = channels
    .map(c => {
      const spend = parseFloat(c.spend.replace(/[$,]/g, ''));
      return { label: c.channel, value: isNaN(spend) ? 0 : spend };
    })
    .filter(d => d.value > 0);

  if (data.length === 0) return undefined;

  return {
    type: 'bar',
    title: 'Channel Spend Comparison',
    data,
  };
}

function buildAllocationPieFromLLM(
  channels: QBRLLM['channel_performance'],
): ChartData | undefined {
  if (channels.length === 0) return undefined;

  const data = channels
    .map(c => {
      const spend = parseFloat(c.spend.replace(/[$,]/g, ''));
      return { label: c.channel, value: isNaN(spend) ? 0 : spend };
    })
    .filter(d => d.value > 0);

  if (data.length === 0) return undefined;

  return {
    type: 'pie',
    title: 'Budget Allocation by Channel',
    data,
    options: { showLegend: true },
  };
}
