// ─── Default Full Optimization Pipeline ─────────────────────────────

import type { MeshPipeline } from './types.js';

/**
 * Full 4-stage optimization pipeline:
 * Leak Detector → Media Architect → Campaign Ops → Executive Bridge
 *
 * Total pipeline: ~18 min worst case, ~6 min typical.
 */
export const DEFAULT_PIPELINE: MeshPipeline = {
  id: 'full-optimization',
  name: 'Full Optimization Pipeline',
  description:
    'End-to-end advertising optimization: detect waste, reallocate budgets, adjust campaigns, generate executive reports. A single pipeline that replaces an entire agency engagement.',
  trigger: 'manual',
  stages: [
    {
      agent_id: 'leak-detector',
      order: 1,
      skills: [
        'waste-waterfall',
        'waste-estimate',
        'waste-compare',
        'supply-chain-audit',
        'media-quality-score',
      ],
      trigger_events: ['sync.completed'],
      emit_events: ['domain.waste_detected'],
      timeout_ms: 180_000, // 3 min — 5 read-only analytical skills
    },
    {
      agent_id: 'media-architect',
      order: 2,
      skills: [
        'channel-optimize',
        'channel-scenario',
        'mmm-pre-model',
        'mmm-model',
        'mmm-post-model',
        'mmm-optimize',
        'benchmark-health',
        'anomaly-detect',
        'media-plan',
      ],
      trigger_events: ['domain.waste_detected'],
      emit_events: ['domain.budget_reallocated', 'domain.anomaly_found'],
      timeout_ms: 300_000, // 5 min — heaviest computation (MMM model fitting)
    },
    {
      agent_id: 'campaign-ops',
      order: 3,
      skills: [
        'optimization-analyze',
        'optimization-reallocate',
        'campaign-create',
        'campaign-update-task',
        'campaign-summary',
        'campaign-next-actions',
      ],
      trigger_events: ['domain.budget_reallocated', 'domain.anomaly_found'],
      emit_events: ['domain.campaign_adjusted'],
      timeout_ms: 240_000, // 4 min — potential connector writes with safety pipeline
    },
    {
      agent_id: 'executive-bridge',
      order: 4,
      skills: [
        'revenue-translate',
        'revenue-compare',
        'shapley-attribute',
        'shapley-compare',
        'reconcile',
        'integrity',
        'geo-lift',
        'conversion-lift',
        'holdout',
      ],
      trigger_events: ['domain.campaign_adjusted'],
      emit_events: ['domain.executive_report'],
      timeout_ms: 360_000, // 6 min — Shapley O(2^n) coalition analysis
    },
  ],
};
