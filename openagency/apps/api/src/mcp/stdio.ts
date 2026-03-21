#!/usr/bin/env node
// ─── MCP stdio Entry Point (Full Infrastructure for Claude Desktop) ──
// Boots the complete OpenAgency stack (DB, mesh, connectors, HFL, all 5
// engines, 63+ MCP tools) over stdio transport for Claude Desktop.
//
// CRITICAL: stdout is reserved EXCLUSIVELY for MCP JSON-RPC messages.
// ALL other output (logs, DB warnings, errors) MUST go to stderr.

// MUST be set before any import so pino writes to stderr, not stdout
process.env['MCP_STDIO'] = '1';

// Redirect ALL console output to stderr — stdout is for MCP JSON-RPC only
const stderrWrite = (...args: unknown[]) => {
  process.stderr.write(args.map(String).join(' ') + '\n');
};
console.log = stderrWrite;
console.info = stderrWrite;
console.warn = stderrWrite;
console.error = stderrWrite;
console.debug = stderrWrite;

// Intercept process.stdout.write — only allow valid JSON-RPC messages through.
// Pino and postgres driver write directly to stdout bypassing console.
const originalStdoutWrite = process.stdout.write.bind(process.stdout) as (chunk: Buffer | string) => boolean;
(process.stdout as unknown as { write: (chunk: Buffer | string, cb?: unknown) => boolean }).write = (chunk: Buffer | string, cb?: unknown): boolean => {
  const str = typeof chunk === 'string' ? chunk : chunk.toString();
  if (str.trimStart().startsWith('{') && str.includes('"jsonrpc"')) {
    return originalStdoutWrite(chunk);
  }
  process.stderr.write(chunk);
  return true;
};

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { OpenAgency, detectLLMConfig, createLogger } from '@openagency/core';
import {
  LeakDetectorEngine,
  MediaArchitectEngine,
  CampaignOpsEngine,
  ExecutiveBridgeEngine,
  DeliveryEngine,
} from '@openagency/engines';
import { createEventBus } from '@openagency/events';
import {
  OodaRuntime,
  MeshCoordinator,
  DEFAULT_PIPELINE,
  DELIVERY_PIPELINE,
  PipelineScheduler,
  GoalDecomposer,
  GoalTracker,
  A2AClient,
  McpClientRegistry,
  ActionExecutor,
} from '@openagency/agent';
import { listAgentEngineIds } from '@openagency/agent';
import { SKILL_SCHEMAS, DynamicSkillRegistry } from '@openagency/schemas';
import {
  AgentStateRepo,
  DecisionRepo,
  ActionLogRepo,
  OutcomeRepo,
  GoalRepo,
  MemoryRepo,
  FileRepo,
  MeshRunRepo,
  AgencyRepo,
  QuotaRepo,
  HFLDecisionRepo,
} from '@openagency/memory';
import { HFLCoordinator } from '@openagency/hfl';
import { setupConnectors } from '../connectors/setup.js';
import { getDb } from '../db/client.js';
import { createMcpServer } from './server.js';

const log = createLogger('mcp-stdio');

