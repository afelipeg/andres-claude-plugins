// ─── Skill: competitive-analysis ─────────────────────────────────────
// Generates a competitive intelligence report by combining:
//   - Layer-1 engine outputs (client context)
//   - Meta Ad Library (live competitor ads)
//   - Google Ads Transparency via SerpAPI (live competitor ads)
//   - Web search (industry context, news, benchmarks)
//   - Claude narrative (analysis + recommendations)
// Tier: standard (analytical narrative)

import type { CompetitiveAnalysisInput } from '@openagency/schemas';
import type {
  DeliverySkillOutput,
  AdLibraryResponse,
  WebSearchResponse,
} from '@openagency/types';
import { fetchMetaAds } from '../tools/ad-library-meta.js';
import { fetchGoogleAds } from '../tools/ad-library-google.js';
import { webSearch } from '../tools/web-search.js';
import { generatePdf } from '../tools/file-generators/pdf-generator.js';
import { generatePptx } from '../tools/file-generators/pptx-generator.js';
import {
  callDeliveryLLM,
  parseJsonResponse,
  persistGeneratedFile,
  summarizeLayerOne,
  tempPath,
} from './_skill-utils.js';

// ─── Claude response shape ────────────────────────────────────────────

interface CompAnalysisLLM {
  overview: string;
  competitor_summaries: {
    name: string;
    active_ads: number;
    key_messages: string[];
    channels: string[];
    estimated_spend: string;
    observations: string;
  }[];
  swot: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  };
  market_context: string;
  recommendations: string[];
  summary: string;
}

// ─── Prompts ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior competitive intelligence analyst at Plinth by Polanyi.
Analyze the competitive landscape based on real-time ad data and web research.
Always respond with valid JSON only — no prose outside the JSON object.

JSON schema:
{
  "overview": "2-3 paragraph overview of the competitive landscape",
  "competitor_summaries": [
    {
      "name": "Competitor Name",
      "active_ads": 12,
      "key_messages": ["Message 1"],
      "channels": ["meta", "google"],
      "estimated_spend": "$10,000-$50,000",
      "observations": "Key strategic observations"
    }
  ],
  "swot": {
    "strengths": ["Client strength"],
    "weaknesses": ["Client weakness"],
    "opportunities": ["Market opportunity"],
    "threats": ["Competitive threat"]
  },
  "market_context": "Broader market trends relevant to this analysis",
  "recommendations": ["Actionable recommendation"],
  "summary": "One-sentence key insight"
}

Rules:
- Extract key messages from ad creative bodies provided
- Be specific about channels where competitors are active
- SWOT grounded in actual data provided
- Recommendations must be directly actionable by a media agency
- Tone: analytical, strategic, C-suite audience`;

function buildUserPrompt(
  input: CompetitiveAnalysisInput,
  clientContext: string,
  metaAds: AdLibraryResponse[],
  googleAds: AdLibraryResponse[],
  searchResults: WebSearchResponse[],
): string {
  const adData = input.competitors.map((name, i) => {
    const meta = metaAds[i];
    const google = googleAds[i];

    const metaLine = meta && meta.ads.length > 0
      ? `  Meta (${meta.ads.length} ads):\n` + meta.ads.slice(0, 5).map(ad =>
          `    • "${ad.ad_creative_body ?? ad.ad_creative_link_title ?? 'No copy'}" | Impressions: ${ad.impressions ?? '?'} | Platforms: ${(ad.platforms ?? []).join(', ')}`
        ).join('\n')
      : `  Meta: ${meta?.ads.length === 0 ? 'No active ads found' : 'Unavailable (no META_ACCESS_TOKEN)'}`;

    const googleLine = google && google.ads.length > 0
      ? `  Google (${google.ads.length} ads):\n` + google.ads.slice(0, 5).map(ad =>
          `    • "${ad.ad_creative_link_title ?? ad.ad_creative_body ?? 'No copy'}" | Impressions: ${ad.impressions ?? '?'}`
        ).join('\n')
      : `  Google: ${google?.ads.length === 0 ? 'No active ads found' : 'Unavailable (no SERPAPI_KEY)'}`;

    return `Competitor: ${name}\n${metaLine}\n${googleLine}`;
  }).join('\n\n');

  const webCtx = searchResults
    .flatMap(r => r.results.slice(0, 3).map(item => `  • ${item.title}: ${item.snippet}`))
    .filter(Boolean)
    .join('\n');

  return `Client ID: ${input.client_id}
Industry: ${input.industry ?? 'Not specified'}
Competitors: ${input.competitors.join(', ')}

CLIENT CONTEXT (Layer-1 engines):
${clientContext}

COMPETITOR AD DATA:
${adData || 'No ad data available'}

WEB CONTEXT:
${webCtx || 'No web search data available'}

