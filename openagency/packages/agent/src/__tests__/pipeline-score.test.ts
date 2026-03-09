// ─── Pipeline Score Tests ──────────────────────────────────────────
import { describe, it, expect } from 'vitest';
import { computePipelineScore, HFL_SCORE_THRESHOLD } from '../mesh/pipeline-score.js';
import type { MeshStageResult } from '../mesh/types.js';

function makeResult(overrides: Partial<MeshStageResult> = {}): MeshStageResult {
  return {
    agent_id: 'test-agent',
    status: 'completed',
    duration_ms: 1000,
    skills_invoked: ['skill-a'],
    output_summary: {
      action_count: 1,
      action_results: [{ type: 'skill_execution', status: 'completed' }],
      anomaly_count: 0,
      risk_count: 0,
    },
    ...overrides,
  };
}

describe('computePipelineScore', () => {
  it('returns 0 for empty stage results', () => {
    const score = computePipelineScore(new Map());
    expect(score.composite).toBe(0);
  });

  it('returns 100 for a perfect run (all completed, no risks)', () => {
    const stages = new Map<string, MeshStageResult>();
    stages.set('leak-detector', makeResult({ agent_id: 'leak-detector' }));
    stages.set('media-architect', makeResult({ agent_id: 'media-architect' }));
    stages.set('campaign-ops', makeResult({ agent_id: 'campaign-ops' }));

    const score = computePipelineScore(stages);
    expect(score.composite).toBe(100);
    expect(score.stage_health).toBe(100);
    expect(score.action_success).toBe(100);
    expect(score.risk_signal).toBe(100);
  });

  it('returns low score when all stages fail', () => {
    const stages = new Map<string, MeshStageResult>();
    stages.set('leak-detector', makeResult({ status: 'failed', skills_invoked: [], output_summary: undefined }));
    stages.set('media-architect', makeResult({ status: 'failed', skills_invoked: [], output_summary: undefined }));

    const score = computePipelineScore(stages);
    expect(score.stage_health).toBe(0);
    expect(score.composite).toBeLessThan(HFL_SCORE_THRESHOLD);
  });

  it('returns medium score when half stages fail', () => {
    const stages = new Map<string, MeshStageResult>();
    stages.set('leak-detector', makeResult({ agent_id: 'leak-detector' }));
    stages.set('media-architect', makeResult({ agent_id: 'media-architect', status: 'failed', skills_invoked: [], output_summary: undefined }));

    const score = computePipelineScore(stages);
    expect(score.stage_health).toBe(50);
    expect(score.composite).toBeLessThanOrEqual(80);
    expect(score.composite).toBeGreaterThan(0);
  });

  it('penalizes anomalies and risks', () => {
    const stages = new Map<string, MeshStageResult>();
    stages.set('leak-detector', makeResult({
      agent_id: 'leak-detector',
      output_summary: {
        action_count: 1,
        action_results: [{ type: 'skill_execution', status: 'completed' }],
        anomaly_count: 5,
        risk_count: 8,
      },
    }));

    const score = computePipelineScore(stages);
    expect(score.risk_signal).toBeLessThan(100);
    // 5 + 8 = 13 anomalies/risks for 1 stage = density 13, capped signal = 0
    expect(score.risk_signal).toBe(0);
  });

  it('works with Record<string, MeshStageResult> (not just Map)', () => {
    const stages: Record<string, MeshStageResult> = {
      'leak-detector': makeResult({ agent_id: 'leak-detector' }),
      'media-architect': makeResult({ agent_id: 'media-architect' }),
    };

    const score = computePipelineScore(stages);
    expect(score.composite).toBe(100);
  });

  it('handles timed_out stages as non-completed', () => {
    const stages = new Map<string, MeshStageResult>();
    stages.set('leak-detector', makeResult({ status: 'timed_out', skills_invoked: [], output_summary: undefined }));
    stages.set('media-architect', makeResult({ agent_id: 'media-architect' }));

    const score = computePipelineScore(stages);
    expect(score.stage_health).toBe(50);
  });

  it('threshold constant is 40', () => {
    expect(HFL_SCORE_THRESHOLD).toBe(40);
  });
});
