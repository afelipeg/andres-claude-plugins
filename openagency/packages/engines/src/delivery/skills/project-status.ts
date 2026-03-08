// ─── Skill: project-status ───────────────────────────────────────────
// Generates a project status / milestone tracking document (PDF/DOCX)
// showing KPIs vs targets and active initiatives.

import type { ProjectStatusInput } from '@openagency/schemas';
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

interface ProjectStatusLLM {
  executive_summary: string;
  overall_status: 'on-track' | 'at-risk' | 'delayed';
  milestones: { name: string; status: string; due_date: string; completion_pct: string; notes: string }[];
  kpi_scorecard: { kpi: string; target: string; actual: string; delta: string; status: string }[];
  active_initiatives: { initiative: string; owner: string; progress: string; blocker: string }[];
  risks: { risk: string; impact: string; likelihood: string; mitigation: string }[];
  next_steps: string[];
  summary: string;
}

const SYSTEM_PROMPT = `You are a project management analyst at Plinth by Polanyi.
Create a project status report showing KPI achievement and initiative progress.
Respond with valid JSON only.

JSON schema:
{
  "executive_summary": "2-paragraph status summary",
  "overall_status": "on-track | at-risk | delayed",
  "milestones": [ { "name": "Campaign Launch", "status": "Completed", "due_date": "2026-01-15", "completion_pct": "100%", "notes": "Launched on schedule" } ],
  "kpi_scorecard": [ { "kpi": "ROAS", "target": "4.0x", "actual": "3.8x", "delta": "-5%", "status": "At Risk" } ],
  "active_initiatives": [ { "initiative": "Creative refresh", "owner": "Creative team", "progress": "60%", "blocker": "None" } ],
  "risks": [ { "risk": "Budget overrun", "impact": "High", "likelihood": "Low", "mitigation": "Weekly budget monitoring" } ],
  "next_steps": ["Action item 1"],
  "summary": "One-sentence overall project status"
}
Rules: Status values: on-track, at-risk, delayed. Delta as % change vs target. KPI status: On Track, At Risk, Missed, Exceeded.`;

export async function run(input: ProjectStatusInput): Promise<DeliverySkillOutput> {
  const context = summarizeLayerOne(input.layer_one_results);
  const asOf = input.as_of_date ?? new Date().toISOString().split('T')[0];
  const prompt = `Client: ${input.client_id}\nAs of: ${asOf}\n\nENGINE DATA:\n${context}\n\nGenerate the project status report.`;

  let llm: ProjectStatusLLM;
  try {
    llm = parseJsonResponse<ProjectStatusLLM>(await callDeliveryLLM(SYSTEM_PROMPT, prompt));
  } catch {
    llm = {
      executive_summary: `Project status report as of ${asOf} for ${input.client_id}.`,
      overall_status: 'on-track',
      milestones: [],
      kpi_scorecard: [],
      active_initiatives: [],
      risks: [],
      next_steps: ['Review with ANTHROPIC_API_KEY configured.'],
      summary: `Project status as of ${asOf}.`,
    };
  }

  const statusEmoji = { 'on-track': '✓ On Track', 'at-risk': '⚠ At Risk', 'delayed': '✗ Delayed' }[llm.overall_status] ?? llm.overall_status;
  const title = 'Project Status Report';
  const subtitle = `${statusEmoji}  ·  As of ${asOf}  ·  ${input.client_id}`;
  const formats = input.output_formats ?? ['pdf'];
  const primaryFormat = formats[0]!;

  const sections = [
    { heading: 'Executive Summary', content: llm.executive_summary },
    { heading: 'KPI Scorecard', content: '', table: { headers: ['KPI', 'Target', 'Actual', 'Delta', 'Status'], rows: llm.kpi_scorecard.map(k => [k.kpi, k.target, k.actual, k.delta, k.status]) } },
    { heading: 'Milestones', content: '', table: { headers: ['Milestone', 'Status', 'Due Date', 'Completion', 'Notes'], rows: llm.milestones.map(m => [m.name, m.status, m.due_date, m.completion_pct, m.notes]) } },
    { heading: 'Active Initiatives', content: '', table: { headers: ['Initiative', 'Owner', 'Progress', 'Blocker'], rows: llm.active_initiatives.map(i => [i.initiative, i.owner, i.progress, i.blocker || 'None']) } },
    { heading: 'Risks', content: '', table: { headers: ['Risk', 'Impact', 'Likelihood', 'Mitigation'], rows: llm.risks.map(r => [r.risk, r.impact, r.likelihood, r.mitigation]) } },
    { heading: 'Next Steps', content: llm.next_steps.map((s, i) => `${i + 1}. ${s}`).join('\n') },
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

  const { fileOutput } = await persistGeneratedFile({ clientId: input.client_id, skillId: 'project-status', runId: input.run_id, fileType: primaryFormat, localPath, sizeBytes });
  return { skill_id: 'project-status', file: fileOutput, summary: llm.summary, generated_at: new Date().toISOString() };
}
