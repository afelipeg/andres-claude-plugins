// ─── Render Engine ──────────────────────────────────────────────────
// Generates payloads adapted to channel render level:
//   Nivel 1 (minimal): plain text + action URLs
//   Nivel 2 (rich):    markdown with engine breakdown + metrics
//   Nivel 3 (full):    JSON payload for scorecard web consumption

import type {
  RenderContext,
  RenderOutput,
  RenderAction,
  RiskScore,
  RenderLevel,
  HFLDecision,
} from './types.js';

export interface RenderInput {
  run_id: string;
  pipeline_id: string;
  risk_score: RiskScore;
  stage_results: Record<string, StageResultSummary>;
  billing?: BillingSummary;
  base_url: string;
  scorecard_base_url?: string; // Plinth URL for "Ver detalle" links
}

export interface StageResultSummary {
  agent_id: string;
  status: string;
  duration_ms: number;
  skills_invoked: string[];
  output_summary?: Record<string, unknown>;
  error?: string;
}

export interface BillingSummary {
  ad_spend: number;
  total_fee: number;
  value_delivered: number;
  roi_on_fee: number;
  tier: string;
  recovery_fee: number;
  lift_fee: number;
  efficiency_fee: number;
}

export class RenderEngine {
  render(context: RenderContext, input: RenderInput): RenderOutput {
    const actions = this.buildActions(input.run_id, input.base_url, input.scorecard_base_url);

    switch (context.channel.render_level) {
      case 'minimal':
        return this.renderMinimal(context, input, actions);
      case 'rich':
        return this.renderRich(context, input, actions);
      case 'full':
        return this.renderFull(context, input, actions);
      default:
        return this.renderMinimal(context, input, actions);
    }
  }

  /** Determine complexity from stage results */
  determineComplexity(stageResults: Record<string, StageResultSummary>): 'simple' | 'moderate' | 'complex' {
    const count = Object.keys(stageResults).length;
    const hasFailed = Object.values(stageResults).some((s) => s.status === 'failed' || s.status === 'timed_out');
    if (count <= 1 && !hasFailed) return 'simple';
    if (count <= 3 && !hasFailed) return 'moderate';
    return 'complex';
  }

  /** Pick render level based on channel config, urgency, complexity */
  resolveRenderLevel(
    channelLevel: RenderLevel,
    urgency: string,
    complexity: string,
  ): RenderLevel {
    // Channel config is the primary driver
    // But critical urgency or complex results always upgrade to at least 'rich'
    if (channelLevel === 'full') return 'full';
    if (urgency === 'critical' || complexity === 'complex') {
      return channelLevel === 'minimal' ? 'rich' : channelLevel;
    }
    return channelLevel;
  }

  // ─── Nivel 1: Minimal (plain text) ─────────────────────────────────

  private renderMinimal(
    context: RenderContext,
    input: RenderInput,
    actions: RenderAction[],
  ): RenderOutput {
    const stageCount = Object.keys(input.stage_results).length;
    const failedCount = Object.values(input.stage_results).filter(
      (s) => s.status === 'failed' || s.status === 'timed_out',
    ).length;

    let content = `[${context.urgency.toUpperCase()}] Pipeline ${input.pipeline_id} completed`;
    content += ` | ${stageCount} stages, ${failedCount} failed`;
    content += ` | Impact: $${input.risk_score.total_impact_usd.toFixed(2)}`;
    content += ` | ${input.risk_score.reason.split('\n')[0]}`;

    if (input.billing) {
      content += ` | Fee: $${input.billing.total_fee.toFixed(2)} (${input.billing.roi_on_fee.toFixed(1)}x ROI)`;
    }

    return { format: 'text', content, actions };
  }

  // ─── Nivel 2: Rich (markdown) ──────────────────────────────────────

