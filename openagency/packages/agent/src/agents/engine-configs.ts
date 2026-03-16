// ─── Per-Engine Agent Configurations ────────────────────────────────

import type { EngineEventType, AgentConfiguration } from '@openagency/types';

export interface EngineAgentConfig {
  engine_id: string;
  subscriptions: EngineEventType[];
  orient_skills: string[];
  default_config: AgentConfiguration;
}

export const AGENT_CONFIGS: Record<string, EngineAgentConfig> = {
  'leak-detector': {
    engine_id: 'leak-detector',
    subscriptions: ['sync.completed'],
    orient_skills: [
      // Core waste analysis
      'leak-detector:waste-waterfall',
      'leak-detector:waste-estimate',
      'leak-detector:waste-compare',
      // Supply chain & quality
      'leak-detector:supply-chain-audit',
      'leak-detector:media-quality-score',
    ],
    default_config: {
      cycle_interval_ms: 3_600_000, // 1 hour
      min_cycle_interval_ms: 5_000,
      max_budget_change_pct: 0, // does not modify budgets
      approval_threshold_usd: Infinity,
      dry_run: true,
      writable_platforms: [],
    },
  },

  'media-architect': {
    engine_id: 'media-architect',
    subscriptions: ['sync.completed', 'domain.waste_detected'],
    orient_skills: [
      // Benchmarking & anomaly detection
      'media-architect:benchmark-health',
      'media-architect:anomaly-detect',
      // Channel optimization
      'media-architect:channel-optimize',
      'media-architect:channel-scenario',
      // Full MMM pipeline
      'media-architect:mmm-pre-model',
      'media-architect:mmm-model',
      'media-architect:mmm-post-model',
      'media-architect:mmm-optimize',
      // Media planning
      'media-architect:media-plan',
    ],
    default_config: {
      cycle_interval_ms: 3_600_000,
      min_cycle_interval_ms: 5_000,
      max_budget_change_pct: 15,
      approval_threshold_usd: 5000,
      dry_run: true,
      writable_platforms: [],
    },
  },

  'campaign-ops': {
    engine_id: 'campaign-ops',
    subscriptions: [
      'sync.completed',
      'domain.waste_detected',
      'domain.budget_reallocated',
      'domain.anomaly_found',
    ],
    orient_skills: [
      // Campaign state machine
      'campaign-ops:campaign-create',
      'campaign-ops:campaign-update-task',
      'campaign-ops:campaign-summary',
      'campaign-ops:campaign-next-actions',
      // Performance optimization
      'campaign-ops:optimization-analyze',
      'campaign-ops:optimization-reallocate',
    ],
    default_config: {
      cycle_interval_ms: 1_800_000, // 30 minutes
      min_cycle_interval_ms: 5_000,
      max_budget_change_pct: 20,
      approval_threshold_usd: 2000,
      dry_run: true,
      writable_platforms: [],
    },
  },

  'executive-bridge': {
    engine_id: 'executive-bridge',
    subscriptions: [
      'domain.waste_detected',
      'domain.budget_reallocated',
      'domain.campaign_adjusted',
    ],
    orient_skills: [
      // Revenue translation
      'executive-bridge:revenue-translate',
      'executive-bridge:revenue-compare',
      // Attribution
      'executive-bridge:shapley-attribute',
      'executive-bridge:shapley-compare',
      // Reconciliation & integrity
      'executive-bridge:reconcile',
      'executive-bridge:integrity',
      // Incrementality tests
      'executive-bridge:geo-lift',
      'executive-bridge:conversion-lift',
      'executive-bridge:holdout',
    ],
    default_config: {
      cycle_interval_ms: 7_200_000, // 2 hours
      min_cycle_interval_ms: 5_000,
      max_budget_change_pct: 0,
      approval_threshold_usd: Infinity,
      dry_run: true,
      writable_platforms: [],
    },
  },

  'delivery': {
    engine_id: 'delivery',
    subscriptions: ['domain.executive_report', 'domain.deliverables_ready'],
    orient_skills: [
      // Reports
      'delivery:monthly-report',
      'delivery:quarterly-review',
      'delivery:project-status',
      // Exports & scorecards
      'delivery:client-scorecard-export',
      'delivery:industry-benchmarks',
      // Analysis documents
      'delivery:competitive-analysis',
      'delivery:budget-proposal',
      'delivery:campaign-brief',
      'delivery:media-plan-deck',
      // Digests
      'delivery:learnings-digest',
    ],
    default_config: {
      cycle_interval_ms: 86_400_000, // 24 hours (triggered by pipeline, not cron)
      min_cycle_interval_ms: 5_000,
      max_budget_change_pct: 0,
      approval_threshold_usd: Infinity,
      dry_run: false,
      writable_platforms: [],
    },
  },
};

export function getAgentConfig(engineId: string): EngineAgentConfig {
  const config = AGENT_CONFIGS[engineId];
  if (!config) {
    throw new Error(`No agent config for engine: ${engineId}`);
  }
  return config;
}

export function listAgentEngineIds(): string[] {
  return Object.keys(AGENT_CONFIGS);
}
