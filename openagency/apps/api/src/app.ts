// ─── Hono Application Factory ───────────────────────────────────────

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authMiddleware } from '@openagency/auth/middleware';
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
import { KBFolderRepo, KBDocumentRepo, KBChunkRepo, startAutoSaver } from '@openagency/kb';
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
import { benchmarkRoutes } from './routes/benchmarks.js';
import { ConversationRepo, ScorecardDbRepo, ClientDataRepo, DailyMetricsRepo, FederationLogRepo, AgencyRepo, QuotaRepo, HFLDecisionRepo } from '@openagency/memory';
import { oauthStorageRoutes } from './routes/oauth-storage.js';
import { agencyConnectorRoutes } from './routes/agency-connectors.js';
import { demoRequestRoutes } from './routes/demo-request.js';
import { adminRoutes } from './routes/admin.js';
import { quotaRoutes } from './routes/quota.js';
import { agencyDashboardRoutes } from './routes/agency-dashboard.js';
import { kbRoutes } from './routes/kb.js';
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
  let dailyMetricsRepo: DailyMetricsRepo | null = null;
  let federationLogRepo: FederationLogRepo | null = null;
  let agencyRepo: AgencyRepo | null = null;
  let quotaRepo: QuotaRepo | null = null;
  let hflDecisionRepo: HFLDecisionRepo | null = null;

  // ─── KB repos (Knowledge Base) ─────────────────────────────────
  let kbFolderRepo: KBFolderRepo | null = null;
  let kbDocumentRepo: KBDocumentRepo | null = null;
  let kbChunkRepo: KBChunkRepo | null = null;

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
    dailyMetricsRepo = new DailyMetricsRepo(db);
    federationLogRepo = new FederationLogRepo(db);
    agencyRepo = new AgencyRepo(db);
    quotaRepo = new QuotaRepo(db);
    hflDecisionRepo = new HFLDecisionRepo(db);
    kbFolderRepo = new KBFolderRepo(db);
    kbDocumentRepo = new KBDocumentRepo(db);
    kbChunkRepo = new KBChunkRepo(db);
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
  // This is the SINGLE evaluation point (FIX 2: removed duplicate from mesh.ts)
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

    try {
      const decision = await hflCoordinator.evaluate(summary, forceEscalate);

      // FIX 1: Persist HFL decision to PostgreSQL
      if (hflDecisionRepo && decision) {
        const riskScore = decision.risk_score;
        await hflDecisionRepo.save({
          id: decision.id,
          run_id: decision.run_id,
          client_id: decision.client_id ?? null,
          status: decision.status,
          risk_score: riskScore?.total_impact_usd ?? null,
          risk_level: riskScore?.urgency ?? null,
          reasons: riskScore?.risk_factors ?? [],
          rendered_payload: (decision.render_output as unknown as Record<string, unknown>) ?? {},
          channel: decision.dispatched_to ?? null,
          created_at: decision.created_at,
          resolved_at: decision.resolved_at ?? null,
          resolved_by: null,
          feedback: null,
        }).catch((err: unknown) => {
          log.warn({ err, decision_id: decision.id }, 'Failed to persist HFL decision');
        });
      }
    } catch (err: unknown) {
      log.warn({ err, run_id: runId }, 'HFL evaluation error');
    }

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

  // ─── KB Auto-Saver (pipeline completed → R2 + indexing queue) ───
  if (kbFolderRepo && kbDocumentRepo && process.env['R2_ACCOUNT_ID']) {
    startAutoSaver({
      eventBus,
      folderRepo: kbFolderRepo,
      documentRepo: kbDocumentRepo,
      getMeshRun: (runId) => mesh.getRun(runId) as unknown as import('@openagency/kb').MeshRunLike | undefined,
      log,
    });
    log.info('KB auto-saver active (mesh.pipeline.completed → R2)');
  }

  // ─── Metrics persistence (event bus → daily_metrics) ───────────
  if (dailyMetricsRepo) {
    const today = () => new Date().toISOString().slice(0, 10);

    eventBus.subscribe('engine.skill.completed', async (event) => {
      const p = event.payload as Record<string, unknown>;
      dailyMetricsRepo!.increment({
        date: today(),
        engine_id: (p['engine_id'] as string) ?? undefined,
        model: (p['model'] as string) ?? undefined,
        skills_invoked: 1,
        tokens_prompt: Number(p['tokens_prompt'] ?? 0),
        tokens_completion: Number(p['tokens_completion'] ?? 0),
        llm_cost_usd: Number(p['llm_cost_usd'] ?? 0),
      }).catch(() => {});
    });

    eventBus.subscribe('mesh.pipeline.completed', async (event) => {
      const p = event.payload as Record<string, unknown>;
      dailyMetricsRepo!.increment({
        date: today(),
        agency_id: (p['client_id'] as string) ?? undefined,
        runs_completed: 1,
      }).catch(() => {});
    });

    eventBus.subscribe('mesh.pipeline.started', async () => {
      dailyMetricsRepo!.increment({ date: today(), runs_started: 1 }).catch(() => {});
    });

    eventBus.subscribe('mesh.pipeline.failed', async () => {
      dailyMetricsRepo!.increment({ date: today(), runs_failed: 1 }).catch(() => {});
    });

    log.info('Admin metrics persistence active (event bus → daily_metrics)');
  }

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
      origin: process.env['CORS_ORIGIN'] ?? (process.env['NODE_ENV'] === 'production' ? 'https://plinth.polanyi.tech' : '*'),
      allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
    }),
  );

  // ─── Public routes (no auth) ────────────────────────────────────
  app.route('/', healthRoutes(startTime, agency));
  app.route('/', schemaRoutes());
  app.route('/', a2aDiscoveryRoute());
  app.route('/', demoRequestRoutes());

  // ─── Auth routes (login, invite, accept — have their own auth logic) ──
  app.route('/', authRoutes(userRepo));

  // ─── OAuth Storage (Google Drive, OneDrive — callbacks must be public) ──
  app.route('/', oauthStorageRoutes(db));

  // ─── Public MCP endpoint (for Claude Desktop / external AI clients) ──
  // Mounted BEFORE auth gate so Claude Desktop can connect without JWT.
  // Timeout: mesh pipelines can take 60-120s — Railway proxy default is 60s.
  {
    const { WebStandardStreamableHTTPServerTransport } = await import('@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js');
    const { createMcpServer: createMcp } = await import('./mcp/server.js');

    app.post('/mcp', async (c) => {
      try {
        const server = createMcp(agency, agentMap, mesh, connectorInfra, a2aClient, mcpClientRegistry, dynamicSkillRegistry, hflCoordinator, scheduler, fileRepo, agencyRepo ?? undefined, quotaRepo ?? undefined);
        const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
        await server.connect(transport);
        const response = await transport.handleRequest(c.req.raw);
        // Set extended timeout headers for proxies (Railway, Cloudflare)
        const headers = new Headers(response.headers);
        headers.set('X-Request-Timeout', '300');
        headers.set('Keep-Alive', 'timeout=300');
        return new Response(response.body, {
          status: response.status,
          headers,
        });
      } catch (err) {
        log.error({ err }, 'MCP POST /mcp error');
        return c.json({ error: 'mcp_error', message: err instanceof Error ? err.message : String(err) }, 500);
      }
    });

    // MCP also needs GET for server-sent events and DELETE for session cleanup
    app.get('/mcp', async (c) => {
      return c.json({ name: 'openagency-plinth', version: '3.2.0', status: 'ready', tools: 63 });
    });

    app.delete('/mcp', async (c) => {
      return c.json({ status: 'ok' });
    });
  }

  // ─── Global auth gate: ALL routes below require authentication ──
  app.use('/v1/*', authMiddleware());

  // ─── Protected routes ───────────────────────────────────────────
  app.route('/', engineRoutes(agency, eventBus));

  // ─── Agent routes ─────────────────────────────────────────────
  app.route('/', agentRoutes(registry));
  app.route('/', goalRoutes({ goalRepo, decomposer: goalDecomposer, tracker: goalTracker }));

  // ─── Mesh routes (with HFL + Scheduler) ────────────────────────
  app.route('/', meshRoutes(mesh, hflCoordinator, scheduler, connectorInfra, clientDataRepo ?? undefined, mcpClientRegistry, scorecardDbRepo ?? undefined, agencyRepo ?? undefined, quotaRepo ?? undefined));

  // ─── Connector routes ──────────────────────────────────────────
  app.route('/', connectorRoutes(connectorInfra, eventBus));

  // ─── Agency connector routes (multi-advertiser) ────────────────
  app.route('/', agencyConnectorRoutes(db, connectorInfra, agencyRepo ?? undefined));

  // ─── File upload route ──────────────────────────────────────────
  app.route('/', uploadRoutes(clientDataRepo ?? undefined));

  // ─── Storage connectors (Google Drive, OneDrive) ─────────────────
  app.route('/', storageConnectorRoutes(clientDataRepo ?? undefined));

  // ─── Human Feedback Loop routes (FIX 1: with persistence, FIX 6: with RBAC) ──
  app.route('/', hflRoutes(hflCoordinator, hflDecisionRepo ?? undefined, agencyRepo ?? undefined, mesh));

  // ─── Scorecard + Billing ──────────────────────────────────────
  app.route('/', scorecardRoutes(agency, mesh, connectorInfra, scorecardDbRepo ?? undefined));

  // ─── Analyze pipeline (upload → engines → scorecard) ──────────
  app.route('/', analyzeRoutes(agency, agencyRepo ?? undefined, quotaRepo ?? undefined));

  // ─── Cross-Client Benchmarks (anonymized) ─────────────────────
  app.route('/', benchmarkRoutes(db));

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

  // ─── Super Admin Dashboard ──────────────────────────────────
  app.route('/', adminRoutes({ db, dailyMetricsRepo, federationLogRepo, a2aClient }));

  // ─── Quota routes ─────────────────────────────────────────────
  app.route('/', quotaRoutes({ agencyRepo, quotaRepo }));

  // ─── Agency Dashboard ─────────────────────────────────────────
  app.route('/', agencyDashboardRoutes({ db, agencyRepo, quotaRepo, dailyMetricsRepo }));

  // ─── Campaign routes ─────────────────────────────────────────
  app.route('/', campaignRoutes(connectorInfra));

  // ─── Onboarding routes ───────────────────────────────────────
  app.route('/', onboardingRoutes(connectorInfra, mcpClientRegistry));

  // ─── Consumption routes ──────────────────────────────────────
  app.route('/', consumptionRoutes(connectorInfra, registry));

  // ─── Delivery Engine routes ───────────────────────────────────
  app.route('/', deliveryRoutes(agency, fileRepo));

  // ─── Knowledge Base routes (folders, documents, search) ────────
  if (kbFolderRepo && kbDocumentRepo && kbChunkRepo) {
    app.route('/', kbRoutes({
      folderRepo: kbFolderRepo,
      documentRepo: kbDocumentRepo,
      chunkRepo: kbChunkRepo,
      db,
    }));
  }

  // ─── AI Assistant routes (Agentic Mode) ────────────────────────
  app.route('/', assistantRoutes(llmConfig, mesh, hflCoordinator, connectorInfra, agency, db ? new ConversationRepo(db) : undefined, quotaRepo ?? undefined));

  // ─── MCP endpoint (FIX 4: pass agencyRepo + quotaRepo for quota enforcement) ──
  app.route('/', mcpRoute(agency, agentMap, mesh, connectorInfra, a2aClient, mcpClientRegistry, dynamicSkillRegistry, hflCoordinator, scheduler, fileRepo, agencyRepo ?? undefined, quotaRepo ?? undefined));

  // ─── Error handler ──────────────────────────────────────────────
  app.onError(errorHandler);

  // ─── 404 ────────────────────────────────────────────────────────
  app.notFound((c) =>
    c.json({ error: 'not_found', message: 'Route not found', status: 404 }, 404),
  );

  return app;
}
