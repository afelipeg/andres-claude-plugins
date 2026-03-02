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
      'leak-detector:waste-waterfall',
      'leak-detector:supply-chain-audit',
      'leak-detector:media-quality-score',
    ],
    default_config: {
      cycle_interval_ms: 3_600_000, // 1 hour
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
      'media-architect:benchmark-health',
      'media-architect:anomaly-detect',
      'media-architect:channel-optimize',
      'media-architect:mmm-optimize',
    ],
    default_config: {
      cycle_interval_ms: 3_600_000,
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
      'campaign-ops:optimization-analyze',
      'campaign-ops:optimization-reallocate',
    ],
    default_config: {
      cycle_interval_ms: 1_800_000, // 30 minutes
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
      'executive-bridge:revenue-translate',
      'executive-bridge:shapley-attribute',
      'executive-bridge:reconcile',
    ],
    default_config: {
      cycle_interval_ms: 7_200_000, // 2 hours
      max_budget_change_pct: 0,
      approval_threshold_usd: Infinity,
      dry_run: true,
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
