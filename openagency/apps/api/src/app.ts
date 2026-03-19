// ─── Hono Application Factory ───────────────────────────────────────

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { OpenAgency, detectLLMConfig, createLogger } from '@openagency/core';
import { LeakDetectorEngine } from '@openagency/engines';
import { MediaArchitectEngine } from '@openagency/engines';
import { CampaignOpsEngine } from '@openagency/engines';
import { ExecutiveBridgeEngine } from '@openagency/engines';
import { DeliveryEngine } from '@openagency/engines';
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
  McpProcessManager,
  ActionExecutor,
  computePipelineScore,
  HFL_SCORE_THRESHOLD,
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
  UserRepo,
  MeshRunRepo,
  McpConnectionRepo,
} from '@openagency/memory';
import { setupConnectors } from './connectors/setup.js';
import { getDb } from './db/client.js';
import { healthRoutes } from './routes/health.js';
import { engineRoutes } from './routes/engines.js';
import { schemaRoutes } from './routes/schemas.js';
import { authRoutes, seedAdminUser } from './routes/auth.js';
import { agentRoutes, type AgentRegistry } from './routes/agents.js';
import { goalRoutes } from './routes/goals.js';
import { meshRoutes } from './routes/mesh.js';
import { connectorRoutes } from './routes/connectors.js';
import { storageConnectorRoutes } from './routes/storage-connectors.js';
import { uploadRoutes } from './routes/upload.js';
import { scorecardRoutes } from './routes/scorecard.js';
import { analyzeRoutes } from './routes/analyze.js';
import { eventStreamRoutes } from './routes/event-stream.js';
import { mcpRoute } from './mcp/transport.js';
import { a2aDiscoveryRoute } from './a2a/discovery.js';
import { federationRoutes } from './routes/federation.js';
import { marketplaceRoutes } from './routes/marketplace.js';
import { mcpMarketplaceRoutes } from './routes/mcp-marketplace.js';
import { deliveryRoutes } from './routes/delivery.js';
import { HFLCoordinator } from '@openagency/hfl';
import { hflRoutes } from './routes/hfl.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { campaignRoutes } from './routes/campaigns.js';
import { onboardingRoutes } from './routes/onboarding.js';
import { consumptionRoutes } from './routes/consumption.js';
import { assistantRoutes, autoCreatePipelineConversation } from './routes/assistant.js';
import { ConversationRepo, ScorecardDbRepo, ClientDataRepo } from '@openagency/memory';
import { oauthStorageRoutes } from './routes/oauth-storage.js';
import { agencyConnectorRoutes } from './routes/agency-connectors.js';
import { errorHandler } from './middleware/error-handler.js';
import { requestLogger } from './middleware/logger.js';
import { rateLimiter } from './middleware/rate-limiter.js';

const startTime = Date.now();
const log = createLogger('app');

