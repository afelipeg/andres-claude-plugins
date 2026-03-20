# Next Session: 20/03/2026

## Session 19/03/2026 — Summary

### Delivered (12 commits, +14,554 lines)

| Commit | Feature | Status |
|--------|---------|--------|
| `77bb768` | Super Admin Dashboard (13 endpoints, 7 tabs, Highcharts) | LIVE |
| `d792b3d` | Quota System + Agency Dashboard (multi-tenant, run caps) | LIVE |
| `5a7c68e` | Security Hardening (bcrypt, global auth, CORS, dev key gate) | LIVE |
| `6ee7ed1` | Schema fixes + 10 delivery skills registered + MMM disclaimers | LIVE |
| `a5c3b0b` | HFL persistence + quota enforcement + RBAC | LIVE |
| `8e5b5fc` | Bayesian MMM + Cross-Engine Optimizer + LLM Failover | LIVE |
| `2c99f3c` | Agentic Assistant + Charts + Pipeline Queue + Code Splitting | LIVE |
| `94ca689` | Knowledge Base (R2 + RAG + file explorer + assistant integration) | LIVE |
| `8f9e835` | Fix agency_connections FK (migration 020) | LIVE |
| `1eb8ac6` | Fix Dockerfile (add packages/kb) | LIVE |
| `64ff170` | Fix KB frontend API URLs | LIVE |
| `7e4afcf` | Fix KB API response unwrapping | LIVE |

### AI Maturity Scorecard (post-session)

| Area | Before | After |
|------|--------|-------|
| MMM / Media Architect | 2.5/5 | 4/5 |
| Campaign Ops | 2.5/5 | 4/5 |
| LLM Infrastructure | 3/5 | 4/5 |
| AI Learning | 2/5 | 4/5 |
| Executive Bridge | 3.5/5 | 4/5 |
| Delivery Engine | 3/5 | 4/5 |
| OODA Runtime | 4/5 | 4.5/5 |
| Pipeline Intelligence | 3.5/5 | 4/5 |
| Security | —/5 | 4/5 |
| Frontend Performance | —/5 | 4/5 |
| **Overall** | **3.0/5** | **4.1/5** |

### Production Status

| Component | URL | Status |
|-----------|-----|--------|
| Backend | https://polanyi-plinth-production.up.railway.app | LIVE |
| Frontend | https://plinth.polanyi.tech | LIVE |
| DB | PostgreSQL on Railway | 20 tables (001-020) |
| R2 | Cloudflare R2 bucket | LIVE |
| Emails | Resend (polanyi.tech verified) | LIVE |
| KB | packages/kb (R2 + pgvector + Voyage AI) | LIVE |

### DB Migrations Active: 001-020

| Migration | What |
|-----------|------|
| 001-009 | Original schema (users, agents, engines, events, files, assistant, mesh, uploads) |
| 010 | MCP connections |
| 011 | Storage connections (Google Drive) |
| 012 | Agency connections (multi-advertiser) |
| 013 | Advertiser scopes |
| 014 | Role expansion (super_admin, agency_admin, account_manager, viewer) |
| 015 | Admin metrics (daily_metrics, federation_log) |
| 016 | Quotas (agencies, agency_quota_usage, user_assistant_usage, quota_requests) |
| 017 | Security hardening (agency_id on 9 tables, FKs, audit_log, GIN index) |
| 018 | HFL persistence (hfl_decisions) |
| 019 | Knowledge Base (kb_folders, kb_documents, kb_chunks + pgvector IVFFlat) |
| 020 | Fix agency_connections FK (data cleanup) |

### Railway Env Vars (current)

```
DATABASE_URL, REDIS_URL, JWT_SECRET, ENCRYPTION_KEY
ANTHROPIC_API_KEY, DEEPSEEK_API_KEY, VOYAGE_API_KEY
GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET, GOOGLE_DRIVE_REDIRECT_URI
RESEND_API_KEY, FROM_EMAIL, APP_URL, ADMIN_EMAIL
ADMIN_INITIAL_PASSWORD, NODE_ENV=production
R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
SKIP_MCP_SPAWN=true
```

---

## Next Session: Full Agentic Health / QA Smoke E2E Test

### Agent SOW: backend-architect

**Scope:** Backend API, Database, Auth, Integrations, HFL, Pipeline Orchestration

**Tests to run:**

1. **API Health Chain**
   - `/health`, `/ready` — uptime, engines, skills count
   - All 20 migrations applied, no errors in logs
   - DB connection pool healthy (10 connections, no leaks)

