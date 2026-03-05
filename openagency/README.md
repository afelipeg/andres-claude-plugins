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
  <a href="#agent-mesh">Agent Mesh</a> &bull;
  <a href="#platform-connectors">Connectors</a> &bull;
  <a href="#federation">Federation</a> &bull;
  <a href="#api">API</a> &bull;
  <a href="#architecture">Architecture</a> &bull;
  <a href="#roadmap">Roadmap</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-3.1.0-blue?style=flat-square" alt="v3.1.0" />
  <img src="https://img.shields.io/github/license/openagency/openagency?style=flat-square" alt="MIT License" />
  <img src="https://img.shields.io/badge/agents-4-purple?style=flat-square" alt="4 Agents" />
  <img src="https://img.shields.io/badge/engines-4-blue?style=flat-square" alt="4 Engines" />
  <img src="https://img.shields.io/badge/skills-29-green?style=flat-square" alt="29 Skills" />
  <img src="https://img.shields.io/badge/platforms-6-orange?style=flat-square" alt="6 Platforms" />
  <img src="https://img.shields.io/badge/tests-286-brightgreen?style=flat-square" alt="286 Tests" />
  <img src="https://img.shields.io/badge/MCP_tools-53-red?style=flat-square" alt="53 MCP Tools" />
</p>

---

## The Problem

The Big 6 advertising holding companies charge millions for media planning, measurement, and optimization — capabilities locked behind proprietary processes and legacy contracts. They move slowly. They optimize for their margins, not yours.

Meanwhile, AI agents are about to eat professional services. The question isn't *if* autonomous agents will manage ad spend — it's *who builds the open alternative* before the holding companies lock it down again.

**OpenAgency is that alternative.**

## The Solution

OpenAgency is a fully autonomous advertising intelligence system. Four specialized AI agents — each implementing an OODA loop (Observe, Orient, Decide, Act) — continuously monitor your campaigns, detect waste, reallocate budgets, and generate executive reports. No humans in the loop. Safety-gated. Goal-driven. Open source.

```
Your Ad Platforms (Google, Meta, TikTok, DV360, Amazon)
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│                    OpenAgency v3.1                       │
│                                                         │
│   ┌──────────────┐    ┌──────────────┐                  │
│   │ Leak Detector │───▶│Media Architect│                 │
│   │ "Where's the  │    │ "Where should │                 │
│   │  waste?"      │    │  budget go?"  │                 │
│   └──────┬───────┘    └──────┬───────┘                  │
│          │                    │                          │
│          ▼                    ▼                          │
│   ┌──────────────┐    ┌──────────────┐                  │
│   │ Campaign Ops  │◀───│Exec. Bridge  │                 │
│   │ "Is it on     │    │ "What's the  │                 │
│   │  track?"      │    │  real ROI?"  │                 │
│   └──────────────┘    └──────────────┘                  │
│                                                         │
│   Safety Pipeline → 5 gates → Platform Write APIs       │
└─────────────────────────────────────────────────────────┘
         │
         ▼
   Budget changes, pauses, bid adjustments — automatically
```

Every action passes through a 5-gate safety pipeline. Every decision is logged with reasoning. Every outcome is measured.

---

## How It Works

OpenAgency runs a continuous intelligence loop across your entire advertising portfolio. Here's the full flow, from raw data to autonomous action.

### Step 1 — Connect your ad platforms

```bash
# OAuth2 flow — stores encrypted credentials (AES-256-GCM)
curl -X POST http://localhost:3100/v1/connectors/meta_ads/auth \
  -d '{"redirect_uri": "http://localhost:3100/callback"}'

# Or configure via environment
export META_APP_ID=your_app_id
export META_APP_SECRET=your_app_secret
export GOOGLE_ADS_CLIENT_ID=your_client_id
# ...
```

OpenAgency connects to 6 platforms: **Google Ads**, **Meta Ads**, **DV360**, **TikTok Ads**, **TikTok Shop**, **Amazon Ads**. Each connector handles OAuth2, token refresh, rate limiting, and multi-level data fetching (campaign → ad group → ad).

### Step 2 — Ingest your data

