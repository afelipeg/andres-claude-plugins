// ─── Risk Scorer ────────────────────────────────────────────────────
// Evaluates whether a mesh run needs human approval or auto-executes.
// Pure logic — no side effects, no network calls.

import type {
  HFLConfig,
  RiskInput,
  RiskScore,
  Urgency,
  EscalationRule,
} from './types.js';

export class RiskScorer {
  constructor(private config: HFLConfig) {}

  evaluate(input: RiskInput): RiskScore {
    const factors: string[] = [];
    let maxUrgency: Urgency = 'low';
    let totalImpact = 0;

    // Calculate total proposed impact
    if (input.proposed_actions?.length) {
      totalImpact = input.proposed_actions.reduce(
        (sum, a) => sum + Math.abs(a.estimated_impact_usd),
        0,
      );
    }

    // ─── Rule 1: First run always escalates ─────────────────────────
    if (input.is_first_run) {
      factors.push('first_run_for_client');
      maxUrgency = escalateUrgency(maxUrgency, 'medium');
    }

    // ─── Rule 2: Budget impact above threshold ──────────────────────
    if (totalImpact > this.config.auto_approve_threshold) {
      factors.push(`impact_above_threshold: $${totalImpact.toFixed(2)} > $${this.config.auto_approve_threshold}`);
      maxUrgency = escalateUrgency(maxUrgency, 'high');
    }

    // ─── Rule 3: Pipeline had failures ──────────────────────────────
    if (input.stages_failed > 0) {
      factors.push(`stages_failed: ${input.stages_failed}/${input.stages_executed + input.stages_failed}`);
      maxUrgency = escalateUrgency(maxUrgency, 'medium');
    }

    // ─── Rule 4: Custom escalation rules ────────────────────────────
    for (const rule of this.config.escalation_rules) {
      if (evaluateCondition(rule, totalImpact, input)) {
        factors.push(`escalation_rule: ${rule.condition}`);
        maxUrgency = escalateUrgency(maxUrgency, rule.urgency);
      }
    }

    const needsHuman =
      (factors.length > 0 && totalImpact > this.config.auto_approve_threshold) ||
      factors.some((f) => f.startsWith('escalation_rule:')) ||
      input.is_first_run ||
      input.stages_failed > 0;

    // Auto-approve: no risk factors and within threshold
    if (!needsHuman) {
      return {
        needs_human: false,
        urgency: 'low',
        reason: 'Within auto-approve policy — no risk factors detected',
        risk_factors: [],
        total_impact_usd: totalImpact,
      };
    }

    const reason = buildReason(factors, totalImpact);

    return {
      needs_human: true,
      urgency: maxUrgency,
      reason,
      risk_factors: factors,
      total_impact_usd: totalImpact,
    };
  }

  updateConfig(config: Partial<HFLConfig>): void {
    Object.assign(this.config, config);
  }

  getConfig(): HFLConfig {
    return { ...this.config };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────

const URGENCY_ORDER: Urgency[] = ['low', 'medium', 'high', 'critical'];

function escalateUrgency(current: Urgency, candidate: Urgency): Urgency {
  const currentIdx = URGENCY_ORDER.indexOf(current);
  const candidateIdx = URGENCY_ORDER.indexOf(candidate);
  return candidateIdx > currentIdx ? candidate : current;
}

function evaluateCondition(
  rule: EscalationRule,
  totalImpact: number,
  input: RiskInput,
): boolean {
  const condition = rule.condition.trim();

  // budget_change > N
  const budgetMatch = condition.match(/^budget_change\s*>\s*(\d+)$/);
  if (budgetMatch) {
    return totalImpact > Number(budgetMatch[1]);
  }

  // stages_failed > N
  const failedMatch = condition.match(/^stages_failed\s*>\s*(\d+)$/);
  if (failedMatch) {
    return input.stages_failed > Number(failedMatch[1]);
  }

  // duration > N (ms)
  const durationMatch = condition.match(/^duration\s*>\s*(\d+)$/);
  if (durationMatch) {
    return input.total_duration_ms > Number(durationMatch[1]);
  }

  return false;
}

function buildReason(factors: string[], totalImpact: number): string {
  const parts = factors.map((f) => `- ${f}`);
  return `Escalation required (impact: $${totalImpact.toFixed(2)}):\n${parts.join('\n')}`;
}

/** Create a default HFL config for a client */
export function createDefaultConfig(clientId: string): HFLConfig {
  return {
    client_id: clientId,
    auto_approve_threshold: 1000,
    channels: [],
    default_channel: '',
    escalation_rules: [
      { condition: 'budget_change > 10000', urgency: 'critical', channel_id: '' },
      { condition: 'stages_failed > 2', urgency: 'high', channel_id: '' },
    ],
    timeout_ms: 3600_000, // 1 hour
  };
}
