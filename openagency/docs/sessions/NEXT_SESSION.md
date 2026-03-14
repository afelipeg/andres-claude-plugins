# NEXT_SESSION.md — OpenAgency / Plinth

**Date:** 2026-03-07
**Commit:** `a9b4db1` (main)
**State:** Bloque 1 complete (Delivery Engine, Scheduler, wire, tests). Bloque 2 pending.

---

## Current state

| Layer | Status |
|---|---|
| 4 optimization engines (39 skills) | ✅ Production |
| Delivery Engine (5th motor, 10 skills) | ✅ Wired, tested |
| Pipeline Scheduler (cron) | ✅ |
| Human Feedback Loop | ✅ wired to API |
| File storage (local + S3 abstraction) | ✅ |
| Web search cache (24h, Map/Redis) | ✅ |
| REST delivery routes | ✅ `/v1/engines/delivery/skills/:id`, `/v1/delivery/files` |
| MCP tools | ✅ 10 `delivery_*` + `delivery_list_files` (63 total) |
| `full-with-deliverables` pipeline | ✅ registered |
| Agent card v3.1.1 | ✅ delivery + scheduling capabilities |
| Web routing `/demo/*` + `/app/*` | ✅ App.tsx restructured |
| All typechecks | ✅ clean |
| Tests | ✅ 23/23 tasks, 333+ unit tests |

---

## Bloque 2 — E2E validation + deploy prep

### 2.1 E2E smoke test (local, no DB)

```bash
PORT=3100 pnpm --filter api dev

# Health
curl http://localhost:3100/health

# Delivery skill — graceful fallback (no API key needed)
curl -s -X POST http://localhost:3100/v1/engines/delivery/skills/monthly-report \
  -H "Content-Type: application/json" \
  -d '{"client_id":"test","run_id":"r01","layer_one_results":{},"period_start":"2026-02-01","period_end":"2026-02-28","output_formats":["pdf"]}' \
  | jq '{skill_id,summary,generated_at}'

# Both pipelines present
curl http://localhost:3100/v1/mesh/pipelines | jq '[.pipelines[].id]'

# Agent card has delivery + scheduling
curl http://localhost:3100/.well-known/agent.json | jq '.capabilities | keys'

# MCP: delivery_ tools present
curl -s -X POST http://localhost:3100/v1/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' \
  | jq '[.result.tools[] | select(.name | startswith("delivery")) | .name]'
```

### 2.2 Delivery skill with real LLM

```bash
# Requires ANTHROPIC_API_KEY. Tests XLSX+PDF dual-file output.
curl -s -X POST http://localhost:3100/v1/engines/delivery/skills/client-scorecard-export \
  -H "Content-Type: application/json" \
  -d '{
    "client_id":"plinth-demo","run_id":"r_demo_01",
    "layer_one_results":{
      "leak_detector":{"waste_total_usd":45000,"waste_pct":12},
      "media_architect":{"projected_lift_usd":28000},
      "campaign_ops":{"efficiency_savings_usd":12000}
    },
    "period_start":"2026-01-01","period_end":"2026-01-31",
    "output_formats":["xlsx","pdf"]
  }' | jq '{skill_id,summary,xlsx:.file.file_type,pdf:.additional_files[0].file_type}'
```

### 2.3 Docker compose smoke test

```bash
docker compose -f docker/docker-compose.yml up --build -d
# Wait 10s for postgres to initialize
# Run migrations (check apps/api/src/db/client.ts for runner logic)
# Migration order: 001 → 002 → 003 → 004_schedules → 005_files
curl http://localhost:3100/health
```

### 2.4 Web routing check

```bash
pnpm --filter @openagency/web dev
# / → redirects to /demo
# /demo → HomePage (investor demo room, in-browser engines)
# /demo/command-center → CommandCenterPage
# /app → same pages, will use VITE_API_URL if set
# 404 → redirect to /demo
```

---

## Bloque 2 continued — HFL / Delivery escalation gap

Currently the Delivery Engine runs independently of HFL. To close the loop:

1. When a skill's LLM call fails or returns low confidence (e.g. `overall_score < 40`
   in scorecard), the skill should emit `hfl.escalation_requested` via eventBus
2. In `_skill-utils.ts`, accept an optional `EventBus` param (passed from DeliveryEngine)
3. DeliveryEngine gets eventBus via constructor injection (already available in mesh stage)

This is optional for MVP but required for "full agentic loop" demo.

---

## Bloque 2 continued — deploy prep

### Environment variables

```env
# Required
DATABASE_URL=postgresql://...
ANTHROPIC_API_KEY=sk-ant-...
API_BASE_URL=https://api.plinth.polanyi.tech

# Delivery Engine — optional (graceful fallback if missing)
FILE_STORAGE_URL=s3://plinth-deliverables/prod  # omit = local /tmp
BRAVE_SEARCH_API_KEY=BSA...
META_ACCESS_TOKEN=EAA...
SERPAPI_KEY=...
REDIS_URL=redis://...                             # search cache (24h TTL)

# AWS (only if FILE_STORAGE_URL=s3://...)
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
```

### Fly.io deploy

```bash
fly secrets set ANTHROPIC_API_KEY=... DATABASE_URL=... API_BASE_URL=...
fly deploy    # uses docker/Dockerfile
curl https://api.plinth.polanyi.tech/health
```

### Vercel deploy (web)

```bash
cd apps/web
vercel --prod \
  -e VITE_API_URL=https://api.plinth.polanyi.tech \
  -e VITE_API_KEY=oa_prod_...
# /demo/* works without API key (in-browser engines)
# /app/* requires VITE_API_URL
```

---

## Architecture (v3.2.0)

```
OpenAgency v3.2.0
├── 5 engines
│   ├── leak-detector    (5 skills)
│   ├── media-architect  (9 skills)
│   ├── campaign-ops     (6 skills)
│   ├── executive-bridge (9 skills)
│   └── delivery         (10 skills → PPTX/PDF/DOCX/XLSX)
├── 2 pipelines
│   ├── full-optimization          (~6 min)
│   └── full-with-deliverables     (~11 min)
├── Infrastructure
│   ├── PipelineScheduler (cron)
│   ├── HFLCoordinator (human escalation)
│   ├── FileRepo (delivery_files, 90-day TTL)
│   ├── FileStorage (local + S3)
│   └── SearchCache (24h, Map/Redis)
├── API: REST + MCP (63 tools) + A2A
└── Web: /demo/* (investor) + /app/* (real backend)
```

---

## Key file locations

| What | Where |
|---|---|
| Delivery Engine | `packages/engines/src/delivery/` |
| File generators | `.../delivery/tools/file-generators/` |
| File storage | `.../delivery/tools/file-storage.ts` |
| Search cache | `.../delivery/tools/search-cache.ts` |
| Delivery routes | `apps/api/src/routes/delivery.ts` |
| FileRepo | `packages/memory/src/repositories/file-repo.ts` |
| Delivery pipeline | `packages/agent/src/mesh/delivery-pipeline.ts` |
| Agent card | `apps/api/src/a2a/agent-card.ts` |
| Web routing | `apps/web/src/App.tsx` |
| Migration 004 | `apps/api/src/db/migrations/004_schedules.sql` |
| Migration 005 | `apps/api/src/db/migrations/005_files.sql` |
