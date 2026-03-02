<p align="center">
  <h1 align="center">OpenAgency</h1>
  <p align="center">
    <strong>Open-source autonomous advertising intelligence.</strong>
    <br />
    4 AI agents that observe your ad spend, detect waste, reallocate budgets, and report to executives — autonomously.
    <br />
    Connected to Google Ads, Meta, DV360, TikTok, and Amazon. Governed by safety gates. Driven by goals.
  </p>
</p>

<p align="center">
  <a href="#the-problem">Problem</a> &bull;
  <a href="#how-it-works">How It Works</a> &bull;
  <a href="#quick-start">Quick Start</a> &bull;
  <a href="#autonomous-agents">Agents</a> &bull;
  <a href="#engines">Engines</a> &bull;
  <a href="#platform-connectors">Connectors</a> &bull;
  <a href="#api">API</a> &bull;
  <a href="#architecture">Architecture</a> &bull;
  <a href="#roadmap">Roadmap</a>
</p>

<p align="center">
  <img src="https://img.shields.io/npm/v/openagency?style=flat-square" alt="npm" />
  <img src="https://img.shields.io/github/license/openagency/openagency?style=flat-square" alt="MIT License" />
  <img src="https://img.shields.io/badge/agents-4-purple?style=flat-square" alt="4 Agents" />
  <img src="https://img.shields.io/badge/engines-4-blue?style=flat-square" alt="4 Engines" />
  <img src="https://img.shields.io/badge/skills-29-green?style=flat-square" alt="29 Skills" />
  <img src="https://img.shields.io/badge/platforms-6-orange?style=flat-square" alt="6 Platforms" />
</p>

---

## The Problem

The Big 6 advertising holding companies charge millions for media planning, measurement, and optimization — capabilities locked behind proprietary processes and legacy contracts. They move slowly. They optimize for their margins, not yours.

Meanwhile, AI agents are about to eat professional services. The question isn't *if* autonomous agents will manage ad spend — it's *who builds the open alternative* before the holding companies lock it down again.

**OpenAgency is that alternative.**

## The Solution

OpenAgency is a fully autonomous advertising intelligence system. Four specialized AI agents — each implementing an OODA loop (Observe, Orient, Decide, Act) — continuously monitor your campaigns, detect waste, reallocate budgets, and generate executive reports. No humans in the loop. Safety-gated. Goal-driven. Open source.

```
Leak Detector    observes → finds $250K in waste → emits waste_detected
     ↓
Media Architect  observes waste → reallocates budget → emits budget_reallocated
     ↓
Campaign Ops     observes reallocation → pauses losers, boosts winners → emits campaign_adjusted
     ↓
Executive Bridge observes all signals → generates C-Suite report → emits executive_report
```

Every action passes through a 5-gate safety pipeline. Every decision is logged with reasoning. Every outcome is measured.

---

## How It Works

### 1. Connect your platforms

```bash
openagency connect meta_ads
openagency connect google_ads
openagency sync
```

### 2. Set a goal

```bash
curl -X POST http://localhost:3100/v1/goals \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "name": "Maximize ROAS to 4.5x in Q2",
    "type": "maximize",
    "target_metric": "roas",
    "target_value": 4.5,
    "constraints": {
      "max_budget": 500000,
      "allowed_platforms": ["meta_ads", "google_ads"]
    }
  }'
```

### 3. Start the agents

```bash
curl -X POST http://localhost:3100/v1/agents/leak-detector/start
curl -X POST http://localhost:3100/v1/agents/media-architect/start
curl -X POST http://localhost:3100/v1/agents/campaign-ops/start
curl -X POST http://localhost:3100/v1/agents/executive-bridge/start
```

### 4. They work autonomously

Each agent runs continuous OODA cycles:
- **Observe** — pull latest sync data, listen for events from other agents
- **Orient** — run computation skills, call LLM for anomaly analysis
- **Decide** — plan actions with confidence scores and risk assessment
- **Act** — execute through safety pipeline (dry-run by default)

