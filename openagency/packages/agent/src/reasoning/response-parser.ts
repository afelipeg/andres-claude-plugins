// ─── LLM Response Parser ────────────────────────────────────────────
// Parses structured JSON from LLM responses with fallback handling.

import type { Orientation, AnomalySignal, OpportunitySignal, RiskSignal } from '@openagency/types';
import type { DecisionPlan } from './decide-prompt.js';

/** Extract JSON from LLM response that may contain markdown code blocks */
function extractJson(text: string): string {
  // Try to find JSON in code blocks
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch?.[1]) return codeBlockMatch[1].trim();

  // Try to find raw JSON object/array
  const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (jsonMatch?.[1]) return jsonMatch[1].trim();

  return text.trim();
}

export function parseOrientationResponse(
  raw: string,
  observationCount: number,
): Orientation {
  try {
    const json = extractJson(raw);
    const parsed = JSON.parse(json) as Partial<Orientation>;

    return {
      observations_analyzed: observationCount,
      context: parsed.context ?? {},
      anomalies: validateAnomalies(parsed.anomalies),
      opportunities: validateOpportunities(parsed.opportunities),
      risks: validateRisks(parsed.risks),
      reasoning: parsed.reasoning ?? raw,
    };
  } catch {
    // Fallback: return the raw text as reasoning with empty signals
    return {
      observations_analyzed: observationCount,
      context: {},
      anomalies: [],
      opportunities: [],
      risks: [],
      reasoning: raw,
    };
  }
}

export function parseDecisionResponse(raw: string): DecisionPlan {
  try {
    const json = extractJson(raw);
    const parsed = JSON.parse(json) as Partial<DecisionPlan>;

    return {
      actions: Array.isArray(parsed.actions) ? parsed.actions : [],
      reasoning: parsed.reasoning ?? raw,
      confidence: typeof parsed.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : 0.5,
      risk_level: validateRiskLevel(parsed.risk_level),
    };
  } catch {
    return {
      actions: [],
      reasoning: raw,
      confidence: 0.3,
      risk_level: 'low',
    };
  }
}

function validateAnomalies(anomalies: unknown): AnomalySignal[] {
  if (!Array.isArray(anomalies)) return [];
  return anomalies.filter(
    (a): a is AnomalySignal =>
      typeof a === 'object' && a !== null && 'metric' in a && 'severity' in a,
  );
}

function validateOpportunities(opportunities: unknown): OpportunitySignal[] {
  if (!Array.isArray(opportunities)) return [];
  return opportunities.filter(
    (o): o is OpportunitySignal =>
      typeof o === 'object' && o !== null && 'description' in o,
  );
}

function validateRisks(risks: unknown): RiskSignal[] {
  if (!Array.isArray(risks)) return [];
  return risks.filter(
    (r): r is RiskSignal =>
      typeof r === 'object' && r !== null && 'description' in r && 'severity' in r,
  );
}

function validateRiskLevel(level: unknown): 'low' | 'medium' | 'high' | 'critical' {
  if (level === 'low' || level === 'medium' || level === 'high' || level === 'critical') {
    return level;
  }
  return 'low';
}
