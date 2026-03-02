// ─── Agent Event Constructors ───────────────────────────────────────

import { ulid } from 'ulid';
import type { EngineEvent, EngineEventType } from '@openagency/types';

function createEvent<T>(
  type: EngineEventType,
  payload: T,
  metadata?: Record<string, unknown>,
): EngineEvent<T> {
  return {
    id: ulid(),
    type,
    timestamp: new Date().toISOString(),
    payload,
    metadata: metadata ?? {},
  };
}

// ─── Agent Lifecycle ────────────────────────────────────────────────

export interface AgentStartedPayload {
  agent_id: string;
  engine_id: string;
}

export interface AgentStoppedPayload {
  agent_id: string;
  engine_id: string;
  reason?: string;
}

export interface AgentPausedPayload {
  agent_id: string;
  engine_id: string;
}

export interface AgentResumedPayload {
  agent_id: string;
  engine_id: string;
}

export function agentStarted(
  payload: AgentStartedPayload,
  metadata?: Record<string, unknown>,
): EngineEvent<AgentStartedPayload> {
  return createEvent('agent.started', payload, metadata);
}

export function agentStopped(
  payload: AgentStoppedPayload,
  metadata?: Record<string, unknown>,
): EngineEvent<AgentStoppedPayload> {
  return createEvent('agent.stopped', payload, metadata);
}

export function agentPaused(
  payload: AgentPausedPayload,
  metadata?: Record<string, unknown>,
): EngineEvent<AgentPausedPayload> {
  return createEvent('agent.paused', payload, metadata);
}

export function agentResumed(
  payload: AgentResumedPayload,
  metadata?: Record<string, unknown>,
): EngineEvent<AgentResumedPayload> {
  return createEvent('agent.resumed', payload, metadata);
}

// ─── OODA Cycle ─────────────────────────────────────────────────────

export interface AgentCycleStartedPayload {
  agent_id: string;
  cycle_id: string;
}

export interface AgentCycleCompletedPayload {
  agent_id: string;
  cycle_id: string;
  duration_ms: number;
  observation_count: number;
  action_count: number;
}

export interface AgentCycleFailedPayload {
  agent_id: string;
  cycle_id: string;
  error: string;
  phase: string;
}

export function agentCycleStarted(
  payload: AgentCycleStartedPayload,
  metadata?: Record<string, unknown>,
): EngineEvent<AgentCycleStartedPayload> {
  return createEvent('agent.cycle.started', payload, metadata);
}

export function agentCycleCompleted(
  payload: AgentCycleCompletedPayload,
  metadata?: Record<string, unknown>,
): EngineEvent<AgentCycleCompletedPayload> {
  return createEvent('agent.cycle.completed', payload, metadata);
}

export function agentCycleFailed(
  payload: AgentCycleFailedPayload,
  metadata?: Record<string, unknown>,
): EngineEvent<AgentCycleFailedPayload> {
  return createEvent('agent.cycle.failed', payload, metadata);
}

// ─── Decisions ──────────────────────────────────────────────────────

export interface AgentDecisionMadePayload {
  agent_id: string;
  decision_id: string;
  action_count: number;
  confidence: number;
  risk_level: string;
  requires_approval: boolean;
}

export interface AgentDecisionApprovedPayload {
  agent_id: string;
  decision_id: string;
  approved_by: string;
}

export interface AgentDecisionRejectedPayload {
  agent_id: string;
  decision_id: string;
  reason?: string;
}

export function agentDecisionMade(
  payload: AgentDecisionMadePayload,
  metadata?: Record<string, unknown>,
): EngineEvent<AgentDecisionMadePayload> {
  return createEvent('agent.decision.made', payload, metadata);
}

export function agentDecisionApproved(
  payload: AgentDecisionApprovedPayload,
  metadata?: Record<string, unknown>,
): EngineEvent<AgentDecisionApprovedPayload> {
  return createEvent('agent.decision.approved', payload, metadata);
}

export function agentDecisionRejected(
  payload: AgentDecisionRejectedPayload,
  metadata?: Record<string, unknown>,
): EngineEvent<AgentDecisionRejectedPayload> {
  return createEvent('agent.decision.rejected', payload, metadata);
}

// ─── Actions ────────────────────────────────────────────────────────

export interface AgentActionExecutedPayload {
  agent_id: string;
  action_id: string;
  action_type: string;
  target_platform?: string;
  target_id?: string;
  duration_ms: number;
  dry_run: boolean;
}

export interface AgentActionFailedPayload {
  agent_id: string;
  action_id: string;
  action_type: string;
  error: string;
}

export interface AgentActionRolledBackPayload {
  agent_id: string;
  action_id: string;
  action_type: string;
  reason: string;
}