```bash
# Sync live data from connected platforms
curl -X POST http://localhost:3100/v1/connectors/sync

# Or upload files (CSV, Excel, PDF)
curl -X POST http://localhost:3100/v1/upload \
  -F "file=@campaign_report.xlsx"

# Or run an engine directly with inline data
curl -X POST http://localhost:3100/v1/engines/leak-detector/skills/waste-waterfall \
  -d '{
    "gross_spend": 1000000,
    "non_working": {"agency_fees": 80000, "tech_fees": 40000},
    "supply_chain": {"dsp_fees": 50000, "ssp_fees": 30000},
    "quality": {"fraud": 40000, "non_viewable": 30000}
  }'
```

The file parser auto-detects Google Ads, Meta Ads, and TikTok Ads CSV exports. Excel and PDF files are parsed via `xlsx` and `pdf-parse`.

### Step 3 — Set goals for your agents

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

The **GoalDecomposer** (LLM-powered) breaks high-level goals into sub-tasks mapped to specific engine skills. The **GoalTracker** monitors progress and auto-adjusts plans when metrics drift off track.

### Step 4 — Start the agents

```bash
# Start all 4 agents
curl -X POST http://localhost:3100/v1/agents/leak-detector/start
curl -X POST http://localhost:3100/v1/agents/media-architect/start
curl -X POST http://localhost:3100/v1/agents/campaign-ops/start
curl -X POST http://localhost:3100/v1/agents/executive-bridge/start

# Or run a full mesh pipeline (all 4 in sequence)
curl -X POST http://localhost:3100/v1/mesh/pipelines/full-optimization/run
```

### Step 5 — They work autonomously

Each agent runs continuous OODA cycles with a configurable rate floor (default 5s minimum between cycles):

```
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ OBSERVE │───▶│ ORIENT  │───▶│ DECIDE  │───▶│   ACT   │
│         │    │         │    │         │    │         │
│ Pull    │    │ Run     │    │ LLM     │    │ Safety  │
│ sync    │    │ engine  │    │ reasons │    │ pipeline│
│ data +  │    │ skills  │    │ + plans │    │ → write │
│ events  │    │         │    │ actions │    │ to APIs │
└─────────┘    └─────────┘    └─────────┘    └─────────┘
     ▲                                            │
     └────────────────────────────────────────────┘
                    Continuous loop
```

- **Observe** — pull latest sync data, listen for events from other agents
- **Orient** — run computation skills (29 available), call LLM for anomaly analysis
- **Decide** — plan actions with confidence scores, risk assessment, and rollback plans
- **Act** — execute through safety pipeline (dry-run by default), log everything

### Step 6 — Monitor and approve

```bash
# See all agent statuses
curl http://localhost:3100/v1/agents

# See decisions with LLM reasoning
curl http://localhost:3100/v1/agents/media-architect/decisions

# Approve a high-risk decision
curl -X POST http://localhost:3100/v1/agents/media-architect/decisions/$ID/approve

# Track goal progress
curl http://localhost:3100/v1/goals/$GOAL_ID/progress

# Stream real-time events (SSE)
curl http://localhost:3100/v1/events/stream
```

### Step 7 — Get the scorecard

```bash
# Full scorecard with billing
curl http://localhost:3100/v1/scorecard?ad_spend=1000000

# Or run the full analyze pipeline (upload → engines → scorecard)
curl -X POST http://localhost:3100/v1/analyze \
  -d '{"ad_spend": 1000000, "data": {...}}'
```

The scorecard shows waste detected, budget optimizations, campaign alerts, revenue reconciliation, and outcome-based billing (you only pay for value delivered).

---

## Quick Start

### Docker (recommended for full stack)

```bash
git clone https://github.com/openagency/openagency.git
cd openagency
cp .env.example .env
# Edit .env with your API keys
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
# LLM (at least one required for autonomous agents)
# Detection priority: Anthropic > DeepSeek > OpenAI
ANTHROPIC_API_KEY=sk-ant-...
DEEPSEEK_API_KEY=sk-...          # DeepSeek Chat API
OPENAI_API_KEY=sk-...            # Also supports vector embeddings

# Database
DATABASE_URL=postgres://localhost:5432/openagency

# Optional
REDIS_URL=redis://localhost:6379
PORT=3100
```

See [`.env.example`](.env.example) for the full list of 28 environment variables.

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

Safety evaluations are persisted as audit trail entries. The daily write limit gate uses actual write history from the action log.

### Agent Configuration

