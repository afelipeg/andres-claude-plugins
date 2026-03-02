// ─── Skill Schema Registry ──────────────────────────────────────────
// Single source of truth mapping engine:skill -> Zod input/output schemas.

import type { z } from 'zod';
import {
  WasteWaterfallInputSchema,
  WasteWaterfallOutputSchema,
  WasteEstimateInputSchema,
  WasteCompareInputSchema,
  WasteCompareOutputSchema,
  SupplyChainInputSchema,
  SupplyChainOutputSchema,
  QualityScoreInputSchema,
  QualityScoreOutputSchema,
} from './leak-detector.js';
import {
  ChannelOptimizerInputSchema,
  ChannelOptimizerOutputSchema,
  MMMPreModelInputSchema,
  MMMPreModelOutputSchema,
  MMMModelInputSchema,
  MMMModelOutputSchema,
  MMMOptimizeInputSchema,
  MMMOptimizeOutputSchema,
  BenchmarkHealthInputSchema,
  BenchmarkHealthOutputSchema,
  AnomalyDetectInputSchema,
  AnomalyDetectOutputSchema,
  MediaPlanInputSchema,
  MediaPlanOutputSchema,
} from './media-architect.js';
import {
  CampaignCreateInputSchema,
  CampaignStateSchema,
  TaskUpdateInputSchema,
  OptimizationInputSchema,
  OptimizationOutputSchema,
  ReallocateInputSchema,
  ReallocateOutputSchema,
} from './campaign-ops.js';
import {
  ShapleyInputSchema,
  ShapleyOutputSchema,
  ShapleyCompareInputSchema,
  ShapleyCompareOutputSchema,
  RevenueBridgeInputSchema,
  RevenueBridgeOutputSchema,
  ReconcileInputSchema,
  ReconcileOutputSchema,
  IntegrityInputSchema,
  IntegrityOutputSchema,
  GeoLiftInputSchema,
  GeoLiftOutputSchema,
  ConversionLiftInputSchema,
  ConversionLiftOutputSchema,
  HoldoutInputSchema,
  HoldoutOutputSchema,
} from './executive-bridge.js';

export interface SkillSchemaEntry {
  engineId: string;
  skillId: string;
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  outputSchema: z.ZodTypeAny;
}