export async function createApp() {
  const app = new Hono();

  // ─── Bootstrap engines ──────────────────────────────────────────
  const agency = new OpenAgency();
  agency.engines.register(new LeakDetectorEngine());
  agency.engines.register(new MediaArchitectEngine());
  agency.engines.register(new CampaignOpsEngine());
  agency.engines.register(new ExecutiveBridgeEngine());
  agency.engines.register(new DeliveryEngine());

  // ─── Event bus ──────────────────────────────────────────────────
  const eventBus = createEventBus();

  // ─── Connector infrastructure ──────────────────────────────────
  const connectorInfra = setupConnectors(eventBus);
  const writeRegistry = connectorInfra.writeRegistry;

  // ─── Database (optional — graceful fallback to null repos) ─────
  const db = await getDb();
  let agentStateRepo: AgentStateRepo | null = null;
  let decisionRepo: DecisionRepo | null = null;
  let actionLogRepo: ActionLogRepo | null = null;
  let outcomeRepo: OutcomeRepo | null = null;
  let goalRepo: GoalRepo | null = null;
  let memoryRepo: MemoryRepo | null = null;
  let fileRepo: FileRepo | null = null;
  let userRepo: UserRepo | null = null;

  let meshRunRepo: MeshRunRepo | null = null;
  let clientDataRepo: ClientDataRepo | null = null;
  let scorecardDbRepo: ScorecardDbRepo | null = null;

  if (db) {
    log.info('Database connected — repos active');
    agentStateRepo = new AgentStateRepo(db);
    decisionRepo = new DecisionRepo(db);
    actionLogRepo = new ActionLogRepo(db);
    outcomeRepo = new OutcomeRepo(db);
    goalRepo = new GoalRepo(db);
    memoryRepo = new MemoryRepo(db);
    fileRepo = new FileRepo(db);
    userRepo = new UserRepo(db);
    meshRunRepo = new MeshRunRepo(db);
    clientDataRepo = new ClientDataRepo(db);
    scorecardDbRepo = new ScorecardDbRepo(db);
    await seedAdminUser(userRepo);
  } else {
    log.warn('No DATABASE_URL — running without persistence');
  }

  // ─── Autonomous agents (OODA runtimes) ────────────────────────
  const llmConfig = detectLLMConfig() ?? { provider: 'anthropic' as const, model: 'claude-sonnet-4-20250514' };
  const agentMap = new Map<string, OodaRuntime>();

  // ─── Goal intelligence ────────────────────────────────────────
  const goalDecomposer = new GoalDecomposer(llmConfig, SKILL_SCHEMAS);
  const goalTracker = goalRepo ? new GoalTracker(goalRepo) : null;

  for (const engineId of listAgentEngineIds()) {
    const runtime = new OodaRuntime({
      engineId,
      agency,
      eventBus,
      connectors: writeRegistry,
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

  const actionExecutor = new ActionExecutor(writeRegistry, actionLogRepo);

  const registry: AgentRegistry = {
    agents: agentMap,
    decisionRepo,
    agentStateRepo,
    actionLogRepo,
    actionExecutor,
    credentials: new Map(connectorInfra.credentialStore.getAll().map((c) => [c.platform, c])),
    agentConfig: { max_budget_change_pct: 25, approval_threshold_usd: 1000, dry_run: false },
  };

  // ─── Mesh Coordinator (multi-agent orchestration) ───────────────
  const mesh = new MeshCoordinator(agentMap, eventBus, meshRunRepo ?? undefined, agency);
  mesh.registerPipeline(DEFAULT_PIPELINE);
  mesh.registerPipeline(DELIVERY_PIPELINE);
  mesh.start();
  // Warm the in-memory Map from DB so runs survive redeploys
  await mesh.hydrateFromDb(200);

  // ─── Pipeline Scheduler (cron-based pipeline runs) ───────────────
  // Context builder for scheduled runs — assembles MCP data + batch data + previous run baseline
  const schedulerContextBuilder = async (clientId: string): Promise<Record<string, unknown>> => {
    let ctx: Record<string, unknown> = {};

    // Platform sync data
    if (connectorInfra) {
      const { assembleContextFromSync } = await import('./connectors/context-assembler.js');
      ctx = assembleContextFromSync(connectorInfra.syncResultCache);
    }

    // Client batch data
    if (clientDataRepo) {
      try {
        const batchData = await clientDataRepo.getLatestBatchContext(clientId);
        if (Object.keys(batchData).length > 0) {
          const { mergeClientBatchData } = await import('./connectors/context-assembler.js');
          ctx = mergeClientBatchData(ctx, batchData);
        }
      } catch { /* non-blocking */ }
    }

    // MCP data
    if (mcpClientRegistry && mcpClientRegistry.listServers().length > 0) {
      try {
        const { mergeMcpData } = await import('./connectors/context-assembler.js');
        ctx = await mergeMcpData(ctx, mcpClientRegistry, clientId);
      } catch { /* non-blocking */ }
    }

    // Previous run baseline + comparison context
    if (scorecardDbRepo) {
      try {
        const prev = await scorecardDbRepo.getLatestByClient(clientId);
        if (prev) {
          const prevBilling = prev.billing as Record<string, unknown>;
          ctx._previous_run = {
            run_id: prev.run_id,
            run_type: prev.run_type,
            billing: prevBilling,
            created_at: prev.created_at,
          };
          ctx._baseline = {
            roas: (prevBilling as Record<string, unknown>)?.roi_on_fee ?? 2.0,
            waste_pct: ((prevBilling as Record<string, unknown>)?.recovery as Record<string, unknown>)?.waste_pct ?? 20,
          };
          // Feedback insight for engines
          const waste = Number((prevBilling as Record<string, unknown>)?.total_recovery ?? 0);
          const fee = Number((prevBilling as Record<string, unknown>)?.total_fee ?? 0);
          if (waste > 0 || fee > 0) {
            ctx._feedback = `Previous run: $${waste.toLocaleString()} waste recovered, $${fee.toLocaleString()} total fee, ROI ${Number((prevBilling as Record<string, unknown>)?.roi_on_fee ?? 0).toFixed(1)}x. Optimize to reduce waste further.`;
          }
        }
      } catch { /* non-blocking */ }
    }

    // Validate assembled context
    const { validateSkillContext } = await import('./connectors/context-assembler.js');
    const validation = validateSkillContext(ctx);
    log.info({ client_id: clientId, ...validation }, 'Scheduled pipeline context validation');
    ctx._context_validation = validation;

    return ctx;
  };

  // ─── Schedule DB Adapter ───────────────────────────────────────────
  const scheduleRepo = db ? (() => {
    const sql = db as unknown as { unsafe: (q: string, params?: unknown[]) => Promise<Array<Record<string, unknown>>> };
    const mapRow = (r: Record<string, unknown>): import('@openagency/types').PipelineSchedule => ({
      id: r['id'] as string,
      client_id: r['client_id'] as string,
      pipeline_id: r['pipeline_id'] as string,
      cron: r['cron'] as string,
      auto_approve: r['auto_approve'] as boolean,
      notify_on_complete: r['notify_on_complete'] as boolean,
      enabled: r['enabled'] as boolean,
      created_at: (r['created_at'] as Date)?.toISOString?.() ?? String(r['created_at']),
      last_run_at: r['last_run_at'] ? ((r['last_run_at'] as Date)?.toISOString?.() ?? String(r['last_run_at'])) : undefined,
      next_run_at: r['next_run_at'] ? ((r['next_run_at'] as Date)?.toISOString?.() ?? String(r['next_run_at'])) : undefined,
    });
    return {
      async create(schedule: import('@openagency/types').PipelineSchedule) {
        await sql.unsafe(
          'INSERT INTO pipeline_schedules (id, client_id, pipeline_id, cron, auto_approve, notify_on_complete, enabled, created_at, next_run_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING',
          [schedule.id, schedule.client_id, schedule.pipeline_id, schedule.cron, schedule.auto_approve, schedule.notify_on_complete, schedule.enabled, schedule.created_at, schedule.next_run_at ?? null],
        );
      },
      async findAll() {
        const rows = await sql.unsafe('SELECT * FROM pipeline_schedules WHERE enabled = true ORDER BY created_at DESC');
        return rows.map(mapRow);
      },
      async findById(id: string) {
        const rows = await sql.unsafe('SELECT * FROM pipeline_schedules WHERE id = $1', [id]);
        return rows.length > 0 ? mapRow(rows[0]) : null;
      },
      async updateLastRun(id: string, lastRunAt: string, nextRunAt: string | null) {
        await sql.unsafe('UPDATE pipeline_schedules SET last_run_at = $1, next_run_at = $2 WHERE id = $3', [lastRunAt, nextRunAt, id]);
      },
      async delete(id: string) {
        const rows = await sql.unsafe('DELETE FROM pipeline_schedules WHERE id = $1 RETURNING id', [id]);
        return rows.length > 0;
      },
    };
  })() : undefined;

  const scheduler = new PipelineScheduler(mesh, eventBus, scheduleRepo, schedulerContextBuilder);
  await scheduler.start();

  // ─── Human Feedback Loop (agent-to-human escalation) ────────────
  const hflCoordinator = new HFLCoordinator(eventBus, {
    base_url: process.env['API_BASE_URL'] ?? 'http://localhost:3100',
    delivery_file_store: fileRepo ?? undefined,
  });

  // ─── Auto-invoke HFL after every pipeline completes ──────────────
  eventBus.subscribe('mesh.pipeline.completed', async (event) => {
    const runId = (event.payload as { run_id: string }).run_id;
    const meshRun = mesh.getRun(runId);
    if (!meshRun) return;
    const stageResults: Record<string, import('@openagency/hfl').StageResultSummary> = {};
    for (const [stageId, result] of meshRun.context.stage_results.entries()) {
      stageResults[stageId] = {
        agent_id: result.agent_id,
        status: result.status,
        duration_ms: result.duration_ms,
        skills_invoked: result.skills_invoked,
        error: result.error,
      };
    }
    // Compute composite pipeline score and force escalation if below threshold
    const pipelineScore = computePipelineScore(meshRun.context.stage_results);
    const forceEscalate = pipelineScore.composite < HFL_SCORE_THRESHOLD;

    const summary = {
      id: runId,
      pipeline_id: meshRun.pipeline_id,
      status: meshRun.status,
      total_duration_ms: meshRun.total_duration_ms ?? 0,
      client_id: meshRun.usage?.agent_client_id,
      stage_results: stageResults,
      pipeline_score: pipelineScore,
    };

    if (forceEscalate) {
      log.warn(
        { run_id: runId, score: pipelineScore.composite, threshold: HFL_SCORE_THRESHOLD },
        'Pipeline score below threshold — forcing HFL escalation',
      );
    }

    hflCoordinator.evaluate(summary, forceEscalate).catch((err: unknown) => {
      log.warn({ err, run_id: runId }, 'HFL evaluation error');
    });

    // ── Auto-generate assistant briefing for this run ──────────────
    // Runs after HFL so the pending decision is already in hfl.listPending()
    setTimeout(() => {
      const currentRun = mesh.getRun(runId);
      if (!currentRun) return;
      autoCreatePipelineConversation(
        currentRun,
        llmConfig,
        mesh,
        hflCoordinator,
        connectorInfra.credentialStore.platforms(),
      )
        .then(async (convId) => {
          const { ulid: makeId } = await import('ulid');
          await eventBus.publish({
            id: makeId(),
            type: 'assistant.pipeline_ready',
            timestamp: new Date().toISOString(),
            payload: { conversation_id: convId, run_id: runId },
            metadata: {},
          });
          log.info({ run_id: runId, conversation_id: convId }, 'Assistant briefing ready');
        })
        .catch((err: unknown) => {
          log.warn({ err, run_id: runId }, 'Failed to auto-create assistant briefing');
        });
    }, 500); // small delay so HFL decision is registered first
  });

  // ─── Federation (external agent consumption) ──────────────────
  const a2aClient = new A2AClient();
  const mcpProcessManager = new McpProcessManager();
  const mcpConnectionRepo = db ? new McpConnectionRepo(db) : undefined;
  const mcpClientRegistry = new McpClientRegistry(mcpConnectionRepo, mcpProcessManager);

  // Load persisted MCP connections from DB (marks stale if process dead, auto-respawns)
  const encryptionKey = process.env['ENCRYPTION_KEY'] ?? '';
  if (mcpConnectionRepo) {
    let respawnOpts: import('@openagency/agent').RespawnOpts | undefined;
    if (encryptionKey) {
      const { decrypt } = await import('@openagency/memory');
      const { buildEnvFromAuthFields } = await import('./routes/mcp-marketplace.js');
      respawnOpts = {
        decryptFn: (token: string) => decrypt(token, encryptionKey),
        envMapperFn: buildEnvFromAuthFields,
      };
    }

    const skipSpawn = process.env['SKIP_MCP_SPAWN'] === 'true';

    mcpClientRegistry.loadFromDb(undefined, skipSpawn ? undefined : respawnOpts).catch((err) => {
      log.warn({ err }, 'Failed to load MCP connections from DB');
    });

    // Start periodic health monitor (every 5 minutes) — skip if spawn disabled
    if (respawnOpts && !skipSpawn) {
      mcpClientRegistry.startHealthMonitor(300_000, respawnOpts);
      log.info('MCP health monitor started (5 min interval, 12s timeout, 2-failure threshold)');
    } else if (skipSpawn) {
      log.info('MCP self-hosted spawning disabled (SKIP_MCP_SPAWN=true) — health monitor skipped');
    }
  }

  // ─── Skill Marketplace (dynamic skill registration) ──────────
  const dynamicSkillRegistry = new DynamicSkillRegistry();

  // ─── Global middleware ──────────────────────────────────────────
  app.use('*', requestLogger());
  app.use(
    '*',
    cors({
      origin: process.env['CORS_ORIGIN'] ?? '*',
      allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
    }),
  );

  // ─── Public routes (no auth) ────────────────────────────────────
  app.route('/', healthRoutes(startTime, agency));
  app.route('/', schemaRoutes());
  app.route('/', a2aDiscoveryRoute());

  // ─── Auth routes ────────────────────────────────────────────────
  app.route('/', authRoutes(userRepo));

  // ─── OAuth Storage (Google Drive, OneDrive) ────────────────────
  app.route('/', oauthStorageRoutes(db));

  // ─── Protected routes ───────────────────────────────────────────
  app.route('/', engineRoutes(agency, eventBus));

  // ─── Agent routes ─────────────────────────────────────────────
  app.route('/', agentRoutes(registry));
  app.route('/', goalRoutes({ goalRepo, decomposer: goalDecomposer, tracker: goalTracker }));

  // ─── Mesh routes (with HFL + Scheduler) ────────────────────────
  app.route('/', meshRoutes(mesh, hflCoordinator, scheduler, connectorInfra, clientDataRepo ?? undefined, mcpClientRegistry, scorecardDbRepo ?? undefined));

  // ─── Connector routes ──────────────────────────────────────────
  app.route('/', connectorRoutes(connectorInfra, eventBus));

  // ─── Agency connector routes (multi-advertiser) ────────────────
  app.route('/', agencyConnectorRoutes(db, connectorInfra));

  // ─── File upload route ──────────────────────────────────────────
  app.route('/', uploadRoutes(clientDataRepo ?? undefined));

  // ─── Storage connectors (Google Drive, OneDrive) ─────────────────
  app.route('/', storageConnectorRoutes(clientDataRepo ?? undefined));

  // ─── Human Feedback Loop routes ────────────────────────────────
  app.route('/', hflRoutes(hflCoordinator));

  // ─── Scorecard + Billing ──────────────────────────────────────
  app.route('/', scorecardRoutes(agency, mesh, connectorInfra, scorecardDbRepo ?? undefined));

  // ─── Analyze pipeline (upload → engines → scorecard) ──────────
  app.route('/', analyzeRoutes(agency));

  // ─── SSE event stream ──────────────────────────────────────────
  app.route('/', eventStreamRoutes(eventBus));

  // ─── Federation routes ─────────────────────────────────────────
  app.route('/', federationRoutes({ a2aClient, mcpRegistry: mcpClientRegistry }));

  // ─── Marketplace routes ──────────────────────────────────────
  app.route('/', marketplaceRoutes(dynamicSkillRegistry));

  // ─── MCP Marketplace (catalog + connections) ──────────────────
  if (mcpConnectionRepo) {
    app.route('/', mcpMarketplaceRoutes(mcpConnectionRepo, mcpClientRegistry, mcpProcessManager));
  }

  // ─── Dashboard (aggregated KPIs for Command Center) ──────────
  app.route('/', dashboardRoutes({ mesh, connectorInfra, registry, hfl: hflCoordinator }));

  // ─── Campaign routes ─────────────────────────────────────────
  app.route('/', campaignRoutes(connectorInfra));

  // ─── Onboarding routes ───────────────────────────────────────
  app.route('/', onboardingRoutes(connectorInfra, mcpClientRegistry));

  // ─── Consumption routes ──────────────────────────────────────
  app.route('/', consumptionRoutes(connectorInfra, registry));

  // ─── Delivery Engine routes ───────────────────────────────────
  app.route('/', deliveryRoutes(agency, fileRepo));

  // ─── AI Assistant routes ──────────────────────────────────────
  app.route('/', assistantRoutes(llmConfig, mesh, hflCoordinator, connectorInfra, agency, db ? new ConversationRepo(db) : undefined));

  // ─── MCP endpoint ───────────────────────────────────────────────
  app.route('/', mcpRoute(agency, agentMap, mesh, connectorInfra, a2aClient, mcpClientRegistry, dynamicSkillRegistry, hflCoordinator, scheduler, fileRepo));

  // ─── Error handler ──────────────────────────────────────────────
  app.onError(errorHandler);

  // ─── 404 ────────────────────────────────────────────────────────
  app.notFound((c) =>
    c.json({ error: 'not_found', message: 'Route not found', status: 404 }, 404),
  );

  return app;
}