```bash
curl -X PATCH http://localhost:3100/v1/agents/media-architect/config \
  -d '{
    "cycle_interval_ms": 3600000,
    "min_cycle_interval_ms": 5000,
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

---

## Engines

4 computation engines — pure functions, no side effects, deterministic. The agents use these as skills during their Orient phase.

### Leak Detector — "Where is my money leaking?"

6-stage waste waterfall analysis with industry benchmarks.

**Skills:** `waste-waterfall`, `waste-estimate`, `waste-compare`, `supply-chain-audit`, `media-quality-score`

### Media Architect — "Where should my budget go?"

Hill saturation curves, greedy marginal allocation, MMM scenario planning.

**Skills:** `channel-optimize`, `channel-scenario`, `mmm-pre-model`, `mmm-model`, `mmm-post-model`, `mmm-optimize`, `benchmark-health`, `anomaly-detect`, `media-plan`

### Campaign Ops — "Is the campaign on track?"

24-task DAG state machine, 6 rule-based optimization checks, cross-channel reallocation.

**Skills:** `campaign-create`, `campaign-update-task`, `campaign-next-actions`, `campaign-summary`, `optimization-analyze`, `optimization-reallocate`

### Executive Bridge — "What's the real ROI?"

Shapley attribution, L3-L2-L1 metric translation, revenue reconciliation, incrementality testing.

**Skills:** `shapley-attribute`, `shapley-compare`, `revenue-translate`, `revenue-compare`, `reconcile`, `integrity`, `geo-lift`, `conversion-lift`, `holdout`

---

## Agent Mesh

Multi-agent orchestration runs all 4 agents in a coordinated pipeline. Each stage passes enriched context (output summaries, anomaly counts, action results) to the next.

### Default Pipeline

```
Stage 1: Leak Detector    → waste analysis, quality scoring
    ↓ (context: waste_summary, anomaly_count)
Stage 2: Media Architect   → budget reallocation based on waste signals
    ↓ (context: optimized_allocation, kpi_lift)
Stage 3: Campaign Ops      → pause/enable/bid based on reallocation
    ↓ (context: campaign_alerts, actions_taken)
Stage 4: Executive Bridge   → reconcile, translate, report
    ↓ (context: executive_scorecard)
```

### Mesh API

```bash
# Run full pipeline
POST /v1/mesh/pipelines/full-optimization/run

# Custom pipeline
POST /v1/mesh/pipelines
{"name": "quick-audit", "stages": [
  {"agent_id": "leak-detector", "timeout_ms": 30000},
  {"agent_id": "executive-bridge", "timeout_ms": 30000}
]}

# Pipeline status
GET /v1/mesh/runs/:runId
```

### Usage Metering

Every mesh run tracks: stages completed, LLM tokens consumed, platform actions executed, total duration.

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

## Federation

OpenAgency can both expose and consume agent capabilities across instances.

### Outbound (expose)

- **A2A Discovery** — `GET /.well-known/agent.json` returns an agent card with capabilities
- **MCP Server** — `POST /v1/mcp` exposes 53 tools to any MCP-compatible AI agent

### Inbound (consume)

- **A2A Client** — discover and invoke skills on remote OpenAgency instances
- **MCP Client Registry** — connect to external MCP servers, discover tools, invoke them

```bash
# Discover a remote OpenAgency instance
curl -X POST http://localhost:3100/v1/federation/discover \
  -d '{"url": "https://partner-agency.example.com"}'

# Connect an external MCP server
curl -X POST http://localhost:3100/v1/federation/mcp/connect \
  -d '{"name": "analytics-server", "url": "https://analytics.example.com/mcp"}'

# Call a remote MCP tool
curl -X POST http://localhost:3100/v1/federation/mcp/analytics-server/tools/forecast \
  -d '{"channel": "meta_ads", "horizon_days": 30}'
```

### Skill Marketplace

Dynamic skill registration — extend OpenAgency with custom skills at runtime.

```bash
# Register a custom skill
curl -X POST http://localhost:3100/v1/marketplace/skills \
  -d '{
    "engineId": "custom",
    "skillId": "sentiment-analysis",
    "name": "Ad Sentiment Analysis",
    "description": "Analyze ad copy sentiment using NLP",
    "inputSchema": {"type": "object", "properties": {"text": {"type": "string"}}},
    "remoteUrl": "https://my-nlp-api.example.com/analyze"
  }'

