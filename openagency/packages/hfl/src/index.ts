// ─── Human Feedback Loop ────────────────────────────────────────────
// Backend module that decides WHEN to escalate to humans, through
// WHICH channel, and WHAT to show them.

export { RiskScorer, createDefaultConfig } from './risk-scorer.js';
export { RenderEngine } from './render-engine.js';
export type { RenderInput, StageResultSummary, BillingSummary } from './render-engine.js';
export { ChannelDispatcher } from './channel-dispatcher.js';
export type { DispatchOptions } from './channel-dispatcher.js';
export { HFLCoordinator } from './coordinator.js';
export type { MeshRunSummary, HFLCoordinatorOptions } from './coordinator.js';

// Types
export type {
  HFLConfig,
  ChannelConfig,
  RenderLevel,
  EscalationRule,
  Urgency,
  RiskInput,
  ProposedAction,
  RiskScore,
  RenderContext,
  RenderOutput,
  RenderAction,
  RenderAttachment,
  DispatchResult,
  HFLStatus,
  HFLDecision,
} from './types.js';

// Events
export {
  type HFLEscalatedPayload,
  type HFLAutoApprovedPayload,
  type HFLHumanApprovedPayload,
  type HFLHumanRejectedPayload,
  type HFLDispatchedPayload,
  type HFLTimeoutPayload,
  hflEscalated,
  hflAutoApproved,
  hflHumanApproved,
  hflHumanRejected,
  hflDispatched,
  hflTimeout,
} from './hfl-events.js';
