// ─── Skill: client-scorecard-export ──────────────────────────────────
// Exports the client scorecard as XLSX (primary) + PDF (secondary).
// Both files are generated and returned; XLSX in `file`, PDF in `additional_files`.

import type { ClientScorecardExportInput } from '@openagency/schemas';
import type { DeliverySkillOutput } from '@openagency/types';
import { generateXlsx } from '../tools/file-generators/xlsx-generator.js';
import { generatePdf } from '../tools/file-generators/pdf-generator.js';
import {
  callDeliveryLLM,
  parseJsonResponse,
  persistGeneratedFile,
  summarizeLayerOne,
  tempPath,
} from './_skill-utils.js';

interface ScorecardLLM {
  executive_summary: string;
  scorecard_rows: { metric: string; category: string; target: string; actual: string; delta: string; status: string; trend: string }[];
  section_scores: { section: string; score: number; max_score: number; grade: string; highlights: string[] }[];
  overall_score: number;
  overall_grade: string;
  trend_analysis: string;
  action_priorities: { priority: number; action: string; expected_impact: string; timeline: string }[];
  summary: string;
}

const SYSTEM_PROMPT = `You are a performance analyst at Plinth by Polanyi building a client scorecard.
Create a comprehensive scorecard export with metrics, grades, and priorities.
Respond with valid JSON only.

JSON schema:
{
  "executive_summary": "2-paragraph scorecard narrative",
  "scorecard_rows": [
    { "metric": "ROAS", "category": "Efficiency", "target": "4.0x", "actual": "4.2x", "delta": "+5%", "status": "Exceeded", "trend": "Improving" }
  ],
  "section_scores": [
    { "section": "Waste Recovery", "score": 85, "max_score": 100, "grade": "B+", "highlights": ["Recovered $X in waste"] }
  ],
  "overall_score": 82,
  "overall_grade": "B+",
  "trend_analysis": "2-paragraph trend analysis",
  "action_priorities": [
    { "priority": 1, "action": "Increase budget on Meta", "expected_impact": "+15% ROAS", "timeline": "Next 30 days" }
  ],
  "summary": "One-sentence overall scorecard assessment"
}
Rules: Status values: Exceeded, On Track, At Risk, Missed. Grades: A+, A, B+, B, C+, C, D, F. Overall score 0-100. Categories: Efficiency, Waste, Reach, Conversion, Growth.`;

export async function run(input: ClientScorecardExportInput): Promise<DeliverySkillOutput> {
  const context = summarizeLayerOne(input.layer_one_results);
  const prompt = `Client: ${input.client_id}\nPeriod: ${input.period_start} to ${input.period_end}\n\nENGINE DATA:\n${context}\n\nGenerate the client scorecard.`;

  let llm: ScorecardLLM;
  try {
    llm = parseJsonResponse<ScorecardLLM>(await callDeliveryLLM(SYSTEM_PROMPT, prompt));
  } catch {
    llm = {
      executive_summary: `Scorecard for ${input.client_id} — ${input.period_start} to ${input.period_end}.`,
      scorecard_rows: [{ metric: 'Analysis Pending', category: '—', target: '—', actual: '—', delta: '—', status: 'Pending', trend: '—' }],
      section_scores: [],
      overall_score: 0,
      overall_grade: 'N/A',
      trend_analysis: 'Analysis pending. Configure ANTHROPIC_API_KEY for full scorecard.',
      action_priorities: [],
      summary: `Scorecard export for ${input.period_start} to ${input.period_end}.`,
    };
  }

  const title = 'Client Scorecard';
  const subtitle = `${llm.overall_grade} (${llm.overall_score}/100)  ·  ${input.period_start} → ${input.period_end}  ·  ${input.client_id}`;
  const formats = input.output_formats?.length ? input.output_formats : ['xlsx', 'pdf'];

  // ── XLSX (primary) ───────────────────────────────────────────────
  const xlsxPath = tempPath('xlsx');
  const xlsxResult = await generateXlsx({
    title,
    sheets: [
      {
        name: 'Scorecard',
        headers: ['Metric', 'Category', 'Target', 'Actual', 'Delta', 'Status', 'Trend'],
        rows: llm.scorecard_rows.map(r => [r.metric, r.category, r.target, r.actual, r.delta, r.status, r.trend]),
      },
      {
        name: 'Section Scores',
        headers: ['Section', 'Score', 'Max', 'Grade', 'Highlights'],
        rows: llm.section_scores.map(s => [s.section, s.score, s.max_score, s.grade, s.highlights.join('; ')]),
      },
      {
        name: 'Action Priorities',
        headers: ['Priority', 'Action', 'Expected Impact', 'Timeline'],
        rows: llm.action_priorities.map(a => [a.priority, a.action, a.expected_impact, a.timeline]),
      },
      {
        name: 'Summary',
        headers: ['Item', 'Value'],
        rows: [
          ['Overall Score', String(llm.overall_score)],
          ['Overall Grade', llm.overall_grade],
          ['Period', `${input.period_start} → ${input.period_end}`],
          ['Client', input.client_id],
          ['Summary', llm.summary],
        ],
      },
    ],
    output_path: xlsxPath,
  });

  const { fileOutput: xlsxFile } = await persistGeneratedFile({
    clientId: input.client_id,
    skillId: 'client-scorecard-export',
    runId: input.run_id,
    fileType: 'xlsx',
    localPath: xlsxPath,
    sizeBytes: xlsxResult.size_bytes,
  });

  // ── PDF (secondary, if requested) ────────────────────────────────
  const shouldGeneratePdf = formats.includes('pdf');
  let pdfFile = undefined;

  if (shouldGeneratePdf) {
    const pdfPath = tempPath('pdf');
    const pdfResult = await generatePdf({
      title,
      subtitle,
      sections: [
        { heading: 'Executive Summary', content: llm.executive_summary },
        {
          heading: 'Scorecard Metrics',
          content: '',
          table: {
            headers: ['Metric', 'Category', 'Target', 'Actual', 'Delta', 'Status'],
            rows: llm.scorecard_rows.map(r => [r.metric, r.category, r.target, r.actual, r.delta, r.status]),
          },
        },
        {
          heading: 'Section Grades',
          content: '',
          table: { headers: ['Section', 'Score', 'Grade', 'Highlights'], rows: llm.section_scores.map(s => [s.section, `${s.score}/${s.max_score}`, s.grade, s.highlights.join('; ')]) },
        },
        { heading: 'Trend Analysis', content: llm.trend_analysis },
        {
          heading: 'Action Priorities',
          content: '',
          table: { headers: ['Priority', 'Action', 'Impact', 'Timeline'], rows: llm.action_priorities.map(a => [String(a.priority), a.action, a.expected_impact, a.timeline]) },
        },
      ],
      output_path: pdfPath,
    });

    const { fileOutput } = await persistGeneratedFile({
      clientId: input.client_id,
      skillId: 'client-scorecard-export',
      runId: input.run_id,
      fileType: 'pdf',
      localPath: pdfPath,
      sizeBytes: pdfResult.size_bytes,
    });
    pdfFile = fileOutput;
  }

  return {
    skill_id: 'client-scorecard-export',
    file: xlsxFile,
    additional_files: pdfFile ? [pdfFile] : undefined,
    summary: llm.summary,
    generated_at: new Date().toISOString(),
  };
}