# Execute it
curl -X POST http://localhost:3100/v1/marketplace/skills/custom/sentiment-analysis/execute \
  -d '{"text": "Buy now! Limited time offer!"}'

# List all skills (29 built-in + dynamic)
curl http://localhost:3100/v1/marketplace/skills
```

---

## API

### Protocols

| Protocol | Endpoint | Description |
|----------|----------|-------------|
| **REST** | `http://localhost:3100/v1/*` | Full CRUD for engines, agents, goals, mesh, connectors, federation |
| **MCP** | `POST /v1/mcp` | Model Context Protocol — 53 tools for any AI agent |
| **A2A** | `GET /.well-known/agent.json` | Agent-to-Agent discovery card |
| **SSE** | `GET /v1/events/stream` | Real-time event streaming |

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

**Mesh**
```
POST   /v1/mesh/pipelines/:id/run           # Run pipeline
GET    /v1/mesh/runs/:runId                 # Run status
GET    /v1/mesh/pipelines                   # List pipelines
```

**Connectors**
```
POST   /v1/connectors/:platform/auth        # Start OAuth2 flow
POST   /v1/connectors/sync                  # Sync all platforms
GET    /v1/connectors/status                # Connection status
```

**Federation**
```
POST   /v1/federation/discover              # Discover remote agent
GET    /v1/federation/agents                # List discovered agents
POST   /v1/federation/agents/invoke         # Invoke remote skill
POST   /v1/federation/mcp/connect           # Connect MCP server
GET    /v1/federation/mcp/servers           # List MCP servers
POST   /v1/federation/mcp/:server/tools/:t  # Call remote tool
```

**Marketplace**
```
POST   /v1/marketplace/skills              # Register dynamic skill
GET    /v1/marketplace/skills              # List all skills
POST   /v1/marketplace/skills/:e/:s/execute # Execute skill
DELETE /v1/marketplace/skills/:e/:s         # Unregister skill
```

### Authentication

| Method | Use Case |
|--------|----------|
| API Key (`X-API-Key` header) | Machine-to-machine |
| JWT Bearer token | User sessions |
| OAuth2 Client Credentials | M2M with scoped permissions |

### MCP Tools (53)

Any MCP-compatible AI agent can invoke OpenAgency tools:

```json
{
  "method": "tools/call",
  "params": {
    "name": "leak-detector__waste-waterfall",
    "arguments": { "gross_spend": 500000, "industry": "retail" }
  }
}
```

**29 engine skills** + **5 agent tools** + **6 mesh tools** + **6 connector tools** + **6 federation tools** + **1 upload tool** = **53 MCP tools**

### LLM Providers

OpenAgency supports multiple LLM providers for agent reasoning. Auto-detection priority:

| Priority | Provider | Env Variable | Default Model |
|----------|----------|-------------|---------------|
| 1 | **Anthropic** (Claude) | `ANTHROPIC_API_KEY` | `claude-sonnet-4-20250514` |
| 2 | **DeepSeek** | `DEEPSEEK_API_KEY` | `deepseek-chat` |
| 3 | **OpenAI** | `OPENAI_API_KEY` | `gpt-4o` |
| 4 | **Ollama** (local) | — | `llama3` |

---

## Architecture

