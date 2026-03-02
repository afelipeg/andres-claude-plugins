// ─── Response Parser Tests ─────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { parseOrientationResponse, parseDecisionResponse } from '../reasoning/response-parser.js';

describe('parseOrientationResponse', () => {
  it('parses valid JSON', () => {
    const json = JSON.stringify({
      context: { engine: 'test' },
      anomalies: [{ metric: 'ctr', expected: 0.05, actual: 0.02, deviation_pct: -60, severity: 'high' }],
      opportunities: [{ description: 'Rebalance', potential_impact: 5000, confidence: 0.8, suggested_action: 'Shift' }],
      risks: [{ description: 'Overspend', severity: 'medium', probability: 0.5, mitigation: 'Cap' }],
      reasoning: 'Analysis complete',
    });

    const result = parseOrientationResponse(json, 5);
    expect(result.observations_analyzed).toBe(5);
    expect(result.anomalies).toHaveLength(1);
    expect(result.opportunities).toHaveLength(1);
    expect(result.risks).toHaveLength(1);
    expect(result.reasoning).toBe('Analysis complete');
  });

  it('extracts JSON from markdown code blocks', () => {
    const raw = `Here's my analysis:

\`\`\`json
{
  "context": {},
  "anomalies": [],
  "opportunities": [],
  "risks": [],
  "reasoning": "From code block"
}
\`\`\`

That's the analysis.`;

    const result = parseOrientationResponse(raw, 3);
    expect(result.reasoning).toBe('From code block');
    expect(result.observations_analyzed).toBe(3);
  });

  it('falls back to raw text on invalid JSON', () => {
    const raw = 'This is not JSON at all. Just a plain text response from the LLM.';

    const result = parseOrientationResponse(raw, 2);
    expect(result.observations_analyzed).toBe(2);
    expect(result.reasoning).toBe(raw);
    expect(result.anomalies).toEqual([]);
    expect(result.opportunities).toEqual([]);
    expect(result.risks).toEqual([]);
  });
});

describe('parseDecisionResponse', () => {
  it('parses valid decision JSON', () => {
    const json = JSON.stringify({
      actions: [
        { type: 'skill_execution', target: {}, parameters: { skill: 'test' }, estimated_impact: 'Impact' },
      ],
      reasoning: 'Execute skill',
      confidence: 0.9,
      risk_level: 'low',
    });

    const result = parseDecisionResponse(json);
    expect(result.actions).toHaveLength(1);
    expect(result.confidence).toBe(0.9);
    expect(result.risk_level).toBe('low');
  });

  it('clamps confidence to 0-1 range', () => {
    const overConfident = JSON.stringify({
      actions: [],
      reasoning: 'Over confident',
      confidence: 1.5,
      risk_level: 'low',
    });
    expect(parseDecisionResponse(overConfident).confidence).toBe(1);

    const negativeConfidence = JSON.stringify({
      actions: [],
      reasoning: 'Negative',
      confidence: -0.5,
      risk_level: 'low',
    });
    expect(parseDecisionResponse(negativeConfidence).confidence).toBe(0);
  });

  it('falls back on invalid JSON with low confidence', () => {
    const raw = 'The LLM just returned prose, not JSON.';

    const result = parseDecisionResponse(raw);
    expect(result.actions).toEqual([]);
    expect(result.reasoning).toBe(raw);
    expect(result.confidence).toBe(0.3);
    expect(result.risk_level).toBe('low');
  });
});