Check what they're doing:

```bash
# See all agent statuses
curl http://localhost:3100/v1/agents

# See decisions with reasoning
curl http://localhost:3100/v1/agents/media-architect/decisions

# Approve a high-risk decision
curl -X POST http://localhost:3100/v1/agents/media-architect/decisions/$DECISION_ID/approve

# Track goal progress
curl http://localhost:3100/v1/goals/$GOAL_ID/progress
```

---

## Quick Start

### Docker (recommended for full stack)

```bash
git clone https://github.com/openagency/openagency.git
cd openagency
docker compose up
```

Starts the API server on `:3100` with PostgreSQL (pgvector) and Redis.

### CLI (quick exploration)

```bash
npx openagency scan --demo
```

### API Server (development)

```bash
pnpm install && pnpm build
cd apps/api && pnpm dev
```

### Environment

```bash
# Required for LLM reasoning (agent Orient + Decide phases)
ANTHROPIC_API_KEY=sk-ant-...    # or OPENAI_API_KEY

# Platform OAuth2 credentials
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
META_APP_ID=
META_APP_SECRET=
# ... (see Platform Connectors section)

# Database
DATABASE_URL=postgres://localhost:5432/openagency

# Optional
REDIS_URL=redis://localhost:6379
PORT=3100
```

---

## Autonomous Agents

Each agent wraps a computation engine in an OODA loop with persistent memory, event-driven observation, and goal tracking.

### Agent Architecture

| Agent | Engine | Observes | Decides | Acts |
|-------|--------|----------|---------|------|
| **Leak Detector** | leak-detector | Sync data, schedule ticks | Waste categories, severity | Emits `waste_detected` signals |
| **Media Architect** | media-architect | Sync data, waste signals, anomalies | Budget reallocation plans | Writes budget changes via platform APIs |
| **Campaign Ops** | campaign-ops | Sync data, waste signals, reallocation events | Pause/enable/bid actions | Writes campaign state via platform APIs |
| **Executive Bridge** | executive-bridge | All agent signals | Report structure, attribution | Emits `executive_report` |

### Safety Pipeline

Every platform write passes through 5 sequential gates:

| Gate | Purpose | Default |
|------|---------|---------|
| **Dry Run** | Log action without executing | `dry_run: true` |
| **Budget Cap** | Reject if change exceeds threshold | `max_budget_change_pct: 20` |
| **Daily Write Limit** | Max writes per platform per day | 50 |
| **Approval Gate** | Require human approval above USD threshold | `approval_threshold_usd: 5000` |
| **Rollback Tracker** | Record previous values for undo | Always records |

### Agent Configuration

```bash
curl -X PATCH http://localhost:3100/v1/agents/media-architect/config \
  -d '{
    "cycle_interval_ms": 3600000,
    "max_budget_change_pct": 15,
    "approval_threshold_usd": 10000,
    "dry_run": false,
    "writable_platforms": ["meta_ads", "google_ads"]
  }'
```

### Decision Transparency

Every decision includes:
- **Reasoning** — LLM-generated explanation of why
- **Confidence** — 0-1 score
- **Risk level** — low / medium / high / critical
- **Planned actions** — exactly what will change
- **Estimated impact** — projected improvement
- **Rollback plan** — how to undo

```bash
curl http://localhost:3100/v1/agents/media-architect/decisions | jq '.[0]'
```

---

## Engines

4 computation engines — pure functions, no side effects, deterministic. The agents use these as skills during their Orient phase.

### Leak Detector — "Where is my money leaking?"

6-stage waste waterfall analysis with industry benchmarks.

**Skills:** `waste-waterfall`, `waste-estimate`, `waste-compare`, `supply-chain-audit`, `media-quality-score`

### Media Architect — "Where should my budget go?"

Hill saturation curves, greedy marginal allocation, MMM scenario planning.

**Skills:** `channel-optimize`, `scenario-analysis`, `mmm-pre-model`, `mmm-model`, `mmm-post-model`, `mmm-optimize`, `health-check`, `anomaly-detect`, `generate-plan`

