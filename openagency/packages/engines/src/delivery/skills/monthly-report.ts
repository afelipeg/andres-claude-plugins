// ─── Skill: monthly-report ───────────────────────────────────────────
// Generates a monthly performance report (PDF and/or PPTX) by combining
// outputs from the 4 Layer-1 engines with a Claude-authored narrative.
// Tier: standard (executive narrative, data synthesis)
//
// Flow:
//   1. Compact Layer-1 results into a token-efficient summary
//   2. Call Claude for structured narrative (JSON response)
//   3. Extract chart data from Layer-1 results
//   4. Generate requested file format(s) with Plinth template + charts
//   5. Persist via file-storage, return primary format

import type { MonthlyReportInput } from '@openagency/schemas';
import type { DeliverySkillOutput } from '@openagency/types';
import { generatePdf } from '../tools/file-generators/pdf-generator.js';
import { generatePptx } from '../tools/file-generators/pptx-generator.js';
import { extractChartsFromLayerOne } from '../tools/chart-generator.js';
import type { ChartData } from '../tools/chart-generator.js';
import {
  callDeliveryLLM,
  parseJsonResponse,
  persistGeneratedFile,
  summarizeLayerOne,
  tempPath,
} from './_skill-utils.js';

// ─── Claude response shape ────────────────────────────────────────────

interface MonthlyReportLLMResponse {
  executive_summary: string;
  key_metrics: { label: string; value: string; delta?: string }[];
  sections: {
    heading: string;
    content: string;
    table?: { headers: string[]; rows: string[][] };
  }[];
  recommendations: string[];
  summary: string;
}

// ─── Prompts ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert media agency analyst at Plinth by Polanyi.
Generate a professional monthly performance report for a client based on data from our 4 analysis engines.
Always respond with valid JSON only — no prose outside the JSON object.

The JSON must follow this schema exactly:
{
  "executive_summary": "2-3 paragraph executive summary",
  "key_metrics": [
    { "label": "string", "value": "formatted string e.g. $1,234", "delta": "optional e.g. +12% vs last month" }
  ],
  "sections": [
    {
      "heading": "Section Title",
      "content": "Paragraph text. Use \\n for line breaks.",
      "table": { "headers": ["Col1","Col2"], "rows": [["val","val"]] }
    }
  ],
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "summary": "One-sentence summary of the most important finding"
}

Rules:
- key_metrics: 4-8 KPIs with real numbers from the engine data
- sections: 4-6 sections covering Waste Analysis, Channel Performance, Optimization Actions, Outlook
- table rows: use dash for unavailable data
- All monetary values formatted as currency strings (e.g. "$12,450")
- Tone: confident, data-driven, C-suite audience`;

function buildUserPrompt(input: MonthlyReportInput, layerSummary: string): string {
  return `Client ID: ${input.client_id}
Reporting Period: ${input.period_start} to ${input.period_end}

ENGINE DATA:
${layerSummary}

