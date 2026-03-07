# Next Session: Plinth Integration & Production Readiness

## Current State (v3.2 — HFL + Plinth API Audit complete)

**Build:** 13/13 packages (including `@openagency/hfl`). **Tests:** 380 passing in 36 files. **0 type errors.**
**Branch:** `claude/vigorous-bose` at commit `582707e`
**Remote:** `origin https://github.com/afelipeg/andres-claude-plugins.git`

---

## What Was Completed

### @openagency/hfl package (fully implemented)
- **RiskScorer**: Evaluates mesh run risk (spend impact thresholds, stage failures, first-run escalation)
- **RenderEngine**: 3 render levels — minimal (text), rich (markdown), full (JSON for Plinth/scorecard)
- **ChannelDispatcher**: Webhook + MCP callback delivery with configurable retries
- **HFLCoordinator**: Orchestrates evaluate -> score -> render -> dispatch flow
- **scorecard_base_url**: Support for "Ver detalle" action links in all render levels
- **34 tests** across 4 test files (risk-scorer, render-engine, channel-dispatcher, coordinator)

### Plinth API Audit (apps/api — all endpoints verified/created)
- **Auth**: `POST /v1/auth/register`, `POST /v1/auth/login`, `GET /v1/auth/me` (in-memory store, JWT via jose)
- **Connectors**: `GET /v1/connectors/:platform/auth-url`, `POST /v1/connectors/:platform/callback`, `GET /v1/connectors/:platform/status`, `GET /v1/connectors/status` (aggregate)
- **HFL**: `POST /v1/hfl/config/test` (webhook connectivity verification with MCP callback handling)
- **Mesh**: Paginated `GET /v1/mesh/runs` (page/limit/status filter, HFL decision summary), `GET /v1/mesh/runs/:id/recovery` (per-agent recovery breakdown)
- **Agents**: `GET /v1/agents/status` (aggregate dashboard: total/active/idle/paused/errored)
- **SSE**: Verified HFL events flow through `eventBus.onAny()`
- **13 integration tests** in `api-plinth-audit.test.ts`

---

## What Remains for Production

### Priority 1: Database Persistence
- Auth currently uses in-memory `Map<string, UserRecord>` — needs PostgreSQL migration
- HFL decisions are in-memory in `HFLCoordinator` — need `hfl_decisions` table
- Create migration `004_hfl_decisions.ts` with columns: id, run_id, client_id, status, urgency, risk_score, render_output, dispatched_to, human_response, human_feedback, created_at, resolved_at

### Priority 2: Wire HFL into Mesh Pipeline
- In `mesh-coordinator.ts`, after `executePipeline()` completes:
  - Call `hflCoordinator.evaluate(meshRun)` to trigger automatic risk scoring
  - Auto-approved runs proceed to action execution
  - Escalated runs pause and wait for human response via REST
- This is the "production handoff" — currently HFL works standalone but isn't triggered by mesh

### Priority 3: Plinth Frontend Integration Testing
- Fetch `https://plinth.polanyi.tech/demo/` to understand what JSON fields the scorecard expects
- Map those fields to the `render_level: 'full'` JSON payload from `RenderEngine`
- Ensure all 10 scorecard pages have the data they need in the `RenderOutput.metadata` object
- Verify the "Ver detalle" links use correct `scorecard_base_url` prefix

### Priority 4: MCP Tool Registration
- Register HFL tools in MCP server (`apps/api/src/mcp/server.ts`):
  - `hfl_config` — view/modify channel config
  - `hfl_approve_run` — approve a pending run
  - `hfl_reject_run` — reject with feedback
  - `hfl_decisions` — query decision history
- These are partially scaffolded but need wiring to actual HFLCoordinator

### Priority 5: Production Hardening
- Replace SHA256 password hashing with bcrypt or argon2
- Add rate limiting to auth endpoints
- Add request validation middleware (zod schemas for all body params)
- OAuth token refresh flow for connectors (currently only exchange, no refresh)
- HFL timeout handling — auto-escalate if human doesn't respond within `timeout_ms`

---

## Architecture Reference

```
OpenAgency Core (engines, mesh, OODA, billing)
                    |
               packages/hfl/
                    |
    +---------------+---------------+
    v               v               v
Risk Scorer    Channel         Render Engine
(needs human?) Dispatcher      (adapts format
               (where to       to channel)
               send?)
    |               |               |
    v               v               v
auto-execute   webhook POST    RenderOutput payload
or escalate    to configured   { format, content,
               channel           actions, metadata }
```