### Campaign Ops — "Is the campaign on track?"

24-task DAG state machine, 6 rule-based optimization checks, cross-channel reallocation.

**Skills:** `create-campaign`, `update-task`, `next-actions`, `campaign-summary`, `optimization-analyze`, `optimization-reallocate`

### Executive Bridge — "What's the real ROI?"

Shapley attribution, L3-L2-L1 metric translation, revenue reconciliation, incrementality testing.

**Skills:** `shapley-attribute`, `shapley-compare`, `revenue-translate`, `revenue-compare-channels`, `reconcile`, `data-integrity`, `geo-lift`, `conversion-lift`, `holdout`

---

## Platform Connectors

Live read and write connections to 6 advertising platforms via OAuth2.

### Read (Sync)

| Platform | API | Data Levels |
|----------|-----|-------------|
| **Google Ads** | Ads API v17 | Campaign, Ad Group, Ad |
| **Meta Ads** | Marketing API v21.0 | Campaign, Ad Set, Ad |
| **DV360** | Reporting API v3 | Insertion Order, Line Item, Creative |
| **TikTok Ads** | Marketing API v1.3 | Campaign, Ad Group, Ad |
| **TikTok Shop** | Shop API v2 | Daily Aggregate, Product |
| **Amazon Ads** | Advertising API v3 | Campaign, Ad Group |

### Write (Agent Actions)

| Platform | Budget Update | Pause/Enable | Bid Adjust |
|----------|--------------|--------------|------------|
| **Meta** | Graph API | Graph API | Graph API |
| **Google Ads** | Mutate API | Mutate API | Mutate API |
| **DV360** | PATCH lineItems | PATCH lineItems | PATCH lineItems |
| **TikTok Ads** | Marketing API | Marketing API | Marketing API |
| **TikTok Shop** | Marketing API | Marketing API | N/A |
| **Amazon Ads** | SP Campaigns API | SP Campaigns API | SP Campaigns API |

All writes pass through the safety pipeline. Credentials encrypted at rest (AES-256-GCM).

---

## API

### Protocols

| Protocol | Endpoint | Description |
|----------|----------|-------------|
| **REST** | `http://localhost:3100/v1/*` | Full CRUD for engines, agents, goals, decisions |
| **MCP** | `POST /v1/mcp` | Model Context Protocol — any AI agent can invoke skills |
| **A2A** | `GET /.well-known/agent.json` | Agent-to-Agent discovery card |

### Key REST Endpoints

**Agents**
```
GET    /v1/agents                           # List all agents
GET    /v1/agents/:id                       # Agent detail
POST   /v1/agents/:id/start                 # Start OODA loop
POST   /v1/agents/:id/stop                  # Stop agent
POST   /v1/agents/:id/pause                 # Pause (observe only)
POST   /v1/agents/:id/resume                # Resume
POST   /v1/agents/:id/cycle                 # Manual OODA cycle
PATCH  /v1/agents/:id/config                # Update configuration
GET    /v1/agents/:id/decisions              # List decisions
POST   /v1/agents/:id/decisions/:did/approve # Approve decision
POST   /v1/agents/:id/decisions/:did/reject  # Reject decision
```

**Goals**
```
POST   /v1/goals                            # Create goal
GET    /v1/goals                            # List goals
GET    /v1/goals/:id                        # Goal detail
PATCH  /v1/goals/:id                        # Update goal
DELETE /v1/goals/:id                        # Cancel goal
POST   /v1/goals/:id/decompose             # LLM decomposition
GET    /v1/goals/:id/progress               # Progress report
```

**Engines**
```
POST   /v1/engines/:engine/skills/:skill    # Run skill directly
GET    /v1/engines                           # List engines
GET    /v1/schemas/:engine/:skill            # JSON Schema for skill
```

### Authentication

| Method | Use Case |
|--------|----------|
| API Key (`X-API-Key` header) | Machine-to-machine |
| JWT Bearer token | User sessions |
| OAuth2 Client Credentials | M2M with scoped permissions |

