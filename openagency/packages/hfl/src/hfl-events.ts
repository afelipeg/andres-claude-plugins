// ─── HFL Events ─────────────────────────────────────────────────────
// Event constructors for the Human Feedback Loop lifecycle.

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

// ─── Payload types ──────────────────────────────────────────────────

export interface HFLEscalatedPayload {
  decision_id: string;
  run_id: string;
  pipeline_id: string;
  urgency: string;
  reason: string;
  channel_id?: string;
}

export interface HFLAutoApprovedPayload {
  decision_id: string;
  run_id: string;
  pipeline_id: string;
  reason: string;
}

export interface HFLHumanApprovedPayload {
  decision_id: string;
  run_id: string;
  pipeline_id: string;
  feedback?: string;
}

export interface HFLHumanRejectedPayload {
  decision_id: string;
  run_id: string;
  pipeline_id: string;
  feedback?: string;
}

export interface HFLDispatchedPayload {
  decision_id: string;
  run_id: string;
  channel_id: string;
  success: boolean;
}

export interface HFLTimeoutPayload {
  decision_id: string;
  run_id: string;
  pipeline_id: string;
}

// ─── Event constructors ─────────────────────────────────────────────

export function hflEscalated(
  payload: HFLEscalatedPayload,
  metadata?: Record<string, unknown>,
): EngineEvent<HFLEscalatedPayload> {
  return createEvent('hfl.escalated', payload, metadata);
}

export function hflAutoApproved(
  payload: HFLAutoApprovedPayload,
  metadata?: Record<string, unknown>,
): EngineEvent<HFLAutoApprovedPayload> {
  return createEvent('hfl.auto_approved', payload, metadata);
}

export function hflHumanApproved(
  payload: HFLHumanApprovedPayload,
  metadata?: Record<string, unknown>,
): EngineEvent<HFLHumanApprovedPayload> {
  return createEvent('hfl.human_approved', payload, metadata);
}

export function hflHumanRejected(
  payload: HFLHumanRejectedPayload,
  metadata?: Record<string, unknown>,
): EngineEvent<HFLHumanRejectedPayload> {
  return createEvent('hfl.human_rejected', payload, metadata);
}

export function hflDispatched(
  payload: HFLDispatchedPayload,
  metadata?: Record<string, unknown>,
): EngineEvent<HFLDispatchedPayload> {
  return createEvent('hfl.dispatched', payload, metadata);
}

export function hflTimeout(
  payload: HFLTimeoutPayload,
  metadata?: Record<string, unknown>,
): EngineEvent<HFLTimeoutPayload> {
  return createEvent('hfl.timeout', payload, metadata);
}