### API Endpoint Map (Plinth-ready)

```
Auth:
  POST /v1/auth/register          -> { user, token }
  POST /v1/auth/login             -> { user, token }
  GET  /v1/auth/me                -> user profile (requires auth)
  POST /v1/auth/token             -> M2M client_credentials grant
  POST /v1/auth/api-keys          -> create API key (admin)
  GET  /v1/auth/api-keys          -> list API keys (admin)
  DELETE /v1/auth/api-keys/:hash  -> revoke API key (admin)

Connectors:
  GET  /v1/connectors             -> list all connectors
  GET  /v1/connectors/status      -> aggregate status (connected/syncing counts)
  GET  /v1/connectors/:platform/auth-url   -> OAuth URL
  POST /v1/connectors/:platform/callback   -> OAuth code exchange
  GET  /v1/connectors/:platform/status     -> per-platform detail
  POST /v1/connectors/:platform/connect    -> connect with credentials
  POST /v1/connectors/:platform/disconnect -> disconnect
  GET  /v1/connectors/:platform/accounts   -> list ad accounts
  POST /v1/connectors/:platform/sync       -> trigger sync
  GET  /v1/connectors/:platform/sync/results -> sync results

HFL:
  POST /v1/mesh/runs/:runId/approve  -> approve pending run
  POST /v1/mesh/runs/:runId/reject   -> reject with feedback
  GET  /v1/hfl/config                -> view channel config
  PUT  /v1/hfl/config                -> update config
  POST /v1/hfl/config/test           -> test webhook connectivity
  GET  /v1/hfl/decisions             -> decision history
  GET  /v1/hfl/decisions/:id         -> decision detail
  GET  /v1/hfl/pending               -> pending decisions

Mesh:
  GET  /v1/mesh/pipelines            -> list pipelines
  GET  /v1/mesh/pipelines/:id        -> pipeline detail
  POST /v1/mesh/pipelines/:id/run    -> start pipeline run
  GET  /v1/mesh/runs                 -> paginated runs (page, limit, status)
  GET  /v1/mesh/runs/:id             -> run detail + HFL decision
  GET  /v1/mesh/runs/:id/recovery    -> recovery breakdown per agent

Agents:
  GET  /v1/agents                    -> list all agents
  GET  /v1/agents/status             -> aggregate status (dashboard)
  GET  /v1/agents/:id                -> agent detail
  POST /v1/agents/:id/start          -> start agent
  POST /v1/agents/:id/stop           -> stop agent
  POST /v1/agents/:id/pause          -> pause agent
  POST /v1/agents/:id/resume         -> resume agent
  POST /v1/agents/:id/cycle          -> manual OODA cycle
  PATCH /v1/agents/:id/config        -> update config
  GET  /v1/agents/:id/decisions      -> agent decisions
  POST /v1/agents/:id/decisions/:did/approve  -> approve decision
  POST /v1/agents/:id/decisions/:did/reject   -> reject decision
  POST /v1/agents/:id/decisions/:did/rollback -> rollback decision
  POST /v1/agents/:id/actions/:aid/rollback   -> rollback action
  POST /v1/agents/:id/chat           -> send human feedback
  GET  /v1/agents/:id/chat           -> chat history

SSE:
  GET  /v1/events                    -> SSE stream (all events including HFL)
```

---

## Technical Context

- **LLM**: Anthropic Claude (primary), DeepSeek (fallback). **NO OpenAI for reasoning.**
- **Embeddings**: Voyage AI (`voyage-3`, 1024 dims). Keyword fallback without `VOYAGE_API_KEY`.
- **DB**: PostgreSQL + pgvector. Migrations in `apps/api/src/db/migrations/` (001->003).
- **API**: Hono v4 on port 3100. Dev key: `oa_test_dev_default_key_for_local_testing`
- **Build**: `pnpm build` (Turborepo, 13 packages). `pnpm test` for 380 tests.
- **Docker**: `docker compose up` starts api + postgres + redis.
- **Dependency chain**: `types -> schemas -> memory -> events -> agent -> hfl -> api`
- **Node.js**: Requires v20+ (use `nvm use 20`). Default v15 causes syntax errors.
- **Worktree note**: Turbo may fail in worktrees (arch mismatch). Use `npx tsc -b` and `npx vitest run` directly.

## Command to Start

```bash
cd /Users/andresgutierrezhenao/Documents/claude-plugins/openagency
source ~/.nvm/nvm.sh && nvm use 20
pnpm build && pnpm test  # Verify clean state (13/13 build, 380 tests)
```
