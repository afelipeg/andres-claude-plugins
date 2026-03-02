// ─── Engine Event Constructors ──────────────────────────────────────

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

export interface SkillStartedPayload {
  engine_id: string;
  skill_id: string;
  trace_id: string;
  client_id?: string;
}

export interface SkillCompletedPayload {
  engine_id: string;
  skill_id: string;
  trace_id: string;
  duration_ms: number;
  client_id?: string;
}

export interface SkillFailedPayload {
  engine_id: string;
  skill_id: string;
  trace_id: string;
  error: string;
  client_id?: string;
}

export function skillStarted(
  payload: SkillStartedPayload,
  metadata?: Record<string, unknown>,
): EngineEvent<SkillStartedPayload> {
  return createEvent('engine.skill.started', payload, metadata);
}

export function skillCompleted(
  payload: SkillCompletedPayload,
  metadata?: Record<string, unknown>,
): EngineEvent<SkillCompletedPayload> {
  return createEvent('engine.skill.completed', payload, metadata);
}

export function skillFailed(
  payload: SkillFailedPayload,
  metadata?: Record<string, unknown>,
): EngineEvent<SkillFailedPayload> {
  return createEvent('engine.skill.failed', payload, metadata);
}
