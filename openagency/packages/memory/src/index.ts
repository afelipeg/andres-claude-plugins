// ─── @openagency/memory ─────────────────────────────────────────────
// PostgreSQL repositories for autonomous agent state.

export { AgentStateRepo } from './repositories/agent-state-repo.js';
export { DecisionRepo } from './repositories/decision-repo.js';
export { ActionLogRepo } from './repositories/action-log-repo.js';
export type { ActionLogEntry } from './repositories/action-log-repo.js';
export { OutcomeRepo } from './repositories/outcome-repo.js';
export type { OutcomeBeforeEntry } from './repositories/outcome-repo.js';
export { GoalRepo } from './repositories/goal-repo.js';
export { MemoryRepo } from './repositories/memory-repo.js';
export type { MemoryEntry } from './repositories/memory-repo.js';
export { generateEmbedding } from './vector/embeddings.js';
export { buildKeywordQuery } from './vector/fallback.js';
export { FileRepo } from './repositories/file-repo.js';
export { UserRepo } from './repositories/user-repo.js';
export type { UserRow } from './repositories/user-repo.js';
export { ConversationRepo, type ConversationRecord, type ConvMessage, type ConversationSummary } from './repos/conversation.js';
export { ScorecardDbRepo, type ScorecardDbRecord } from './repos/scorecard-db.js';
export { MeshRunRepo } from './repos/mesh-run.js';
export { ClientDataRepo, type ClientDataRecord } from './repos/client-data.js';
export { McpConnectionRepo, type McpConnectionRow } from './repositories/mcp-connection-repo.js';
export { DailyMetricsRepo, type DailyMetricRow } from './repos/daily-metrics.js';
export { FederationLogRepo, type FederationLogRow } from './repos/federation-log.js';
export { encrypt, decrypt } from './utils/encrypt.js';
