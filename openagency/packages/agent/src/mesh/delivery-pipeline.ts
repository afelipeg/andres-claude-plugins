// ─── Full-With-Deliverables Pipeline ─────────────────────────────────
// Extends the full optimization pipeline with a Delivery Engine stage
// that generates client-facing deliverables from Layer-1 outputs.

import type { MeshPipeline } from './types.js';

/**
 * 5-stage pipeline: full optimization → delivery engine
 * Generates scorecards, reports, and decks after optimization runs.
 */
export const DELIVERY_PIPELINE: MeshPipeline = {
  id: 'full-with-deliverables',
  name: 'Full Optimization + Delivery Pipeline',
  description:
    'End-to-end optimization (4 engines) followed by Delivery Engine: ' +
    'generates monthly report, client scorecard, and learnings digest from live engine outputs.',
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
      timeout_ms: 180_000,
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
      timeout_ms: 300_000,
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
      timeout_ms: 240_000,
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
      timeout_ms: 360_000,
    },
    {
      agent_id: 'delivery',
      order: 5,
      skills: [
        'monthly-report',
        'client-scorecard-export',
        'learnings-digest',
      ],
      trigger_events: ['domain.executive_report'],
      emit_events: ['domain.deliverables_ready'],
      timeout_ms: 300_000, // 5 min — LLM + file generation for 3 skills
    },
  ],
};
