// ─── Pipeline Score ────────────────────────────────────────────────
// Computes a composite 0-100 quality score from a completed MeshRun.
// Used by HFL to auto-escalate when score drops below threshold.

import type { MeshStageResult } from './types.js';

export interface PipelineScoreBreakdown {
  /** Overall composite score 0–100 */
  composite: number;
  /** Stage health: completed stages / total stages (weight 40%) */
  stage_health: number;
  /** Action success: successful actions / total actions (weight 30%) */
  action_success: number;
  /** Risk signal: inverse of anomaly + risk density (weight 30%) */
  risk_signal: number;
}

/**
 * Compute a composite pipeline quality score from stage results.
 *
 * Dimensions (all 0–100):
 *   - stage_health  (40%): ratio of completed stages
 *   - action_success (30%): ratio of successful actions across all stages
 *   - risk_signal   (30%): fewer anomalies + risks = higher score
 */
export function computePipelineScore(
  stageResults: Map<string, MeshStageResult> | Record<string, MeshStageResult>,
): PipelineScoreBreakdown {
  const entries = stageResults instanceof Map
    ? Array.from(stageResults.values())
    : Object.values(stageResults);

  if (entries.length === 0) {
    return { composite: 0, stage_health: 0, action_success: 0, risk_signal: 0 };
  }

  // ─── Stage Health (40%) ─────────────────────────────────────────
  const totalStages = entries.length;
  const completedStages = entries.filter((r) => r.status === 'completed').length;
  const stageHealth = (completedStages / totalStages) * 100;

  // ─── Action Success (30%) ───────────────────────────────────────
  let totalActions = 0;
  let successfulActions = 0;

  for (const result of entries) {
    const summary = result.output_summary;
    if (!summary) continue;

    const actionResults = summary['action_results'] as
      | Array<{ status: string }>
      | undefined;
    if (actionResults) {
      totalActions += actionResults.length;
      successfulActions += actionResults.filter(
        (a) => a.status === 'completed' || a.status === 'success',
      ).length;
    } else {
      // Count skills_invoked as successful actions
      totalActions += result.skills_invoked.length;
      successfulActions += result.skills_invoked.length;
    }
  }

  const actionSuccess = totalActions > 0
    ? (successfulActions / totalActions) * 100
    : stageHealth; // fallback to stage health if no actions tracked

  // ─── Risk Signal (30%) ──────────────────────────────────────────
  let totalAnomalies = 0;
  let totalRisks = 0;

  for (const result of entries) {
    const summary = result.output_summary;
    if (!summary) continue;
    totalAnomalies += (summary['anomaly_count'] as number) ?? 0;
    totalRisks += (summary['risk_count'] as number) ?? 0;
  }

  // More anomalies + risks = lower score. Cap at 10 signals for 0.
  const riskDensity = (totalAnomalies + totalRisks) / totalStages;
  const riskSignal = Math.max(0, 100 - riskDensity * 10);

  // ─── Composite ──────────────────────────────────────────────────
  const composite = Math.round(
    stageHealth * 0.4 + actionSuccess * 0.3 + riskSignal * 0.3,
  );

  return {
    composite: Math.max(0, Math.min(100, composite)),
    stage_health: Math.round(stageHealth),
    action_success: Math.round(actionSuccess),
    risk_signal: Math.round(riskSignal),
  };
}

/** Default threshold below which HFL escalation is triggered */
export const HFL_SCORE_THRESHOLD = 40;
