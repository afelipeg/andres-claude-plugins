// ─── Skill: industry-benchmarks ──────────────────────────────────────
// Searches for fresh industry benchmarks via web search, then uses Claude
// to structure findings into a PDF and/or XLSX report.
// Tier: fast (structured data extraction, less narrative reasoning)

import type { IndustryBenchmarksInput } from '@openagency/schemas';
import type { DeliverySkillOutput, WebSearchResponse } from '@openagency/types';
import { webSearch } from '../tools/web-search.js';
import { generatePdf } from '../tools/file-generators/pdf-generator.js';
import { generateXlsx } from '../tools/file-generators/xlsx-generator.js';
import {
  callDeliveryLLM,
  parseJsonResponse,
  persistGeneratedFile,
  summarizeLayerOne,
  tempPath,
} from './_skill-utils.js';

interface BenchmarksLLM {
  overview: string;
  benchmarks: { metric: string; industry_avg: string; top_quartile: string; bottom_quartile: string; unit: string; source: string }[];
  channel_benchmarks: { channel: string; cpm: string; ctr: string; cpc: string; roas: string }[];
  trends: { trend: string; implication: string }[];
  client_vs_industry: { metric: string; client: string; industry_avg: string; assessment: string }[];
  recommendations: string[];
  summary: string;
}

const SYSTEM_PROMPT = `You are a media industry research analyst at Plinth by Polanyi.
Compile industry benchmark data from web research and client engine data into a structured report.
Respond with valid JSON only.

JSON schema:
{
  "overview": "2-3 paragraph overview of the benchmark landscape",
  "benchmarks": [ { "metric": "CTR", "industry_avg": "2.1%", "top_quartile": "4.5%", "bottom_quartile": "0.8%", "unit": "%", "source": "Source name" } ],
  "channel_benchmarks": [ { "channel": "Meta", "cpm": "$8.50", "ctr": "1.2%", "cpc": "$0.71", "roas": "3.2x" } ],
  "trends": [ { "trend": "Trend name", "implication": "What it means for media buying" } ],
  "client_vs_industry": [ { "metric": "CTR", "client": "3.2%", "industry_avg": "2.1%", "assessment": "Above average" } ],
  "recommendations": ["Actionable recommendation"],
  "summary": "One-sentence key benchmark insight"
}
Rules: Use actual data from web search when available. Use "N/A" for missing data. Tone: analytical, data-driven.`;

function buildPrompt(input: IndustryBenchmarksInput, context: string, searches: WebSearchResponse[]): string {
  const searchData = searches.flatMap(r => r.results.slice(0, 4).map(item => `  • ${item.title}: ${item.snippet}`)).filter(Boolean).join('\n');
  return `Industry: ${input.industry}\nChannels: ${input.channels?.join(', ') ?? 'All'}\nClient: ${input.client_id}\n\nCLIENT DATA:\n${context}\n\nWEB RESEARCH:\n${searchData || 'No web data available'}\n\nGenerate the benchmarks report.`;
}

export async function run(input: IndustryBenchmarksInput): Promise<DeliverySkillOutput> {
  const context = summarizeLayerOne(input.layer_one_results);
  const year = new Date().getFullYear();
  const searches = await Promise.all([
    webSearch({ query: `${input.industry} advertising benchmarks ${year} CTR CPM ROAS`, num_results: 6, freshness: 'month' }).catch(() => emptySearch()),
    webSearch({ query: `${input.industry} digital marketing industry averages ${year}`, num_results: 5, freshness: 'month' }).catch(() => emptySearch()),
    ...(input.channels ?? ['meta', 'google']).slice(0, 2).map(ch =>
      webSearch({ query: `${ch} advertising benchmarks ${input.industry} ${year}`, num_results: 3 }).catch(() => emptySearch()),
    ),
  ]);

  let llm: BenchmarksLLM;
  let tokenUsage: { input_tokens: number; output_tokens: number } | undefined;
  try {
    const result = await callDeliveryLLM(SYSTEM_PROMPT, buildPrompt(input, context, searches), 'fast');
    tokenUsage = result.usage;
    llm = parseJsonResponse<BenchmarksLLM>(result.content);
  } catch {
    llm = { overview: `Benchmarks for ${input.industry}. Narrative unavailable.`, benchmarks: [], channel_benchmarks: [], trends: [], client_vs_industry: [], recommendations: ['Retry with ANTHROPIC_API_KEY.'], summary: `Benchmark report for ${input.industry}.` };
  }

  const title = `${input.industry} Industry Benchmarks`;
  const subtitle = `${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}  ·  ${input.client_id}`;
  const formats = input.output_formats ?? ['pdf'];
  const primaryFormat = formats[0]!;

  const benchmarkTable = { headers: ['Metric', 'Industry Avg', 'Top Quartile', 'Bottom Quartile', 'Unit', 'Source'], rows: llm.benchmarks.map(b => [b.metric, b.industry_avg, b.top_quartile, b.bottom_quartile, b.unit, b.source]) };
  const channelTable = { headers: ['Channel', 'CPM', 'CTR', 'CPC', 'ROAS'], rows: llm.channel_benchmarks.map(c => [c.channel, c.cpm, c.ctr, c.cpc, c.roas]) };
  const clientTable = { headers: ['Metric', 'Client', 'Industry Avg', 'Assessment'], rows: llm.client_vs_industry.map(r => [r.metric, r.client, r.industry_avg, r.assessment]) };

  let localPath: string;
  let sizeBytes: number;

  if (primaryFormat === 'xlsx') {
    localPath = tempPath('xlsx');
    const r = await generateXlsx({ title, sheets: [
      { name: 'Key Benchmarks', headers: benchmarkTable.headers, rows: benchmarkTable.rows },
      { name: 'Channel Benchmarks', headers: channelTable.headers, rows: channelTable.rows },
      { name: 'Client vs Industry', headers: clientTable.headers, rows: clientTable.rows },
      { name: 'Trends', headers: ['Trend', 'Implication'], rows: llm.trends.map(t => [t.trend, t.implication]) },
    ], output_path: localPath });
    sizeBytes = r.size_bytes;
  } else {
    localPath = tempPath('pdf');
    const r = await generatePdf({ title, subtitle, sections: [
      { heading: 'Overview', content: llm.overview },
      { heading: 'Key Benchmarks', content: '', table: benchmarkTable },
      { heading: 'Channel Benchmarks', content: '', table: channelTable },
      { heading: 'Client vs Industry', content: '', table: clientTable },
      { heading: 'Trends', content: llm.trends.map(t => `${t.trend}: ${t.implication}`).join('\n') },
      { heading: 'Recommendations', content: llm.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n') },
    ], output_path: localPath });
    sizeBytes = r.size_bytes;
  }

  const { fileOutput } = await persistGeneratedFile({ clientId: input.client_id, skillId: 'industry-benchmarks', runId: input.run_id, fileType: primaryFormat, localPath, sizeBytes });

  const output: DeliverySkillOutput = { skill_id: 'industry-benchmarks', file: fileOutput, summary: llm.summary, generated_at: new Date().toISOString() };
  if (tokenUsage) {
    (output as DeliverySkillOutput & { token_usage?: unknown }).token_usage = tokenUsage;
  }
  return output;
}

function emptySearch(): WebSearchResponse { return { query: '', results: [], cached: false, fetched_at: new Date().toISOString() }; }
