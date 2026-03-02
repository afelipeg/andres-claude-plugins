// ─── Hono Application Factory ───────────────────────────────────────

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { OpenAgency, detectLLMConfig } from '@openagency/core';
import { LeakDetectorEngine } from '@openagency/engines';
import { MediaArchitectEngine } from '@openagency/engines';
import { CampaignOpsEngine } from '@openagency/engines';
import { ExecutiveBridgeEngine } from '@openagency/engines';
import { createEventBus } from '@openagency/events';
import { ConnectorWriteRegistry } from '@openagency/connectors';
import { OodaRuntime } from '@openagency/agent';
import { listAgentEngineIds } from '@openagency/agent';
import { healthRoutes } from './routes/health.js';
import { engineRoutes } from './routes/engines.js';
import { schemaRoutes } from './routes/schemas.js';
import { authRoutes } from './routes/auth.js';
import { agentRoutes, type AgentRegistry } from './routes/agents.js';
import { goalRoutes } from './routes/goals.js';
import { mcpRoute } from './mcp/transport.js';
import { a2aDiscoveryRoute } from './a2a/discovery.js';
import { errorHandler } from './middleware/error-handler.js';
import { requestLogger } from './middleware/logger.js';
import { rateLimiter } from './middleware/rate-limiter.js';

const startTime = Date.now();

export function createApp() {
  const app = new Hono();

  // ─── Bootstrap engines ──────────────────────────────────────────
  const agency = new OpenAgency();
  agency.engines.register(new LeakDetectorEngine());
  agency.engines.register(new MediaArchitectEngine());
  agency.engines.register(new CampaignOpsEngine());
  agency.engines.register(new ExecutiveBridgeEngine());

  // ─── Event bus ──────────────────────────────────────────────────
  const eventBus = createEventBus();

  // ─── Connector write registry ─────────────────────────────────
  const writeRegistry = new ConnectorWriteRegistry();

  // ─── Autonomous agents (OODA runtimes) ────────────────────────
  const llmConfig = detectLLMConfig() ?? { provider: 'anthropic' as const, model: 'claude-sonnet-4-20250514' };
  const agentMap = new Map<string, OodaRuntime>();

  for (const engineId of listAgentEngineIds()) {
    const runtime = new OodaRuntime({
      engineId,
      agency,
      eventBus,
      connectors: writeRegistry,
      llmConfig,
      // Repos null until database is connected — injected via initAgentRepos()
      agentStateRepo: null,
      decisionRepo: null,
      actionLogRepo: null,
      outcomeRepo: null,
      memoryRepo: null,
      goalRepo: null,
    });
    agentMap.set(engineId, runtime);
  }

  const registry: AgentRegistry = {
    agents: agentMap,
    decisionRepo: null,
    agentStateRepo: null,
  };

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
  app.route('/', authRoutes());

  // ─── Protected routes ───────────────────────────────────────────
  app.route('/', engineRoutes(agency, eventBus));

  // ─── Agent routes ─────────────────────────────────────────────
  app.route('/', agentRoutes(registry));
  app.route('/', goalRoutes({ goalRepo: null, decomposer: null, tracker: null }));

  // ─── MCP endpoint ───────────────────────────────────────────────
  app.route('/', mcpRoute(agency, agentMap));

  // ─── Error handler ──────────────────────────────────────────────
  app.onError(errorHandler);

  // ─── 404 ────────────────────────────────────────────────────────
  app.notFound((c) =>
    c.json({ error: 'not_found', message: 'Route not found', status: 404 }, 404),
  );

  return app;
}
