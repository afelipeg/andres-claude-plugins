// Plinth Bootstrap Singleton
// Initializes engines, repos, MCP server, event bus — cached via globalThis
// Survives Next.js hot reloads in dev, runs once in production

import { OpenAgency } from '@openagency/core';
import { LeakDetectorEngine, MediaArchitectEngine, CampaignOpsEngine, ExecutiveBridgeEngine, DeliveryEngine } from '@openagency/engines';
import { createEventBus } from '@openagency/events';
import { SKILL_SCHEMAS } from '@openagency/schemas';
import {
  ConversationRepo,
  AgencyRepo,
  QuotaRepo,
  UserRepo,
  MeshRunRepo,
  AgentStateRepo,
  DecisionRepo,
  ActionLogRepo,
  OutcomeRepo,
  GoalRepo,
  MemoryRepo,
  FileRepo,
  HFLDecisionRepo,
} from '@openagency/memory';
import { KBFolderRepo, KBDocumentRepo, KBChunkRepo } from '@openagency/kb';
import { HFLCoordinator } from '@openagency/hfl';
import { getDb } from './db';

export interface PlinthInstance {
  agency: OpenAgency;
  eventBus: ReturnType<typeof createEventBus>;
  db: unknown | null;
  repos: {
    conversation: ConversationRepo | null;
    agency: AgencyRepo | null;
    quota: QuotaRepo | null;
    user: UserRepo | null;
    meshRun: MeshRunRepo | null;
    agentState: AgentStateRepo | null;
    decision: DecisionRepo | null;
    actionLog: ActionLogRepo | null;
    outcome: OutcomeRepo | null;
    goal: GoalRepo | null;
    memory: MemoryRepo | null;
    file: FileRepo | null;
    hflDecision: HFLDecisionRepo | null;
    kbFolder: KBFolderRepo | null;
    kbDocument: KBDocumentRepo | null;
    kbChunk: KBChunkRepo | null;
  };
  hfl: HFLCoordinator;
  skillSchemas: typeof SKILL_SCHEMAS;
}

const globalForPlinth = globalThis as unknown as {
  plinthInstance: PlinthInstance | null;
};

export async function getPlinth(): Promise<PlinthInstance> {
  if (globalForPlinth.plinthInstance) return globalForPlinth.plinthInstance;

  // Bootstrap engines
  const agency = new OpenAgency();
  agency.engines.register(new LeakDetectorEngine());
  agency.engines.register(new MediaArchitectEngine());
  agency.engines.register(new CampaignOpsEngine());
  agency.engines.register(new ExecutiveBridgeEngine());
  agency.engines.register(new DeliveryEngine());

  // Event bus
  const eventBus = createEventBus();

  // Database + repos
  const db = await getDb();
  const repos = {
    conversation: db ? new ConversationRepo(db) : null,
    agency: db ? new AgencyRepo(db) : null,
    quota: db ? new QuotaRepo(db) : null,
    user: db ? new UserRepo(db) : null,
    meshRun: db ? new MeshRunRepo(db) : null,
    agentState: db ? new AgentStateRepo(db) : null,
    decision: db ? new DecisionRepo(db) : null,
    actionLog: db ? new ActionLogRepo(db) : null,
    outcome: db ? new OutcomeRepo(db) : null,
    goal: db ? new GoalRepo(db) : null,
    memory: db ? new MemoryRepo(db) : null,
    file: db ? new FileRepo(db) : null,
    hflDecision: db ? new HFLDecisionRepo(db) : null,
    kbFolder: db ? new KBFolderRepo(db) : null,
    kbDocument: db ? new KBDocumentRepo(db) : null,
    kbChunk: db ? new KBChunkRepo(db) : null,
  };

  // HFL Coordinator
  const hfl = new HFLCoordinator(eventBus);

  const instance: PlinthInstance = {
    agency,
    eventBus,
    db,
    repos,
    hfl,
    skillSchemas: SKILL_SCHEMAS,
  };

  globalForPlinth.plinthInstance = instance;
  return instance;
}
