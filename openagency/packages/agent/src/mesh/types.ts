// ─── Agent Mesh Types ──────────────────────────────────────────────

import type { EngineEventType, OodaCycleResult } from '@openagency/types';

export interface MeshStage {
  agent_id: string;
  order: number;
  skills: string[];
  trigger_events: EngineEventType[];
  emit_events: EngineEventType[];
  timeout_ms: number;
  skip_if?: (context: MeshContext) => boolean;
}

export interface MeshPipeline {
  id: string;
  name: string;
  description: string;
  stages: MeshStage[];
  trigger: EngineEventType | 'manual';
}

export interface MeshStageResult {
  agent_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'timed_out';
  cycle_result?: OodaCycleResult;
  duration_ms: number;
  skills_invoked: string[];
  error?: string;
}

export interface MeshContext {
  run_id: string;
  stage_results: Map<string, MeshStageResult>;
  goal_id?: string;
  started_at: string;
}

export type MeshRunStatus = 'pending' | 'running' | 'completed' | 'partial' | 'failed';

export interface MeshRun {
  id: string;
  pipeline_id: string;
  status: MeshRunStatus;
  context: MeshContext;
  started_at: string;
  completed_at?: string;
  total_duration_ms: number;
  usage?: UsageMeter;
}

export interface UsageMeter {
  run_id: string;
  agent_client_id?: string;
  stages_executed: number;
  total_duration_ms: number;
  llm_tokens_used: { prompt: number; completion: number };
  actions_executed: number;
  outcomes: Record<string, unknown>;
}
