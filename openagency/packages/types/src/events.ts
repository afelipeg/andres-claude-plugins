// ─── Event Bus Types ────────────────────────────────────────────────

export type EngineEventType =
  | 'engine.skill.started'
  | 'engine.skill.completed'
  | 'engine.skill.failed'
  | 'engine.registered'
  | 'auth.token.issued'
  | 'auth.token.revoked'
  | 'api.request.received'
  | 'api.request.completed'
  // Agent lifecycle
  | 'agent.started'
  | 'agent.stopped'
  | 'agent.paused'
  | 'agent.resumed'
  // OODA cycle
  | 'agent.cycle.started'
  | 'agent.cycle.completed'
  | 'agent.cycle.failed'
  // Decisions
  | 'agent.decision.made'
  | 'agent.decision.approved'
  | 'agent.decision.rejected'
  // Actions
  | 'agent.action.executed'
  | 'agent.action.failed'
  | 'agent.action.rolled_back'
  // Domain signals
  | 'domain.waste_detected'
  | 'domain.anomaly_found'
  | 'domain.budget_reallocated'
  | 'domain.campaign_adjusted'
  | 'domain.executive_report'
  | 'domain.deliverables_ready'
  // Goals
  | 'domain.goal.progress'
  | 'domain.goal.completed'
  | 'domain.goal.failed'
  // Sync
  | 'sync.completed'
  | 'sync.failed'
  // Mesh orchestration
  | 'mesh.pipeline.started'
  | 'mesh.pipeline.completed'
  | 'mesh.pipeline.failed'
  | 'mesh.stage.started'
  | 'mesh.stage.completed'
  | 'mesh.stage.failed'
  | 'mesh.stage.skipped'
  // Human Feedback Loop
  | 'hfl.escalated'
  | 'hfl.auto_approved'
  | 'hfl.human_approved'
  | 'hfl.human_rejected'
  | 'hfl.dispatched'
  | 'hfl.timeout'
  // Pipeline Scheduler
  | 'mesh.schedule.created'
  | 'mesh.schedule.triggered'
  | 'mesh.schedule.deleted'
  // Delivery Engine
  | 'delivery.file_generated'
  | 'delivery.skill_completed'
  | 'delivery.search_completed';

export interface EngineEvent<T = unknown> {
  id: string; // ULID
  type: EngineEventType;
  timestamp: string; // ISO 8601
  payload: T;
  metadata: Record<string, unknown>;
}

export interface EventHandler<T = unknown> {
  (event: EngineEvent<T>): void | Promise<void>;
}

export interface EventBus {
  publish<T>(event: EngineEvent<T>): Promise<void>;
  subscribe<T>(
    type: EngineEventType,
    handler: EventHandler<T>,
  ): () => void; // returns unsubscribe function
  /** Subscribe to all events regardless of type */
  onAny<T>(handler: EventHandler<T>): () => void;
}