Generate the competitive analysis.`;
}

// ─── Main export ──────────────────────────────────────────────────────

export async function run(input: CompetitiveAnalysisInput): Promise<DeliverySkillOutput> {
  const clientContext = summarizeLayerOne(input.layer_one_results);

  // ── Parallel data fetch ───────────────────────────────────────────
  const [metaAds, googleAds, searchResults] = await Promise.all([
    Promise.all(
      input.competitors.map(name =>
        fetchMetaAds({ advertiser_name: name, limit: 10 }).catch(() => empty('meta', name)),
      ),
    ),
    Promise.all(
      input.competitors.map(name =>
        fetchGoogleAds({ advertiser_name: name, limit: 10 }).catch(() => empty('google', name)),
      ),
    ),
    Promise.all([
      webSearch({
        query: `${input.industry ?? input.competitors[0]} advertising trends ${new Date().getFullYear()}`,
        num_results: 5,
        freshness: 'month',
      }).catch(() => emptySearch(`${input.industry} advertising trends`)),
      ...input.competitors.slice(0, 3).map(name =>
        webSearch({
          query: `${name} marketing advertising strategy`,
          num_results: 3,
          freshness: 'month',
        }).catch(() => emptySearch(`${name} advertising strategy`)),
      ),
    ]),
  ]);

  // ── LLM analysis ─────────────────────────────────────────────────
  let llm: CompAnalysisLLM;
  let tokenUsage: { input_tokens: number; output_tokens: number } | undefined;
  try {
    const result = await callDeliveryLLM(
      SYSTEM_PROMPT,
      buildUserPrompt(input, clientContext, metaAds, googleAds, searchResults),
      'standard',
    );
    tokenUsage = result.usage;
    llm = parseJsonResponse<CompAnalysisLLM>(result.content);
  } catch {
    llm = {
      overview: `Competitive analysis for ${input.competitors.join(', ')} — ${input.client_id}.`,
      competitor_summaries: input.competitors.map(name => ({
        name,
        active_ads: 0,
        key_messages: [],
        channels: [],
        estimated_spend: 'Unknown',
        observations: 'Data collected; narrative unavailable.',
      })),
      swot: { strengths: [], weaknesses: [], opportunities: [], threats: [] },
      market_context: `Analysis date: ${new Date().toISOString().split('T')[0]}`,
      recommendations: ['Review raw ad library data.'],
      summary: `Competitive analysis for ${input.competitors.join(', ')}.`,
    };
  }

  const title = 'Competitive Intelligence Report';
  const subtitle = `${input.competitors.join(' · ')}  ·  ${input.client_id}`;
  const formats = input.output_formats ?? ['pdf'];
  const primaryFormat = formats[0]!;

  // ── SWOT table ────────────────────────────────────────────────────
  const maxSwotRows = Math.max(
    llm.swot.strengths.length,
    llm.swot.weaknesses.length,
    llm.swot.opportunities.length,
    llm.swot.threats.length,
    1,
  );
  const swotTable = {
    headers: ['Strengths', 'Weaknesses', 'Opportunities', 'Threats'],
    rows: Array.from({ length: maxSwotRows }).map((_, i) => [
      llm.swot.strengths[i] ?? '—',
      llm.swot.weaknesses[i] ?? '—',
      llm.swot.opportunities[i] ?? '—',
      llm.swot.threats[i] ?? '—',
    ]),
  };

  // ── Competitor summary table ──────────────────────────────────────
  const competitorTable = {
    headers: ['Competitor', 'Active Ads', 'Channels', 'Est. Spend', 'Key Observation'],
    rows: llm.competitor_summaries.map(c => [
      c.name,
      String(c.active_ads),
      c.channels.join(', ') || '—',
      c.estimated_spend,
      c.observations,
    ]),
  };

  // ── PDF sections ──────────────────────────────────────────────────
  const pdfSections = [
    { heading: 'Overview', content: llm.overview },
    { heading: 'Competitor Summary', content: 'Active ad landscape across monitored competitors.', table: competitorTable },
    ...llm.competitor_summaries.map(c => ({
      heading: c.name,
      content:
        `Channels: ${c.channels.join(', ') || 'Unknown'} | Est. Spend: ${c.estimated_spend} | Active Ads: ${c.active_ads}\n\n` +
        `Key Messages:\n${c.key_messages.map(m => `  • ${m}`).join('\n') || '  (none detected)'}\n\n` +
        c.observations,
    })),
    { heading: 'SWOT Analysis', content: '', table: swotTable },
    { heading: 'Market Context', content: llm.market_context },
    { heading: 'Recommendations', content: llm.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n') },
  ];

  // ── PPTX slides ───────────────────────────────────────────────────
  const pptxSlides = [
    { heading: 'Overview', body: llm.overview },
    { heading: 'Competitor Summary', table: competitorTable },
    ...llm.competitor_summaries.map(c => ({
      heading: c.name,
      body:
        `${c.observations}\n\nKey Messages: ${c.key_messages.join(' · ') || '—'}\n` +
        `Channels: ${c.channels.join(', ') || '—'} | Est. Spend: ${c.estimated_spend}`,
    })),
    { heading: 'SWOT Analysis', table: swotTable },
    { heading: 'Market Context', body: llm.market_context },
    { heading: 'Recommendations', body: llm.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n') },
  ];

  // ── Generate & persist ────────────────────────────────────────────
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

  const { fileOutput } = await persistGeneratedFile({
    clientId: input.client_id,
    skillId: 'competitive-analysis',
    runId: input.run_id,
    fileType: primaryFormat,
    localPath,
    sizeBytes,
  });

  const output: DeliverySkillOutput = {
    skill_id: 'competitive-analysis',
    file: fileOutput,
    summary: llm.summary,
    generated_at: new Date().toISOString(),
  };
  if (tokenUsage) {
    (output as DeliverySkillOutput & { token_usage?: unknown }).token_usage = tokenUsage;
  }
  return output;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function empty(platform: 'meta' | 'google', advertiserName: string): AdLibraryResponse {
  return { platform, advertiser_name: advertiserName, ads: [], total_count: 0, fetched_at: new Date().toISOString(), cached: false };
}

function emptySearch(query: string): WebSearchResponse {
  return { query, results: [], cached: false, fetched_at: new Date().toISOString() };
}
