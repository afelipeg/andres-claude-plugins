// ─── Mesh Event Constructors ───────────────────────────────────────

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

// ─── Pipeline Events ───────────────────────────────────────────────

export interface MeshPipelineStartedPayload {
  run_id: string;
  pipeline_id: string;
  goal_id?: string;
  stage_count: number;
}

export interface MeshPipelineCompletedPayload {
  run_id: string;
  pipeline_id: string;
  total_duration_ms: number;
  stages_executed: number;
  stages_failed: number;
}

export interface MeshPipelineFailedPayload {
  run_id: string;
  pipeline_id: string;
  error: string;
  stages_completed: number;
}

export function meshPipelineStarted(
  payload: MeshPipelineStartedPayload,
  metadata?: Record<string, unknown>,
): EngineEvent<MeshPipelineStartedPayload> {
  return createEvent('mesh.pipeline.started', payload, metadata);
}

export function meshPipelineCompleted(
  payload: MeshPipelineCompletedPayload,
  metadata?: Record<string, unknown>,
): EngineEvent<MeshPipelineCompletedPayload> {
  return createEvent('mesh.pipeline.completed', payload, metadata);
}

export function meshPipelineFailed(
  payload: MeshPipelineFailedPayload,
  metadata?: Record<string, unknown>,
): EngineEvent<MeshPipelineFailedPayload> {
  return createEvent('mesh.pipeline.failed', payload, metadata);
}

// ─── Stage Events ──────────────────────────────────────────────────

export interface MeshStageStartedPayload {
  run_id: string;
  pipeline_id: string;
  agent_id: string;
  stage_order: number;
}

export interface MeshStageCompletedPayload {
  run_id: string;
  pipeline_id: string;
  agent_id: string;
  stage_order: number;
  duration_ms: number;
  skills_invoked: string[];
}

export interface MeshStageFailedPayload {
  run_id: string;
  pipeline_id: string;
  agent_id: string;
  stage_order: number;
  error: string;
}

export interface MeshStageSkippedPayload {
  run_id: string;
  pipeline_id: string;
  agent_id: string;
  stage_order: number;
  reason: string;
}

export function meshStageStarted(
  payload: MeshStageStartedPayload,
  metadata?: Record<string, unknown>,
): EngineEvent<MeshStageStartedPayload> {
  return createEvent('mesh.stage.started', payload, metadata);
}

export function meshStageCompleted(
  payload: MeshStageCompletedPayload,
  metadata?: Record<string, unknown>,
): EngineEvent<MeshStageCompletedPayload> {
  return createEvent('mesh.stage.completed', payload, metadata);
}

export function meshStageFailed(
  payload: MeshStageFailedPayload,
  metadata?: Record<string, unknown>,
): EngineEvent<MeshStageFailedPayload> {
  return createEvent('mesh.stage.failed', payload, metadata);
}

export function meshStageSkipped(
  payload: MeshStageSkippedPayload,
  metadata?: Record<string, unknown>,
): EngineEvent<MeshStageSkippedPayload> {
  return createEvent('mesh.stage.skipped', payload, metadata);
}