async function main() {
  log.info('Booting OpenAgency MCP (stdio) — full infrastructure');

  // ─── Engines (all 5) ──────────────────────────────────────────
  const agency = new OpenAgency();
  agency.engines.register(new LeakDetectorEngine());
  agency.engines.register(new MediaArchitectEngine());
  agency.engines.register(new CampaignOpsEngine());
  agency.engines.register(new ExecutiveBridgeEngine());
  agency.engines.register(new DeliveryEngine());

  // ─── Event bus ────────────────────────────────────────────────
  const eventBus = createEventBus();

  // ─── Connector infrastructure ────────────────────────────────
  const connectorInfra = setupConnectors(eventBus);

  // ─── Database (optional — graceful fallback) ─────────────────
  const db = await getDb();
  let agentStateRepo: AgentStateRepo | null = null;
  let decisionRepo: DecisionRepo | null = null;
  let actionLogRepo: ActionLogRepo | null = null;
  let outcomeRepo: OutcomeRepo | null = null;
  let goalRepo: GoalRepo | null = null;
  let memoryRepo: MemoryRepo | null = null;
  let fileRepo: FileRepo | null = null;
  let meshRunRepo: MeshRunRepo | null = null;
  let agencyRepo: AgencyRepo | null = null;
  let quotaRepo: QuotaRepo | null = null;
  let hflDecisionRepo: HFLDecisionRepo | null = null;

  if (db) {
    log.info('Database connected — full persistence active');
    agentStateRepo = new AgentStateRepo(db);
    decisionRepo = new DecisionRepo(db);
    actionLogRepo = new ActionLogRepo(db);
    outcomeRepo = new OutcomeRepo(db);
    goalRepo = new GoalRepo(db);
    memoryRepo = new MemoryRepo(db);
    fileRepo = new FileRepo(db);
    meshRunRepo = new MeshRunRepo(db);
    agencyRepo = new AgencyRepo(db);
    quotaRepo = new QuotaRepo(db);
    hflDecisionRepo = new HFLDecisionRepo(db);
  } else {
    log.warn('No DATABASE_URL — running without persistence (reduced tools)');
  }

  // ─── LLM config ──────────────────────────────────────────────
  const llmConfig = detectLLMConfig() ?? { provider: 'anthropic' as const, model: 'claude-sonnet-4-20250514' };

  // ─── Autonomous agents (OODA runtimes) ────────────────────────
  const agentMap = new Map<string, OodaRuntime>();
  const goalDecomposer = new GoalDecomposer(llmConfig, SKILL_SCHEMAS);
  const goalTracker = goalRepo ? new GoalTracker(goalRepo) : null;

  for (const engineId of listAgentEngineIds()) {
    const runtime = new OodaRuntime({
      engineId,
      agency,
      eventBus,
      connectors: connectorInfra.writeRegistry,
      llmConfig,
      credentialStore: connectorInfra.credentialStore,
      goalTracker: goalTracker ?? undefined,
      goalDecomposer,
      agentStateRepo,
      decisionRepo,
      actionLogRepo,
      outcomeRepo,
      memoryRepo,
      goalRepo,
    });
    agentMap.set(engineId, runtime);
  }

  // ─── Mesh Coordinator ─────────────────────────────────────────
  const mesh = new MeshCoordinator(agentMap, eventBus, meshRunRepo ?? undefined, agency);
  mesh.registerPipeline(DEFAULT_PIPELINE);
  mesh.registerPipeline(DELIVERY_PIPELINE);
  mesh.start();
  if (meshRunRepo) await mesh.hydrateFromDb(200);

  // ─── Pipeline Scheduler ───────────────────────────────────────
  const scheduler = new PipelineScheduler(mesh, eventBus, undefined);
  await scheduler.start();

  // ─── HFL Coordinator ──────────────────────────────────────────
  const hflCoordinator = new HFLCoordinator(eventBus, {
    base_url: process.env['API_BASE_URL'] ?? 'http://localhost:3100',
    delivery_file_store: fileRepo ?? undefined,
  });

  // ─── Federation + Marketplace ─────────────────────────────────
  const a2aClient = new A2AClient();
  const mcpClientRegistry = new McpClientRegistry();
  const dynamicSkillRegistry = new DynamicSkillRegistry();

  // ─── Create MCP server with ALL infrastructure ────────────────
  const server = createMcpServer(
    agency,
    agentMap,
    mesh,
    connectorInfra,
    a2aClient,
    mcpClientRegistry,
    dynamicSkillRegistry,
    hflCoordinator,
    scheduler,
    fileRepo,
    agencyRepo ?? undefined,
    quotaRepo ?? undefined,
  );

  // ─── Connect via stdio transport ──────────────────────────────
  const transport = new StdioServerTransport();
  await server.connect(transport);

  log.info('MCP stdio server ready — all tools registered');

  // ─── Graceful shutdown ────────────────────────────────────────
  const shutdown = async () => {
    log.info('Shutting down MCP stdio server...');
    scheduler.stop();
    mesh.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  // Log to stderr (stdout is reserved for MCP JSON-RPC)
  process.stderr.write(`MCP stdio server failed: ${err}\n`);
  process.exit(1);
});