Generate the monthly performance report.`;
}

// ─── Main export ──────────────────────────────────────────────────────

export async function run(input: MonthlyReportInput): Promise<DeliverySkillOutput> {
  const layerSummary = summarizeLayerOne(input.layer_one_results);

  // ── LLM narrative ────────────────────────────────────────────────
  let llmData: MonthlyReportLLMResponse;
  let tokenUsage: { input_tokens: number; output_tokens: number } | undefined;
  try {
    const result = await callDeliveryLLM(SYSTEM_PROMPT, buildUserPrompt(input, layerSummary), 'standard');
    tokenUsage = result.usage;
    llmData = parseJsonResponse<MonthlyReportLLMResponse>(result.content);
  } catch (err) {
    // Graceful fallback — still generate a file with available data
    llmData = {
      executive_summary:
        `Monthly report for ${input.client_id} · ${input.period_start} → ${input.period_end}. ` +
        `Narrative generation unavailable — see raw engine data.`,
      key_metrics: [
        { label: 'Period', value: `${input.period_start} → ${input.period_end}` },
        { label: 'Engines', value: '4' },
      ],
      sections: [
        {
          heading: 'Data Summary',
          content: `Engine outputs received. Narrative unavailable: ${
            err instanceof Error ? err.message : String(err)
          }`,
        },
      ],
      recommendations: ['Review raw engine outputs for this period.'],
      summary: `Monthly report generated for ${input.period_start} to ${input.period_end}.`,
    };
  }

  // ── Extract charts from Layer-1 data ─────────────────────────────
  let charts: ChartData[] = [];
  try {
    charts = extractChartsFromLayerOne(input.layer_one_results);
  } catch {
    // Chart extraction failed — continue without charts
  }

  // Map chart types to sections for context-appropriate placement
  const spendChart = charts.find(c => c.title.includes('Spend'));
  const roasChart = charts.find(c => c.title.includes('ROAS'));
  const trendChart = charts.find(c => c.type === 'line');
  const wasteChart = charts.find(c => c.type === 'waterfall');

  const title = `Monthly Performance Report`;
  const subtitle = `${input.period_start} → ${input.period_end}  ·  ${input.client_id}`;
  const formats = input.output_formats ?? ['pdf'];
  const primaryFormat = formats[0]!;

  // ── PDF sections ─────────────────────────────────────────────────
  const pdfSections = [
    { heading: 'Executive Summary', content: llmData.executive_summary },
    ...llmData.sections.map((s, i) => ({
      heading: s.heading,
      content: s.content,
      table: s.table,
      // Attach charts to matching sections by keyword, or to early sections
      chart: matchChartToSection(s.heading, [spendChart, roasChart, trendChart, wasteChart], i),
    })),
    {
      heading: 'Recommendations',
      content: llmData.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n'),
    },
  ];

  // ── PPTX slides ──────────────────────────────────────────────────
  const pptxSlides = [
    { heading: 'Executive Summary', body: llmData.executive_summary },
    { heading: 'Key Metrics', kpis: llmData.key_metrics },
    ...llmData.sections.map((s, i) => ({
      heading: s.heading,
      body: s.table ? undefined : s.content,
      table: s.table,
      chart: matchChartToSection(s.heading, [spendChart, roasChart, trendChart, wasteChart], i),
    })),
    // Dedicated chart slides for any remaining charts not matched to sections
    ...charts
      .filter(c => ![spendChart, roasChart, trendChart, wasteChart].includes(c))
      .map(c => ({ heading: c.title, chart: c })),
    {
      heading: 'Recommendations',
      body: llmData.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n'),
    },
  ];

  // ── Generate primary format ──────────────────────────────────────
  let localPath: string;
  let sizeBytes: number;

  if (primaryFormat === 'pptx') {
    localPath = tempPath('pptx');
    const r = await generatePptx({ title, subtitle, slides: pptxSlides, output_path: localPath });
    sizeBytes = r.size_bytes;
  } else {
    localPath = tempPath('pdf');
    const r = await generatePdf({ title, subtitle, sections: pdfSections, output_path: localPath });
    sizeBytes = r.size_bytes;
  }

  // ── Persist & return ─────────────────────────────────────────────
  const { fileOutput } = await persistGeneratedFile({
    clientId: input.client_id,
    skillId: 'monthly-report',
    runId: input.run_id,
    fileType: primaryFormat,
    localPath,
    sizeBytes,
  });

  const output: DeliverySkillOutput = {
    skill_id: 'monthly-report',
    file: fileOutput,
    summary: llmData.summary,
    generated_at: new Date().toISOString(),
  };
  if (tokenUsage) {
    (output as DeliverySkillOutput & { token_usage?: unknown }).token_usage = tokenUsage;
  }
  return output;
}

// ─── Helpers ────────────────────────────────────────────────────────

/** Match a chart to a section heading by keyword, or by index fallback. */
function matchChartToSection(
  heading: string,
  availableCharts: (ChartData | undefined)[],
  sectionIndex: number,
): ChartData | undefined {
  const h = heading.toLowerCase();

  // Keyword matching
  if ((h.includes('waste') || h.includes('leak')) && availableCharts[3]) return availableCharts[3];
  if ((h.includes('channel') || h.includes('spend')) && availableCharts[0]) return availableCharts[0];
  if ((h.includes('roi') || h.includes('roas') || h.includes('efficiency')) && availableCharts[1]) return availableCharts[1];
  if ((h.includes('trend') || h.includes('kpi') || h.includes('performance')) && availableCharts[2]) return availableCharts[2];

  // Index fallback: attach first available to early sections
  if (sectionIndex < availableCharts.length) return availableCharts[sectionIndex];

  return undefined;
}