2. **Auth & RBAC E2E**
   - Login (bcrypt) — super_admin, agency_admin, account_manager, viewer
   - Global auth gate: unauthenticated requests → 401 on all /v1/* routes
   - Dev API key blocked in production
   - Password complexity enforced on accept-invite
   - Impersonation flow: token scoped to agency, audit logged
   - CORS: only plinth.polanyi.tech accepted (not wildcard)

3. **Quota System E2E**
   - Run pipeline → quota increments
   - Hit quota limit → 429 QUOTA_EXCEEDED
   - `/v1/analyze/file` enforces quota (was missing, now fixed)
   - MCP `mesh_execute_pipeline` enforces quota
   - Request extra runs → email to admin → approve → quota updated
   - Month reset simulation (verify non-accumulative)

4. **HFL Persistence E2E**
   - Run pipeline → HFL evaluates (single evaluation, no duplicate)
   - Decision persisted to hfl_decisions table
   - Approve/reject → status updated, resolved_by set
   - RBAC: cross-agency approve blocked (403)
   - Server restart → pending decisions survive

5. **Pipeline Queue**
   - `GET /v1/mesh/queue` → active=0, pending=0, concurrency=2
   - Run 3 pipelines simultaneously → 2 active, 1 queued
   - Queue drains correctly

6. **Redis Event Bus**
   - Events published and received (no silent drops)
   - XACK working (PEL not growing)
   - Consumer cleanup on stop

7. **Knowledge Base Backend**
   - Create folder → 201
   - List folders → tree structure with system folders
   - Upload document → R2 storage + db row + indexing enqueued
   - Download → presigned R2 URL
   - Delete document → R2 + db + chunks cascade
   - Delete folder → cascade all contents
   - `GET /v1/kb/stats` → correct counts
   - Auto-saver: pipeline complete → outputs saved to KB

8. **Multi-Tenancy**
   - agency_id on all tenant-scoped tables (9 tables from migration 017)
   - Agency A cannot access Agency B's data (scorecards, runs, KB, connectors)
   - FK constraints enforced (no orphan data)

9. **Database Integrity**
   - All 20 migrations idempotent (re-run safe)
   - FK constraints active on critical relationships
   - Audit log captures impersonation events
   - No orphaned records after delete operations

---

### Agent SOW: ai-engineer

**Scope:** AI Infrastructure, LLM, Engines, Skills, RAG, OODA, Learning

**Tests to run:**

1. **LLM Infrastructure**
   - Anthropic API call succeeds with retry (mock 429 → retry → success)
   - Failover: if Anthropic fails → DeepSeek activates (if DEEPSEEK_API_KEY set)
   - Response cache: identical prompts return cached response within TTL
   - Per-skill model tiers: fast=Haiku, standard=Sonnet confirmed in delivery skills
   - Token tracking: delivery skills report `token_usage` in output

2. **Engine Execution (all 39 skills)**
   - Leak Detector (5 skills): waste-waterfall, waste-estimate, waste-compare, supply-chain-audit, media-quality-score
     - Input validation: gross_spend > 0, campaigns array
     - Output: waste + productive = gross_spend (tolerance < $1)
     - Benchmark ranges by industry (automotive, FMCG, financial, retail, telecom)
   - Media Architect (9 skills): channel-optimize, channel-scenario, mmm-pre/model/post/optimize, benchmark-health, anomaly-detect, media-plan
     - MMM heuristic mode: runs with standard input
     - MMM Bayesian mode: auto-activates with 104+ weeks of weekly_kpi + weekly_spend
     - Hill curves: saturation at ec50, monotone increasing
     - Adstock: geometric decay, normalized
     - R-hat < 1.1, ESS > 100 (convergence diagnostics)
     - MAPE reported on Bayesian output
   - Campaign Ops (6 skills): campaign-create/update/summary/next-actions, optimization-analyze/reallocate
     - Cross-engine optimizer: uses Leak Detector + Media Architect signals
     - Priority score: mROI × quality × (1-waste) × (1-saturation)
     - 3 recommendation categories: quick_win, strategic_shift, growth_opportunity
     - Backward compatible: works without cross-engine signals
   - Executive Bridge (9 skills): shapley-attribute/compare, revenue-translate/compare, reconcile, integrity, geo-lift, conversion-lift, holdout
     - Shapley exact mode (< 12 channels)
     - Shapley approximation (12+ channels, random permutation sampling)
     - Power analysis: MDE, power, revenue at risk calculations
   - Delivery Engine (10 skills): monthly-report, competitive-analysis, industry-benchmarks, budget-proposal, campaign-brief, project-status, quarterly-review, media-plan-deck, learnings-digest, client-scorecard-export
     - LLM call with graceful fallback (file generated even without LLM)
     - Chart generation: bar, pie, line, stacked bar, waterfall
     - Multi-format: PDF, PPTX, DOCX, XLSX
     - Token tracking in output metadata

3. **OODA Runtime**
   - Observe → Orient → Decide → Act cycle complete
   - Orient uses semantic memory (pgvector) not just getRecent()
   - Outcome deltas injected into orient prompt (reinforcement learning)
   - Decision confidence gates: < 0.5 requires human approval
   - Safety pipeline: dry-run, budget cap, daily write limit, approval gate

4. **RAG Pipeline**
   - Chunker: 6 strategies (engine JSON, delivery doc, CSV, manifest, benchmark, chart metadata)
   - Embedder: Voyage AI voyage-3 (1024 dims, batch 128)
   - Indexer: Redis queue → chunk → embed → store
   - RAG search: cosine similarity on kb_chunks → top 8 results
   - RAG in assistant: KB context injected before every LLM call
   - kb_sources array in response (document_id, relevance, snippet)
   - Graceful: no KB → assistant works as before

5. **Agentic Assistant**
   - Intent classifier: optimize, analyze, report, compare, conversation
   - "Optimize Q3 for ROAS 4.5x with $2M" → auto-goal + pipeline execution
   - "Analyze my Google Ads waste" → leak-detector execution
   - "Generate a monthly report" → delivery engine call
   - "Compare Q1 vs Q2" → comparison with RAG context
   - `GET /v1/assistant/capabilities` → lists all capabilities
   - Existing conversation mode unbroken

6. **Cross-Client Benchmarks**
   - `GET /v1/benchmarks/channels` → anonymized channel performance
   - `GET /v1/benchmarks/waste` → waste rates by channel
   - `GET /v1/benchmarks/roas` → ROAS distributions (p10-p90)

7. **Time-Series Parser**
   - detectTimeSeries(): auto-detect date + KPI + spend columns
   - Daily → weekly aggregation with ISO week boundaries
   - `/v1/analyze/file` with 52+ weeks → Bayesian MMM auto-activates
   - Spanish column names supported (fecha, ventas, gasto)

---

### Agent SOW: frontend-developer

**Scope:** UI, Code Splitting, Pages, Components, UX

**Tests to run:**

1. **Code Splitting Verification**
   - Main bundle < 1,200KB (target: 1,137KB)
   - 22 lazy-loaded page chunks present in build output
   - Demo routes (`/demo/*`) eagerly loaded (no lazy)
   - Login page eagerly loaded
   - Each `/app/*` page loads its own chunk on navigation
   - Loading spinner appears during chunk load

2. **All Pages Load Without Error**
   Navigate to each route and verify no crash:
   - `/app/dashboard` — Dashboard
   - `/app/scorecard` — Scorecard
   - `/app/mesh` — Mesh / Pipeline Runs
   - `/app/connectors` — Connectors
   - `/app/agents` — Agents
   - `/app/goals` — Goals
   - `/app/campaigns` — Campaigns
   - `/app/assistant` — Agentic Assistant
   - `/app/admin` — Super Admin Dashboard (super_admin only)
   - `/app/agency-dashboard` — Agency Dashboard
   - `/app/kb` — Knowledge Base
   - `/app/settings` — Settings
   - `/app/settings/usage` — Usage & Limits

3. **Knowledge Base UI**
   - Folder tree renders (system folders with lock icon)
   - Create custom folder → appears in tree
   - Delete custom folder → removed from tree
   - System folders cannot be deleted (no delete button)
   - Upload file → appears in document list with "Pending" status
   - Document table: filename, type badge, size, status, chunks, date, actions
   - Download button → opens presigned URL
   - Delete document → removed from list
   - Search → results with relevance scores
   - Stats bar: documents, chunks, indexed %, storage

4. **Assistant + KB Sources**
   - Send message → response renders correctly
   - If KB sources used → "📚 N sources" pill appears
   - Click pill → drawer slides out from right
   - Drawer shows: filename, source type badge, date, relevance bar, snippet
   - Close drawer → slides back
   - No KB sources → no pill (graceful)

5. **Super Admin Dashboard**
   - 8 tabs render: Overview, Agencies, Users, Pipeline Runs, Token & Cost, Connectors, Federation, Quotas
   - KPI cards show data
   - Highcharts render (line, bar, donut)
   - Impersonate flow: red banner, exit restores admin
   - Quota requests tab: pending badge count

6. **Settings > Usage & Limits**
   - Brand count input + save
   - Progress bars: initial/optimization runs used
   - "Request additional runs" modal opens
   - Submit request → success toast

7. **Responsive / Visual QA**
   - Sidebar collapses on mobile
   - Tables scroll horizontally on small screens
   - No layout overflow or broken elements

---

## Execution Plan for 20/03/2026

### Phase 1: Automated smoke test (parallel agents)
- Launch `backend-architect` → API health chain + auth + quota + HFL + pipeline queue + KB backend + multi-tenancy
- Launch `ai-engineer` → LLM infra + all 39 skills + OODA + RAG + agentic assistant + benchmarks
- Launch `frontend-developer` → code splitting + all pages + KB UI + assistant sources + admin dashboard

### Phase 2: Fix any failures
- Each agent reports PASS/FAIL/WARN
- Fix FAILs immediately
- Triage WARNs

### Phase 3: Push + Deploy
- Commit fixes
- Push to main
- Railway deploy + Vercel auto-deploy
- Verify on production

### Phase 4: Document results
- Update session doc with test results
- Update MEMORY.md
- Plan next priorities