### MCP Tools

Any MCP-compatible AI agent can invoke OpenAgency skills:

```json
{
  "method": "tools/call",
  "params": {
    "name": "leak-detector__waste-waterfall",
    "arguments": { "gross_spend": 500000, "industry": "retail" }
  }
}
```

Plus agent management tools: `agent_list`, `agent_start`, `agent_stop`, `agent_cycle`, `agent_approve_decision`.

---

## Architecture

```
                        ┌─────────────────────────────────┐
                        │         API Gateway (Hono)       │
                        │   REST + MCP + A2A + Auth + RBAC │
                        └──────────┬──────────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                     │
    ┌─────────▼──────────┐ ┌──────▼──────────┐ ┌───────▼────────┐
    │   Agent Runtime    │ │  Event Bus      │ │  Goal System   │
    │   (OODA Loops)     │ │  (Redis/Memory) │ │  (LLM Decomp)  │
    │                    │ │                 │ │                │
    │  leak-detector     │ │  22 event types │ │  Goal Tracker  │
    │  media-architect   │ │  pub/sub        │ │  Progress      │
    │  campaign-ops      │ │  cross-engine   │ │  Auto-adjust   │
    │  executive-bridge  │ │                 │ │                │
    └─────────┬──────────┘ └─────────────────┘ └────────────────┘
              │
    ┌─────────▼──────────┐
    │  Safety Pipeline   │
    │  5 gates per write │
    └─────────┬──────────┘
              │
    ┌─────────▼──────────────────────────────────────────────┐
    │                  Connector Layer                        │
    │  Google Ads │ Meta │ DV360 │ TikTok │ Amazon           │
    │  Read (sync) + Write (budget/pause/bid)                │
    │  OAuth2 + Rate Limiting + Encrypted Credentials        │
    └────────────────────────────────────────────────────────┘
              │
    ┌─────────▼──────────┐
    │    Persistence     │
    │  PostgreSQL +      │
    │  pgvector          │
    │                    │
    │  Agent state       │
    │  Decisions + log   │
    │  Goals + outcomes  │
    │  Vector memory     │
    └────────────────────┘
```

### Monorepo

```
openagency/
├── packages/
│   ├── types/          Shared TypeScript types (agent, decision, goal, connector-write, events)
│   ├── core/           Orchestration, LLM abstraction, CSV parser
│   ├── schemas/        Zod schemas, JSON Schema + OpenAPI generation
│   ├── auth/           JWT, API keys, OAuth2 M2M, RBAC middleware
│   ├── events/         Event bus (InMemory + Redis), 22 agent event types
│   ├── engines/        4 pure computation engines (29 skills)
│   ├── connectors/     6 platform connectors (read + write), safety pipeline
│   ├── memory/         PostgreSQL repositories (state, decisions, goals, vector memory)
│   └── agent/          OODA runtime, observer pipeline, LLM reasoning, goal system
├── apps/
│   ├── api/            Hono API server (REST + MCP + A2A), Docker-ready
│   ├── cli/            CLI tool (npx openagency)
│   └── web/            Vite + React dashboard
└── docker/             Docker Compose (API + PostgreSQL/pgvector + Redis)
```

### Key Design Principles

- **Engines are pure computation.** No I/O, no side effects, deterministic. They run identically in Node.js, browsers, and tests.
- **Agents are autonomous.** Each implements a full OODA loop with persistent memory and goal tracking.
- **Safety is non-negotiable.** Every platform write passes through 5 gates. Dry-run by default.
- **Events drive coordination.** Agents communicate through typed events, not direct calls.
- **LLM is the reasoning layer.** Engines compute. LLM interprets, plans, and decides.
- **Protocols are open.** MCP for tool invocation. A2A for agent discovery. REST for everything else.

---

## Development

