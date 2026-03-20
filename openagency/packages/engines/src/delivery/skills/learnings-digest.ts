// ─── Skill: learnings-digest ─────────────────────────────────────────
// Generates a PDF/DOCX digest of key learnings from the reporting period,
// including what worked, what didn't, and hypotheses for the next period.
// Tier: standard (analytical narrative, pattern recognition)

import type { LearningsDigestInput } from '@openagency/schemas';
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

interface LearningsLLM {
  period_context: string;
  what_worked: { finding: string; evidence: string; recommendation: string }[];
  what_didnt: { finding: string; evidence: string; recommendation: string }[];
  patterns: { pattern: string; confidence: string; implication: string }[];
  hypotheses: { hypothesis: string; test: string; expected_outcome: string }[];
  knowledge_gaps: string[];
  summary: string;
}

const SYSTEM_PROMPT = `You are a performance analyst at Plinth by Polanyi distilling key learnings from media campaigns.
Create a learnings digest that captures institutional knowledge from the reporting period.
Respond with valid JSON only.

JSON schema:
{
  "period_context": "2-paragraph context setting what happened in this period",
  "what_worked": [ { "finding": "What worked", "evidence": "Data supporting this", "recommendation": "How to scale it" } ],
  "what_didnt": [ { "finding": "What failed", "evidence": "Data showing this", "recommendation": "What to avoid or change" } ],
  "patterns": [ { "pattern": "Observed pattern", "confidence": "High/Medium/Low", "implication": "Strategic implication" } ],
  "hypotheses": [ { "hypothesis": "Testable hypothesis for next period", "test": "How to test it", "expected_outcome": "What success looks like" } ],
  "knowledge_gaps": ["Area where we need more data"],
  "summary": "One-sentence key takeaway from the period"
}
Rules: what_worked and what_didnt: 3-5 each. Patterns: 3-5. Hypotheses: 2-4. Evidence must cite specific metrics. Tone: analytical, learning-oriented.`;

export async function run(input: LearningsDigestInput): Promise<DeliverySkillOutput> {
  const context = summarizeLayerOne(input.layer_one_results);
  const prompt = `Client: ${input.client_id}\nPeriod: ${input.period_start} to ${input.period_end}\n\nENGINE DATA:\n${context}\n\nGenerate the learnings digest.`;

  let llm: LearningsLLM;
  let tokenUsage: { input_tokens: number; output_tokens: number } | undefined;
  try {
    const result = await callDeliveryLLM(SYSTEM_PROMPT, prompt, 'standard');
    tokenUsage = result.usage;
    llm = parseJsonResponse<LearningsLLM>(result.content);
  } catch {
    llm = {
      period_context: `Learnings digest for ${input.period_start} to ${input.period_end} — ${input.client_id}.`,
      what_worked: [],
      what_didnt: [],
      patterns: [],
      hypotheses: [],
      knowledge_gaps: ['Full analysis pending ANTHROPIC_API_KEY configuration.'],
      summary: `Learnings digest for ${input.period_start} to ${input.period_end}.`,
    };
  }

  const title = 'Learnings Digest';
  const subtitle = `${input.period_start} → ${input.period_end}  ·  ${input.client_id}`;
  const formats = input.output_formats ?? ['pdf'];
  const primaryFormat = formats[0]!;

  const workedTable = { headers: ['Finding', 'Evidence', 'Recommendation'], rows: llm.what_worked.map(w => [w.finding, w.evidence, w.recommendation]) };
  const didntTable = { headers: ['Finding', 'Evidence', 'Recommendation'], rows: llm.what_didnt.map(w => [w.finding, w.evidence, w.recommendation]) };
  const patternsTable = { headers: ['Pattern', 'Confidence', 'Implication'], rows: llm.patterns.map(p => [p.pattern, p.confidence, p.implication]) };
  const hypothesesTable = { headers: ['Hypothesis', 'How to Test', 'Expected Outcome'], rows: llm.hypotheses.map(h => [h.hypothesis, h.test, h.expected_outcome]) };

  const sections = [
    { heading: 'Period Context', content: llm.period_context },
    { heading: 'What Worked', content: '', table: workedTable },
    { heading: 'What Did Not Work', content: '', table: didntTable },
    { heading: 'Patterns Identified', content: '', table: patternsTable },
    { heading: 'Hypotheses for Next Period', content: '', table: hypothesesTable },
    { heading: 'Knowledge Gaps', content: llm.knowledge_gaps.map((g, i) => `${i + 1}. ${g}`).join('\n') },
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

  const { fileOutput } = await persistGeneratedFile({ clientId: input.client_id, skillId: 'learnings-digest', runId: input.run_id, fileType: primaryFormat, localPath, sizeBytes });

  const output: DeliverySkillOutput = { skill_id: 'learnings-digest', file: fileOutput, summary: llm.summary, generated_at: new Date().toISOString() };
  if (tokenUsage) {
    (output as DeliverySkillOutput & { token_usage?: unknown }).token_usage = tokenUsage;
  }
  return output;
}
