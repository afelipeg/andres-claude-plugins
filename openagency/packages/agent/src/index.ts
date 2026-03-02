// ─── @openagency/agent ──────────────────────────────────────────────
// Autonomous OODA loop runtime for OpenAgency engines.

export { OodaRuntime, type OodaRuntimeDeps } from './ooda-runtime.js';
export { ObserverPipeline } from './observers/pipeline.js';
export { SyncObserver } from './observers/sync-observer.js';
export { EventObserver } from './observers/event-observer.js';
export { ScheduleObserver } from './observers/schedule-observer.js';
export { ThresholdObserver, type ThresholdRule } from './observers/threshold-observer.js';
export type { ObservationSource } from './observers/types.js';
export { orient, type OrientContext } from './reasoning/orient-prompt.js';
export { decide, type DecideContext, type DecisionPlan, type PlannedActionSpec } from './reasoning/decide-prompt.js';
export { parseOrientationResponse, parseDecisionResponse } from './reasoning/response-parser.js';
export { ENGINE_ORIENT_PROMPTS, ENGINE_DECIDE_PROMPTS } from './reasoning/prompt-templates.js';
export { ActionExecutor } from './safety/action-executor.js';
export { OutcomeTracker } from './outcome-tracker.js';
export { AGENT_CONFIGS, getAgentConfig, listAgentEngineIds, type EngineAgentConfig } from './agents/engine-configs.js';
export { GoalDecomposer } from './goals/goal-decomposer.js';
export { GoalTracker } from './goals/goal-tracker.js';

// Mesh orchestration
export { MeshCoordinator } from './mesh/mesh-coordinator.js';
export { DEFAULT_PIPELINE } from './mesh/default-pipeline.js';
export { createUsageMeter, recordStageUsage, recordOutcome } from './mesh/usage-meter.js';
export type {
  MeshPipeline,
  MeshStage,
  MeshStageResult,
  MeshContext,
  MeshRun,
  MeshRunStatus,
  UsageMeter,
} from './mesh/types.js';