export function agentActionExecuted(
  payload: AgentActionExecutedPayload,
  metadata?: Record<string, unknown>,
): EngineEvent<AgentActionExecutedPayload> {
  return createEvent('agent.action.executed', payload, metadata);
}

export function agentActionFailed(
  payload: AgentActionFailedPayload,
  metadata?: Record<string, unknown>,
): EngineEvent<AgentActionFailedPayload> {
  return createEvent('agent.action.failed', payload, metadata);
}

export function agentActionRolledBack(
  payload: AgentActionRolledBackPayload,
  metadata?: Record<string, unknown>,
): EngineEvent<AgentActionRolledBackPayload> {
  return createEvent('agent.action.rolled_back', payload, metadata);
}

// ─── Domain Signals ─────────────────────────────────────────────────

export interface DomainWasteDetectedPayload {
  agent_id: string;
  total_waste: number;
  waste_pct: number;
  top_categories: Array<{ category: string; amount: number }>;
}

export interface DomainAnomalyFoundPayload {
  agent_id: string;
  metric: string;
  expected: number;
  actual: number;
  deviation_pct: number;
  platform?: string;
  campaign_id?: string;
}

export interface DomainBudgetReallocatedPayload {
  agent_id: string;
  reallocations: Array<{
    from_campaign: string;
    to_campaign: string;
    amount: number;
    platform: string;
  }>;
}

export interface DomainCampaignAdjustedPayload {
  agent_id: string;
  campaign_id: string;
  platform: string;
  adjustment_type: string;
  previous_value: unknown;
  new_value: unknown;
}

export interface DomainExecutiveReportPayload {
  agent_id: string;
  report_type: string;
  summary: string;
  metrics: Record<string, number>;
}

export function domainWasteDetected(
  payload: DomainWasteDetectedPayload,
  metadata?: Record<string, unknown>,
): EngineEvent<DomainWasteDetectedPayload> {
  return createEvent('domain.waste_detected', payload, metadata);
}

export function domainAnomalyFound(
  payload: DomainAnomalyFoundPayload,
  metadata?: Record<string, unknown>,
): EngineEvent<DomainAnomalyFoundPayload> {
  return createEvent('domain.anomaly_found', payload, metadata);
}

export function domainBudgetReallocated(
  payload: DomainBudgetReallocatedPayload,
  metadata?: Record<string, unknown>,
): EngineEvent<DomainBudgetReallocatedPayload> {
  return createEvent('domain.budget_reallocated', payload, metadata);
}

export function domainCampaignAdjusted(
  payload: DomainCampaignAdjustedPayload,
  metadata?: Record<string, unknown>,
): EngineEvent<DomainCampaignAdjustedPayload> {
  return createEvent('domain.campaign_adjusted', payload, metadata);
}

export function domainExecutiveReport(
  payload: DomainExecutiveReportPayload,
  metadata?: Record<string, unknown>,
): EngineEvent<DomainExecutiveReportPayload> {
  return createEvent('domain.executive_report', payload, metadata);
}

// ─── Goals ──────────────────────────────────────────────────────────

export interface DomainGoalProgressPayload {
  agent_id: string;
  goal_id: string;
  progress_pct: number;
  current_value: number;
  target_value: number;
}

export interface DomainGoalCompletedPayload {
  agent_id: string;
  goal_id: string;
  final_value: number;
}

export interface DomainGoalFailedPayload {
  agent_id: string;
  goal_id: string;
  reason: string;
}

export function domainGoalProgress(
  payload: DomainGoalProgressPayload,
  metadata?: Record<string, unknown>,
): EngineEvent<DomainGoalProgressPayload> {
  return createEvent('domain.goal.progress', payload, metadata);
}

export function domainGoalCompleted(
  payload: DomainGoalCompletedPayload,
  metadata?: Record<string, unknown>,
): EngineEvent<DomainGoalCompletedPayload> {
  return createEvent('domain.goal.completed', payload, metadata);
}

export function domainGoalFailed(
  payload: DomainGoalFailedPayload,
  metadata?: Record<string, unknown>,
): EngineEvent<DomainGoalFailedPayload> {
  return createEvent('domain.goal.failed', payload, metadata);
}

// ─── Sync ───────────────────────────────────────────────────────────

export interface SyncCompletedPayload {
  platform: string;
  row_count: number;
  date_range: { start: string; end: string };
}

export interface SyncFailedPayload {
  platform: string;
  error: string;
}

export function syncCompleted(
  payload: SyncCompletedPayload,
  metadata?: Record<string, unknown>,
): EngineEvent<SyncCompletedPayload> {
  return createEvent('sync.completed', payload, metadata);
}

export function syncFailed(
  payload: SyncFailedPayload,
  metadata?: Record<string, unknown>,
): EngineEvent<SyncFailedPayload> {
  return createEvent('sync.failed', payload, metadata);
}