```
                        ┌─────────────────────────────────────────┐
                        │         API Gateway (Hono v4)            │
                        │  REST + MCP + A2A + SSE + Auth + RBAC    │
                        └──────────┬──────────────────────────────┘
                                   │
      ┌────────────────────────────┼────────────────────────────┐
      │                            │                             │
┌─────▼──────────┐   ┌────────────▼────────────┐   ┌────────────▼────────┐
│  Agent Mesh    │   │    Event Bus            │   │   Goal System       │
│  (Pipeline     │   │    (Redis / InMemory)   │   │   (LLM Decompose)   │
│   Coordinator) │   │                         │   │                     │
│                │   │   37 event types        │   │   GoalTracker       │
│  4 OODA agents │   │   pub/sub + wildcard    │   │   GoalDecomposer    │
│  Sequential    │   │   SSE streaming         │   │   Auto-adjust       │
│  pipelines     │   │                         │   │                     │
└─────┬──────────┘   └─────────────────────────┘   └─────────────────────┘
      │
┌─────▼──────────┐   ┌─────────────────────────┐
│ Safety Pipeline│   │   Federation Layer      │
│ 5 gates/write  │   │                         │
│ Audit trail    │   │   A2A Client (consume)  │
│                │   │   MCP Client Registry   │
│ dry_run        │   │   Skill Marketplace     │
│ budget_cap     │   │                         │
│ daily_limit    │   └─────────────────────────┘
│ approval       │
│ rollback       │
└─────┬──────────┘
      │
┌─────▼──────────────────────────────────────────────────┐
│                  Connector Layer                        │
│  Google Ads │ Meta │ DV360 │ TikTok │ Amazon           │
│  Read (sync) + Write (budget/pause/bid)                │
│  OAuth2 + Rate Limiting + Encrypted Credentials        │
└────────────────────────────────────────────────────────┘
      │
┌─────▼──────────┐
│   Persistence  │
│  PostgreSQL +  │
│  pgvector      │
│                │
│  Agent state   │
│  Decisions     │
│  Action log    │
│  Goals         │
│  Outcomes      │
│  Vector memory │
└────────────────┘
```

### Monorepo (12 packages)

```
openagency/
├── packages/
│   ├── types/          Shared TypeScript types (agent, decision, goal, connector, events)
│   ├── core/           Orchestration, LLM abstraction (Claude/DeepSeek/Ollama), file parser, billing
│   ├── schemas/        Zod schemas, JSON Schema, OpenAPI generation, dynamic skill registry
│   ├── auth/           JWT (jose), API keys (oa_live_/oa_test_), OAuth2 M2M, RBAC middleware
│   ├── events/         Event bus (InMemory + Redis), 37 event types, onAny() wildcard
│   ├── engines/        4 pure computation engines (29 skills)
│   ├── connectors/     6 platform connectors (read + write), safety pipeline, write registry
│   ├── memory/         PostgreSQL repositories (state, decisions, goals, vector memory, migrations)
│   └── agent/          OODA runtime, mesh coordinator, federation (A2A + MCP clients), goals
├── apps/
│   ├── api/            Hono API server (REST + MCP + A2A + SSE), 53 MCP tools, Docker-ready
│   ├── cli/            CLI tool (npx openagency)
│   └── web/            Vite 5 + React dashboard with Command Center
├── docker/             Docker Compose (API + PostgreSQL/pgvector + Redis)
└── .env.example        28 environment variables documented
```

### Key Design Principles

- **Engines are pure computation.** No I/O, no side effects, deterministic. They run identically in Node.js, browsers, and tests.
- **Agents are autonomous.** Each implements a full OODA loop with persistent memory, goal tracking, and a configurable rate floor.
- **Safety is non-negotiable.** Every platform write passes through 5 gates. Dry-run by default. Audit trail for every evaluation.
- **Events drive coordination.** Agents communicate through typed events, not direct calls. Mesh passes enriched context between stages.
- **LLM is the reasoning layer.** Engines compute. LLM interprets, plans, and decides. Supports Claude, DeepSeek, and Ollama.
- **Protocols are open.** MCP for tool invocation. A2A for agent discovery. REST for everything else. Federation for cross-instance collaboration.
- **Structured logging.** pino-based logging throughout OODA runtime, mesh, safety, connectors, and API middleware.

---

## Billing Model

OpenAgency charges based on **value delivered**, not seats or usage. Three fee streams, each tiered by total ad spend:

| Stream | Rate | Source |
|--------|------|--------|
| **Recovery Fee** | 3-5% | Waste eliminated across all 4 engines |
| **Lift Fee** | 10-20% | ROAS/ROI improvement, media-driven sales |
| **Efficiency Fee** | 5-10% | CPC/CPM/CTR improvements, viewability gains |

| Tier | Monthly Ad Spend | Recovery | Lift | Efficiency |
|------|-----------------|----------|------|------------|
| Starter | <$500K | 5% | 20% | 10% |
| Growth | $500K-$2M | 4.5% | 17% | 8.5% |
| Scale | $2M-$5M | 4% | 14% | 7% |
| Enterprise | >$5M | 3% | 10% | 5% |

---

## Development

