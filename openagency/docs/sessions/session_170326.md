# Session: 17/03/2026 — MCP Marketplace + Attribution Cycle + Gap Closure

## Session Summary

### Commits (8 total this session)

| Commit | Description |
|---|---|
| `490d4fd` | feat: /vision page, sidebar reorg, OAuth connectors, batch upload |
| `83f719a` | fix: vision page matches landing design + integrations restructure |
| `4826245` | fix: integrations .slice() crash + defensive error rendering |
| `74f2741` | fix: add JWT Bearer token to all API clients — fixes 401 errors |
| `6899e5a` | feat: MCP Marketplace — catalog, connections, process manager |
| `016f6f4` | feat: close PARTIAL gaps — MCP injection + plan vs actual cycle |
| `228e4dc` | feat: attribution cycle — column mapping, plan snapshot, comparison, feedback |

### What was built

| Category | Deliverable |
|---|---|
| **Vision Page** | Cinematic `/vision` with Framer Motion scroll animations, matching landing design (Inter, #09090B, #00e5a0 accent) |
| **Sidebar Reorg** | Grouped submenus: Command Center > Scorecard, A2A Engines (6), Integrations > Connectors + Marketplace + Data |
| **OAuth Flow** | Real OAuth popup via getAuthUrl/openOAuthPopup/exchangeOAuthCode with API key fallback on 404/401 |
| **MCP Marketplace** | 5-platform catalog (Google Ads, Meta, TikTok, Amazon, DV360), connection dialog with dynamic auth fields, process manager, DB persistence |
| **Migration 010** | `mcp_connections` table with encrypted auth tokens, process PID tracking, stale detection |
| **Encryption** | AES-256-GCM utils for credential storage. Railway env: `ENCRYPTION_KEY` |
| **MCP Injection** | `mergeMcpData()` in context-assembler — engines receive live MCP data in skillContext |
| **Plan vs Actual** | Auto run_type detection (first=plan, subsequent=actual), `POST /v1/scorecard/compare` with lift/waste/MDS deltas |
| **Column Mapping** | Wizard UI with 15 standard metrics, opens after kpi_results/budget_plan upload, persists to DB |
| **Scheduler Feedback** | contextBuilder callback assembles sync + batch + MCP + baseline + feedback string for scheduled runs |
| **Auth Fix** | JWT Bearer token added to ALL API clients (connectors, agency, scorecard, agents) — was the root cause of 401 errors |
| **Dockerfile** | Python/pipx added for self-hosted MCP server processes |

---

## E2E Diagnostic (17/03/2026)

### Summary: ALL PASS

| Layer | Status | Details |
|---|---|---|
| **Frontend** | PASS | 36 pages, 9 API clients, 10 UI components, all auth headers verified |
| **Backend Routes** | PASS | 25 route modules, 236+ endpoints, error/auth middleware |
| **Database** | PASS | 10 migrations (001-010), all tables active |
| **Packages** | PASS | 11 packages, all built clean |
| **Auth** | PASS | JWT + API keys + RBAC + M2M OAuth2, admin seeded |
| **Engines & Skills** | PASS | 5 engines, 33+ skills in registry |
| **Connectors** | PASS | 8 platforms (6 ads + 2 storage), OAuth2, credential store |
| **MCP** | PASS | Server (63 tools) + Client + Marketplace (5 catalog) + Process Manager |
| **HFL** | PASS | Coordinator + risk scorer + auto-escalation + assistant slash commands |
| **Mesh & Scheduler** | PASS | Multi-agent orchestration, cron scheduler with context builder |
| **Billing** | PASS | 3 fee streams, 4 tiers, scorecard comparison endpoint |

### Product Flow Status (vs User's Ideal)

| # | Flow Step | Status |
|---|---|---|
| 1 | User registers | PASS |
| 2 | Connects platforms (API/MCP) | PASS — Marketplace + Connectors + OAuth |
| 3 | Batch upload | PASS — DataPage + Column Mapping wizard |
| 4 | 5 engines + 39 skills execute | PASS — MCP data injection via context |
| 5 | 4 specialized agents | PASS |
| 6 | Assistant notifies human | PASS — slash commands + DecisionQueue UI |
| 7 | HFL approval gate | PASS — auto-approve/escalate/human-approve |
| 8 | A2A Mesh execution | PASS — with HFL gate post-pipeline |
| 9 | User returns with KPIs | PASS — DataPage accepts kpi_results |
| 10 | Batch results cycle | PASS — structured data types + column mapping |
| 11 | Plan vs actual comparison | PASS — auto plan snapshot + comparison endpoint |
| 12 | Lift / MDS / Waste | PASS — billing + Shapley attribution + triangulation |
| 13 | Outcome-based fee | PASS — 3 fee streams, tiered |
| 14 | Continuous cycle | PASS — scheduler with feedback loop |

---

## Current Prod State

| Item | Value |
|---|---|
| Backend | `https://polanyi-plinth-production.up.railway.app` |
| Frontend | `https://plinth.polanyi.tech` |
| Latest commit | `228e4dc` |
| Railway deploy | `228e4dc` (needs "New Deploy") |
| Admin login | `dedalo@polanyi.tech` / `Morchis1512*` |
| Build | 13/13 packages pass |
| Skills | 33+ (29 analysis + 10 delivery) |
| Engines | 5 |
| Pipelines | 2 (full-optimization, full-with-deliverables) |
| DB tables | 001-010 (010 = mcp_connections) |
| Connectors | 6 ad platforms + 2 storage |
| MCP Catalog | 5 platforms (Google Ads, Meta, TikTok, Amazon, DV360) |
| Encryption | AES-256-GCM, `ENCRYPTION_KEY` on Railway |

---

## Remaining from next_session_160326.md

| # | Task | Status |
|---|---|---|
| 1 | /vision page | DONE |
| 2 | Menu reorg + Integrations | DONE |
| 3 | Email notifications (Resend) | PENDING — deferred |
| 4 | Connect first real ad platform | PENDING — needs real OAuth credentials on Google/Meta developer accounts |
| 5 | Human batch upload E2E | DONE |
| 6 | Google Drive / OneDrive env vars on Railway | PENDING — needs GOOGLE_DRIVE_CLIENT_ID/SECRET |
| 7 | Cross-client benchmarking | PENDING — new API + UI |

---

## Next Session Priorities

### 1. Stress Test: Full Attribution Cycle
Run the complete product loop end-to-end:
```
Connect (MCP or API key) → Pipeline Execute (run_type: plan)
→ HFL Approval → User uploads KPI results
→ Pipeline Execute (run_type: actual) → Compare plan vs actual
→ Verify billing deltas, lift %, waste reduction %
→ Scheduled run with feedback context
```

**Test script**: `stress-test-attribution-cycle.sh`
- [ ] Create client via API
- [ ] Connect a platform (API key or MCP)
- [ ] Execute pipeline → verify run_type auto-detects as 'plan'
- [ ] Upload KPI results file
- [ ] Execute second pipeline → verify run_type = 'actual' + _previous_run injected
- [ ] POST /v1/scorecard/compare → verify lift_pct, waste_reduction, MDS delta
- [ ] Create schedule → verify contextBuilder injects feedback
- [ ] 81/81 infra tests still pass

### 2. Email Notifications (Resend)
- Wire server-side email for:
  - Demo requests
  - HFL escalations (urgent decisions)
  - Pipeline completion with scorecard summary
  - User invites
- Add `RESEND_API_KEY` to Railway env

### 3. Connect First Real Ad Platform
- Set up Google Ads or Meta OAuth credentials on a developer account
- Configure on Railway:
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_ADS_DEVELOPER_TOKEN`
  - OR `META_APP_ID`, `META_APP_SECRET`
- Test: OAuth popup → token exchange → data sync → pipeline with real platform data
- Verify context assembler produces real channels from syncResultCache

### 4. Google Drive / OneDrive Env Vars
- `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET`
- `ONEDRIVE_CLIENT_ID`, `ONEDRIVE_CLIENT_SECRET`
- Test: `/v1/storage/google_drive/auth-url` → callback → files → import

### 5. Cross-Client Benchmarking
- Compare waste/lift/efficiency across multiple client scorecards
- Aggregate pipeline run data by client for industry benchmarks
- New endpoint: `GET /v1/benchmarks?industry=retail`

### 6. MCP Process Auto-Restart
- After Railway redeploy, stale MCP connections need manual reconnect
- Add startup routine that detects stale connections and re-spawns processes
- Health check interval (every 5 min) to validate MCP server availability

---

## Key Technical Context

```
Git root:     /Users/andresgutierrezhenao/Documents/claude-plugins/
Monorepo:     .../openagency/
PATH:         export PATH="/Users/andresgutierrezhenao/.nvm/versions/node/v20.19.5/bin:..."
Dev API key:  oa_test_dev_default_key_for_local_testing
API port:     3100
ENCRYPTION_KEY: 4054c66891a954d4cd64816083ea055ac24749b35d42171571d33effacb59644
```

### Railway Deploy Checklist
- "Redeploy" = cached image (DOES NOT rebuild)
- "New Deploy from branch main" = full rebuild
- After deploy: check `/health` for uptime reset
- Verify `GET /v1/mcp/catalog` returns 5 entries