```bash
git clone https://github.com/openagency/openagency.git
cd openagency

pnpm install
pnpm build        # Build all 12 packages
pnpm test         # Run all tests

# API server
cd apps/api && pnpm dev    # http://localhost:3100

# Web dashboard
cd apps/web && pnpm dev    # http://localhost:5173

# CLI
node apps/cli/dist/index.js scan --demo
```

---

## Changelog

### v2.0.0 — Autonomous Engine
- **OODA Runtime** — 4 autonomous agents with Observe-Orient-Decide-Act loops
- **Goal-Driven Execution** — submit goals, LLM decomposes into sub-tasks, agents execute autonomously
- **Safety Pipeline** — 5-gate system (dry-run, budget cap, daily limit, approval, rollback) for all platform writes
- **Platform Write API** — budget updates, campaign pause/enable, bid adjustments across all 6 platforms
- **Persistent State** — PostgreSQL repositories for agent state, decisions, action logs, outcomes, goals
- **Vector Memory** — pgvector for agent memory with full-text search fallback
- **22 Agent Events** — typed events for agent lifecycle, OODA cycles, decisions, actions, domain signals
- **Agent REST API** — 14 endpoints for agent management, decision approval, outcome tracking
- **Goal REST API** — 7 endpoints for goal CRUD, LLM decomposition, progress tracking
- **MCP Agent Tools** — agent_list, agent_start, agent_stop, agent_cycle, agent_approve_decision
- **Cross-Engine Event Flow** — Leak Detector -> Media Architect -> Campaign Ops -> Executive Bridge
- **New packages:** `@openagency/memory`, `@openagency/agent`

### v1.0.0 — Agent Protocol Layer
- **Hono API server** with REST endpoints for all 29 skills
- **MCP endpoint** (`POST /v1/mcp`) — any AI agent can invoke skills via Model Context Protocol
- **A2A agent card** (`GET /.well-known/agent.json`) — agent-to-agent discovery
- **Auth system** — JWT + API keys (`oa_live_`/`oa_test_`) + OAuth2 M2M + RBAC
- **Event bus** — InMemoryEventBus + Redis adapter, skill lifecycle events
- **Schema registry** — Zod schemas with JSON Schema + OpenAPI generation
- **Docker** — multi-stage Dockerfile, docker-compose (API + Postgres + Redis)
- **New packages:** `@openagency/schemas`, `@openagency/auth`, `@openagency/events`

### v0.3.0 — Platform API Connectors
- Live OAuth2 connectors for Google Ads, Meta Ads, DV360, TikTok Ads, TikTok Shop, Amazon Ads
- Multi-level data fetching, encrypted credential storage (AES-256-GCM)
- Rate limiting with exponential backoff, scheduled sync
- New package: `@openagency/connectors`

### v0.2.0 — Smart CSV & Visualization
- Smart CSV auto-detect for Google Ads, Meta Ads, TikTok Ads exports
- PDF export, IndexedDB persistence, MMM visualization suite

### v0.1.0 — Foundation
- 4 computation engines, 29 skills, CLI, web dashboard, multi-LLM support

---

## Roadmap

- [x] **v0.1.0** — 4 engines, 29 skills, CLI, web dashboard
- [x] **v0.2.0** — Smart CSV, PDF export, MMM charts
- [x] **v0.3.0** — 6 platform connectors, OAuth2, encrypted credentials
- [x] **v1.0.0** — API server, MCP, A2A, auth, events, Docker
- [x] **v2.0.0** — Autonomous agents, OODA loops, goals, safety pipeline, platform writes
- [ ] **v3.0.0** — Multi-agent orchestration, agent mesh, cross-client federation
- [ ] **v4.0.0** — Self-evolving system, meta-agent, marketplace, agent-native billing

---

## Contributing

```bash
pnpm test         # All tests must pass
pnpm run typecheck  # Zero type errors
pnpm build        # All 12 packages build
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## License

MIT. Use it, fork it, ship it.

---

<p align="center">
  <strong>Built to atomize the advertising agency monopoly.</strong>
  <br />
  The Big 6 charge millions for what 4 autonomous agents can do for free.
</p>