  private renderRich(
    context: RenderContext,
    input: RenderInput,
    actions: RenderAction[],
  ): RenderOutput {
    const lines: string[] = [];

    // Header
    const urgencyEmoji = { low: '', medium: '', high: '', critical: '' }[context.urgency] ?? '';
    lines.push(`# ${urgencyEmoji} Pipeline Review Required`);
    lines.push('');
    lines.push(`**Run:** \`${input.run_id}\` | **Pipeline:** \`${input.pipeline_id}\``);
    lines.push(`**Urgency:** ${context.urgency} | **Impact:** $${input.risk_score.total_impact_usd.toFixed(2)}`);
    lines.push('');

    // Risk factors
    if (input.risk_score.risk_factors.length > 0) {
      lines.push('## Risk Factors');
      for (const factor of input.risk_score.risk_factors) {
        lines.push(`- ${factor}`);
      }
      lines.push('');
    }

    // Stage results
    lines.push('## Engine Results');
    lines.push('');
    lines.push('| Engine | Status | Duration | Skills |');
    lines.push('|--------|--------|----------|--------|');
    for (const [agentId, result] of Object.entries(input.stage_results)) {
      const statusIcon = result.status === 'completed' ? 'OK' : 'FAIL';
      const duration = `${(result.duration_ms / 1000).toFixed(1)}s`;
      const skills = result.skills_invoked.join(', ') || '-';
      lines.push(`| ${agentId} | ${statusIcon} | ${duration} | ${skills} |`);
    }
    lines.push('');

    // Billing summary
    if (input.billing) {
      lines.push('## Billing Summary');
      lines.push(`- **Ad Spend:** $${input.billing.ad_spend.toLocaleString()}`);
      lines.push(`- **Total Fee:** $${input.billing.total_fee.toFixed(2)} (${input.billing.tier})`);
      lines.push(`- **Value Delivered:** $${input.billing.value_delivered.toFixed(2)}`);
      lines.push(`- **ROI on Fee:** ${input.billing.roi_on_fee.toFixed(1)}x`);
      lines.push('');
    }

    // Actions
    lines.push('## Actions');
    for (const action of actions) {
      lines.push(`- [${action.label}](${action.url})`);
    }

    return { format: 'markdown', content: lines.join('\n'), actions };
  }

  // ─── Nivel 3: Full (JSON for scorecard web) ────────────────────────

  private renderFull(
    context: RenderContext,
    input: RenderInput,
    actions: RenderAction[],
  ): RenderOutput {
    const payload = {
      run_id: input.run_id,
      pipeline_id: input.pipeline_id,
      urgency: context.urgency,
      complexity: context.complexity,
      risk: {
        needs_human: input.risk_score.needs_human,
        urgency: input.risk_score.urgency,
        reason: input.risk_score.reason,
        risk_factors: input.risk_score.risk_factors,
        total_impact_usd: input.risk_score.total_impact_usd,
      },
      stages: Object.fromEntries(
        Object.entries(input.stage_results).map(([id, r]) => [
          id,
          {
            status: r.status,
            duration_ms: r.duration_ms,
            skills_invoked: r.skills_invoked,
            output_summary: r.output_summary ?? {},
            error: r.error,
          },
        ]),
      ),
      billing: input.billing ?? null,
      actions: actions.map((a) => ({
        label: a.label,
        url: a.url,
        method: a.method,
        style: a.style,
      })),
      generated_at: new Date().toISOString(),
    };

    return {
      format: 'json',
      content: JSON.stringify(payload, null, 2),
      actions,
      metadata: payload,
    };
  }

  // ─── Action URL builder ────────────────────────────────────────────

  private buildActions(runId: string, baseUrl: string, scorecardBaseUrl?: string): RenderAction[] {
    const actions: RenderAction[] = [
      {
        label: 'Approve',
        url: `${baseUrl}/v1/mesh/runs/${runId}/approve`,
        method: 'POST',
        style: 'primary',
      },
      {
        label: 'Reject',
        url: `${baseUrl}/v1/mesh/runs/${runId}/reject`,
        method: 'POST',
        style: 'danger',
      },
    ];

    // Add "Ver detalle" link to Plinth scorecard if configured
    if (scorecardBaseUrl) {
      actions.push({
        label: 'Ver detalle',
        url: `${scorecardBaseUrl}/runs/${runId}`,
        method: 'GET',
        style: 'secondary',
      });
    }

    return actions;
  }
}
