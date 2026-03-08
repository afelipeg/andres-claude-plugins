export { InMemoryEventBus } from './in-memory-bus.js';
export { RedisEventBus } from './redis-bus.js';
export {
  // Mesh pipeline
  type MeshPipelineStartedPayload,
  type MeshPipelineCompletedPayload,
  type MeshPipelineFailedPayload,
  meshPipelineStarted,
  meshPipelineCompleted,
  meshPipelineFailed,
  // Mesh stage
  type MeshStageStartedPayload,
  type MeshStageCompletedPayload,
  type MeshStageFailedPayload,
  type MeshStageSkippedPayload,
  meshStageStarted,
  meshStageCompleted,
  meshStageFailed,
  meshStageSkipped,
} from './mesh-events.js';
export {
  type SkillStartedPayload,
  type SkillCompletedPayload,
  type SkillFailedPayload,
  skillStarted,
  skillCompleted,
  skillFailed,
} from './engine-events.js';
export {
  // Agent lifecycle
  type AgentStartedPayload,
  type AgentStoppedPayload,
  type AgentPausedPayload,
  type AgentResumedPayload,
  agentStarted,
  agentStopped,
  agentPaused,
  agentResumed,
  // OODA cycle
  type AgentCycleStartedPayload,
  type AgentCycleCompletedPayload,
  type AgentCycleFailedPayload,
  agentCycleStarted,
  agentCycleCompleted,
  agentCycleFailed,
  // Decisions
  type AgentDecisionMadePayload,
  type AgentDecisionApprovedPayload,
  type AgentDecisionRejectedPayload,
  agentDecisionMade,
  agentDecisionApproved,
  agentDecisionRejected,
  // Actions
  type AgentActionExecutedPayload,
  type AgentActionFailedPayload,
  type AgentActionRolledBackPayload,
  agentActionExecuted,
  agentActionFailed,
  agentActionRolledBack,
  // Domain signals
  type DomainWasteDetectedPayload,
  type DomainAnomalyFoundPayload,
  type DomainBudgetReallocatedPayload,
  type DomainCampaignAdjustedPayload,
  type DomainExecutiveReportPayload,
  domainWasteDetected,
  domainAnomalyFound,
  domainBudgetReallocated,
  domainCampaignAdjusted,
  domainExecutiveReport,
  // Goals
  type DomainGoalProgressPayload,
  type DomainGoalCompletedPayload,
  type DomainGoalFailedPayload,
  domainGoalProgress,
  domainGoalCompleted,
  domainGoalFailed,
  // Sync
  type SyncCompletedPayload,
  type SyncFailedPayload,
  syncCompleted,
  syncFailed,
} from './agent-events.js';

export {
  meshScheduleCreated,
  meshScheduleTriggered,
  meshScheduleDeleted,
  type ScheduleCreatedPayload,
  type ScheduleTriggeredPayload,
  type ScheduleDeletedPayload,
} from './schedule-events.js';

import type { EventBus } from '@openagency/types';
import { InMemoryEventBus } from './in-memory-bus.js';
import { RedisEventBus } from './redis-bus.js';

/** Create the appropriate event bus based on environment */
export function createEventBus(): EventBus {
  const redisUrl = process.env['REDIS_URL'];
  if (redisUrl) {
    return new RedisEventBus(redisUrl);
  }
  return new InMemoryEventBus();
}
