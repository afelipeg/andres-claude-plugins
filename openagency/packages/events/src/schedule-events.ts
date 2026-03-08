// ─── Schedule Event Constructors ───────────────────────────────────

import { ulid } from 'ulid';
import type { EngineEvent, EngineEventType } from '@openagency/types';
import type {
  ScheduleCreatedPayload,
  ScheduleTriggeredPayload,
  ScheduleDeletedPayload,
} from '@openagency/types';

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

export function meshScheduleCreated(
  payload: ScheduleCreatedPayload,
  metadata?: Record<string, unknown>,
): EngineEvent<ScheduleCreatedPayload> {
  return createEvent('mesh.schedule.created', payload, metadata);
}

export function meshScheduleTriggered(
  payload: ScheduleTriggeredPayload,
  metadata?: Record<string, unknown>,
): EngineEvent<ScheduleTriggeredPayload> {
  return createEvent('mesh.schedule.triggered', payload, metadata);
}

export function meshScheduleDeleted(
  payload: ScheduleDeletedPayload,
  metadata?: Record<string, unknown>,
): EngineEvent<ScheduleDeletedPayload> {
  return createEvent('mesh.schedule.deleted', payload, metadata);
}

export type { ScheduleCreatedPayload, ScheduleTriggeredPayload, ScheduleDeletedPayload };