export const SKILL_SCHEMAS: SkillSchemaEntry[] = [
  // ─── Leak Detector ──────────────────────────────────────────────
  {
    engineId: 'leak-detector',
    skillId: 'waste-waterfall',
    name: 'Waste Waterfall',
    description:
      '6-stage waste decomposition of ad spend: non-working, supply chain, quality, audience, optimization, measurement',
    inputSchema: WasteWaterfallInputSchema,
    outputSchema: WasteWaterfallOutputSchema,
  },
  {
    engineId: 'leak-detector',
    skillId: 'waste-estimate',
    name: 'Waste Estimate',
    description:
      'Quick waste estimate from budget alone using industry benchmarks',
    inputSchema: WasteEstimateInputSchema,
    outputSchema: WasteWaterfallOutputSchema,
  },
  {
    engineId: 'leak-detector',
    skillId: 'waste-compare',
    name: 'Waste Compare',
    description: 'Compare waste across two periods to track improvement',
    inputSchema: WasteCompareInputSchema,
    outputSchema: WasteCompareOutputSchema,
  },
  {
    engineId: 'leak-detector',
    skillId: 'supply-chain-audit',
    name: 'Supply Chain Audit',
    description:
      'Audit intermediary fees, working media ratios, and supply path optimization',
    inputSchema: SupplyChainInputSchema,
    outputSchema: SupplyChainOutputSchema,
  },
  {
    engineId: 'leak-detector',
    skillId: 'media-quality-score',
    name: 'Media Quality Score',
    description:
      'Score media quality across fraud, viewability, brand safety, and MFA dimensions',
    inputSchema: QualityScoreInputSchema,
    outputSchema: QualityScoreOutputSchema,
  },

  // ─── Media Architect ────────────────────────────────────────────
  {
    engineId: 'media-architect',
    skillId: 'channel-optimize',
    name: 'Channel Optimizer',
    description:
      'Optimize budget allocation across channels using Hill saturation curves',
    inputSchema: ChannelOptimizerInputSchema,
    outputSchema: ChannelOptimizerOutputSchema,
  },
  {
    engineId: 'media-architect',
    skillId: 'channel-scenario',
    name: 'Channel Scenario Analysis',
    description:
      'Scenario analysis for different budget levels across channels',
    inputSchema: ChannelOptimizerInputSchema,
    outputSchema: ChannelOptimizerOutputSchema,
  },
  {
    engineId: 'media-architect',
    skillId: 'mmm-pre-model',
    name: 'MMM Pre-Model',
    description:
      'Data readiness assessment before running Marketing Mix Model',
    inputSchema: MMMPreModelInputSchema,
    outputSchema: MMMPreModelOutputSchema,
  },
  {
    engineId: 'media-architect',
    skillId: 'mmm-model',
    name: 'MMM Model',
    description:
      'Full Marketing Mix Model with channel parameters, response curves, and contribution analysis',
    inputSchema: MMMModelInputSchema,
    outputSchema: MMMModelOutputSchema,
  },
  {
    engineId: 'media-architect',
    skillId: 'mmm-post-model',
    name: 'MMM Post-Model',
    description: 'Post-modeling analysis and scenario generation from MMM results',
    inputSchema: MMMModelInputSchema,
    outputSchema: MMMModelOutputSchema,
  },
  {
    engineId: 'media-architect',
    skillId: 'mmm-optimize',
    name: 'MMM Optimize',
    description:
      'Scenario planning and budget reallocation using MMM parameters',
    inputSchema: MMMOptimizeInputSchema,
    outputSchema: MMMOptimizeOutputSchema,
  },
  {
    engineId: 'media-architect',
    skillId: 'benchmark-health',
    name: 'Benchmark Health',
    description:
      'Compare channel performance against industry benchmarks',
    inputSchema: BenchmarkHealthInputSchema,
    outputSchema: BenchmarkHealthOutputSchema,
  },
  {
    engineId: 'media-architect',
    skillId: 'anomaly-detect',
    name: 'Anomaly Detection',
    description:
      'Statistical anomaly detection using z-score analysis',
    inputSchema: AnomalyDetectInputSchema,
    outputSchema: AnomalyDetectOutputSchema,
  },
  {
    engineId: 'media-architect',
    skillId: 'media-plan',
    name: 'Media Plan Generator',
    description:
      'Generate insertion orders, flowcharts, and UTM taxonomy for media plans',
    inputSchema: MediaPlanInputSchema,
    outputSchema: MediaPlanOutputSchema,
  },

  // ─── Campaign Ops ───────────────────────────────────────────────
  {
    engineId: 'campaign-ops',
    skillId: 'campaign-create',
    name: 'Campaign Create',
    description:
      'Initialize campaign state machine with 24-task DAG across 4 sprints',
    inputSchema: CampaignCreateInputSchema,
    outputSchema: CampaignStateSchema,
  },
  {
    engineId: 'campaign-ops',
    skillId: 'campaign-update-task',
    name: 'Campaign Update Task',
    description: 'Update a task status in the campaign DAG',
    inputSchema: TaskUpdateInputSchema,
    outputSchema: CampaignStateSchema,
  },
  {
    engineId: 'campaign-ops',
    skillId: 'campaign-summary',
    name: 'Campaign Summary',
    description: 'Get current campaign state with progress and blockers',
    inputSchema: CampaignStateSchema,
    outputSchema: CampaignStateSchema,
  },
  {
    engineId: 'campaign-ops',
    skillId: 'campaign-next-actions',
    name: 'Campaign Next Actions',
    description: 'Get next unblocked tasks ready for execution',
    inputSchema: CampaignStateSchema,
    outputSchema: CampaignStateSchema,
  },
  {
    engineId: 'campaign-ops',
    skillId: 'optimization-analyze',
    name: 'Optimization Analyze',
    description:
      'Analyze campaign performance against targets with alerts for pacing, CPA, ROAS, CTR',
    inputSchema: OptimizationInputSchema,
    outputSchema: OptimizationOutputSchema,
  },
  {
    engineId: 'campaign-ops',
    skillId: 'optimization-reallocate',
    name: 'Optimization Reallocate',
    description:
      'Cross-channel budget reallocation recommendations based on ROAS',
    inputSchema: ReallocateInputSchema,
    outputSchema: ReallocateOutputSchema,
  },

  // ─── Executive Bridge ───────────────────────────────────────────
  {
    engineId: 'executive-bridge',
    skillId: 'shapley-attribute',
    name: 'Shapley Attribution',
    description:
      'Coalition-based attribution using Shapley values for fair credit allocation',
    inputSchema: ShapleyInputSchema,
    outputSchema: ShapleyOutputSchema,
  },
  {
    engineId: 'executive-bridge',
    skillId: 'shapley-compare',
    name: 'Shapley Compare',
    description:
      'Compare Shapley attribution vs last-click with efficiency analysis',
    inputSchema: ShapleyCompareInputSchema,
    outputSchema: ShapleyCompareOutputSchema,
  },
  {
    engineId: 'executive-bridge',
    skillId: 'revenue-translate',
    name: 'Revenue Translate',
    description:
      'Translate L3 media metrics to L2 efficiency to L1 business outcomes',
    inputSchema: RevenueBridgeInputSchema,
    outputSchema: RevenueBridgeOutputSchema,
  },
  {
    engineId: 'executive-bridge',
    skillId: 'revenue-compare',
    name: 'Revenue Compare',
    description:
      'Compare revenue efficiency across channels with C-suite summaries',
    inputSchema: RevenueBridgeInputSchema,
    outputSchema: RevenueBridgeOutputSchema,
  },
  {
    engineId: 'executive-bridge',
    skillId: 'reconcile',
    name: 'Reconcile',
    description:
      'Platform data reconciliation detecting over-reporting and measurement waste',
    inputSchema: ReconcileInputSchema,
    outputSchema: ReconcileOutputSchema,
  },
  {
    engineId: 'executive-bridge',
    skillId: 'integrity',
    name: 'Measurement Integrity',
    description:
      'Score measurement infrastructure maturity across 5 dimensions',
    inputSchema: IntegrityInputSchema,
    outputSchema: IntegrityOutputSchema,
  },
  {
    engineId: 'executive-bridge',
    skillId: 'geo-lift',
    name: 'Geo Lift Test',
    description:
      'Power analysis for geo lift incrementality tests',
    inputSchema: GeoLiftInputSchema,
    outputSchema: GeoLiftOutputSchema,
  },
  {
    engineId: 'executive-bridge',
    skillId: 'conversion-lift',
    name: 'Conversion Lift Test',
    description:
      'Power analysis for conversion lift incrementality tests',
    inputSchema: ConversionLiftInputSchema,
    outputSchema: ConversionLiftOutputSchema,
  },
  {
    engineId: 'executive-bridge',
    skillId: 'holdout',
    name: 'Holdout Test',
    description:
      'Power analysis for holdout incrementality tests with revenue-at-risk calculation',
    inputSchema: HoldoutInputSchema,
    outputSchema: HoldoutOutputSchema,
  },
];

/** Map from "engineId:skillId" to SkillSchemaEntry for O(1) lookups */
export const SKILL_SCHEMA_MAP = new Map<string, SkillSchemaEntry>(
  SKILL_SCHEMAS.map((s) => [`${s.engineId}:${s.skillId}`, s]),
);

/** Get schema by engine/skill IDs, throws if not found */
export function getSkillSchema(
  engineId: string,
  skillId: string,
): SkillSchemaEntry {
  const entry = SKILL_SCHEMA_MAP.get(`${engineId}:${skillId}`);
  if (!entry) {
    throw new Error(
      `Unknown skill "${engineId}:${skillId}". Available: ${SKILL_SCHEMAS.map((s) => `${s.engineId}:${s.skillId}`).join(', ')}`,
    );
  }
  return entry;
}

/** Get all skills for an engine */
export function getEngineSkills(engineId: string): SkillSchemaEntry[] {
  return SKILL_SCHEMAS.filter((s) => s.engineId === engineId);
}

/** List all unique engine IDs */
export function listEngineIds(): string[] {
  return [...new Set(SKILL_SCHEMAS.map((s) => s.engineId))];
}