```bash
git clone https://github.com/openagency/openagency.git
cd openagency

pnpm install
pnpm build        # Build all 12 packages
pnpm test         # Run 286 tests across 27 test files
pnpm typecheck    # Zero type errors

# API server
cd apps/api && pnpm dev    # http://localhost:3100

# Web dashboard
cd apps/web && pnpm dev    # http://localhost:5173

# CLI
node apps/cli/dist/index.js scan --demo
```

---

## Changelog

### v3.1.0 — Production Hardening
- **Structured Logging** — pino-based logging across OODA runtime, mesh coordinator, safety pipeline, action executor, write registry, API middleware
- **OODA Rate Floor** — `min_cycle_interval_ms` prevents runaway cycles (default 5s)
- **Credential Wiring** — credential store injected into OODA runtime, credentials populated from store during Act phase
- **Goal Intelligence** — GoalTracker + GoalDecomposer wired into runtime cycle, adjustPlan bug fixed (sub_tasks now persisted), auto-adjust on off-track goals
- **Safety Audit Trail** — recent_writes populated from action log, safety evaluations persisted as audit entries
- **Mesh Context Enrichment** — output_summary (anomaly counts, actions, reasoning) passed between pipeline stages
- **Federation** — A2A client (discover + invoke remote agents), MCP client registry (connect + call external tools), 8 REST routes, 6 MCP tools
- **Skill Marketplace** — DynamicSkillRegistry for runtime skill registration (local handlers + remote URLs), 4 REST routes, 3 MCP tools
- **DeepSeek LLM Support** — added as provider with auto-detection (priority: Anthropic > DeepSeek > OpenAI)
- **E2E Pipeline Tests** — full 4-engine pipeline with billing verification (8 tests)
- **Connector Mock Tests** — all 6 platform connectors tested without real APIs (58 tests)
- **286 tests** across 27 test files, 12 packages build clean

### v3.0.0 — Agent Mesh + Platform Data Ingestion
- **Mesh Coordinator** — multi-agent orchestration with sequential pipelines, timeout/skip/failure handling
- **Default Pipeline** — 4-stage full optimization (leak→media→campaign→executive)
- **Usage Metering** — per-run metering (stages, tokens, actions, outcomes)
- **SSE Streaming** — real-time event streaming via `/v1/events/stream`
- **File Upload** — CSV/Excel/PDF parsing with platform auto-detect
- **ConnectorInfra** — unified setup for 6 platforms with write registry, sync scheduler, event bridge
- **Command Center** — React dashboard with agent status, SSE feed, pipeline visualization
- **53 MCP tools** total (29 engine + 5 agent + 6 mesh + 6 connector + 6 federation + 1 upload)

### v2.0.0 — Autonomous Engine
- OODA runtime, goal-driven execution, safety pipeline, platform writes
- PostgreSQL persistence, vector memory, 22 agent events
- Agent + Goal REST APIs, MCP agent tools

### v1.0.0 — Agent Protocol Layer
- Hono API server, MCP endpoint, A2A discovery, auth system, event bus, Docker

### v0.3.0 — Platform API Connectors
- 6 OAuth2 connectors, encrypted credentials, rate limiting, scheduled sync

### v0.2.0 — Smart CSV & Visualization
- Smart CSV auto-detect, PDF export, IndexedDB, MMM charts

### v0.1.0 — Foundation
- 4 computation engines, 29 skills, CLI, web dashboard, multi-LLM support

---

## Roadmap

- [x] **v0.1.0** — 4 engines, 29 skills, CLI, web dashboard
- [x] **v0.2.0** — Smart CSV, PDF export, MMM charts
- [x] **v0.3.0** — 6 platform connectors, OAuth2, encrypted credentials
- [x] **v1.0.0** — API server, MCP, A2A, auth, events, Docker
- [x] **v2.0.0** — Autonomous agents, OODA loops, goals, safety pipeline, platform writes
- [x] **v3.0.0** — Multi-agent mesh, platform data ingestion, SSE streaming, Command Center
- [x] **v3.1.0** — Production hardening: logging, rate floor, goal wiring, safety audit, federation, marketplace
- [ ] **v4.0.0** — Rollback execution, agent self-evolution, cross-client benchmarking, billing UI

---

## Contributing

```bash
pnpm test           # All 286 tests must pass
pnpm run typecheck  # Zero type errors
pnpm build          # All 12 packages build
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
