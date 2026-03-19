# Next Session: 20/03/2026

## Session 18-19/03/2026 — Summary

### Completed (13 commits)

| Feature | Commits | Status |
|---------|---------|--------|
| Google Drive OAuth connector | `8936945` | LIVE |
| PDF + Word upload support | `2744418` | LIVE |
| Agency multi-advertiser connectors (2-level) | `e3701ca` | LIVE |
| RBAC role expansion (super_admin, agency_admin, account_manager, viewer) | `25be4f8` | LIVE |
| Connectors gated by admin role | `b21da08` | LIVE |
| MCP self-hosted spawn disabled on Railway | `f9e4337` | LIVE |
| Sub-accounts direct API (no connector registration needed) | `d42ebbe` | LIVE |
| Analyze toLocaleString crash fix + scorecard persistence | `33a2a1e` | LIVE |
| Transactional emails via Resend + React Email (5 templates) | `64731cb`, `90c8a1d`, `9edd43e`, `a041666` | LIVE |
| Demo request form → email to hello@polanyi.tech | pending deploy | READY |

### Architecture Changes

- **DB tables**: 011 (storage_connections), 012 (agency_connections), 013 (advertiser_scopes), 014 (role_expansion)
- **New package**: `@polanyi/email` — Resend + React Email (6 templates)
- **Agency model**: 2-level (master creds → advertiser selection) for all 6 DSPs
- **Roles**: super_admin → agency_admin → account_manager → viewer
- **Email notifications**: invite, welcome, pipeline completed, HFL decision, connector disconnected, demo request

### Known Issues

| Issue | Severity | Notes |
|-------|----------|-------|
| Scorecards not persisting to DB | Medium | `.catch()` now logs errors — need to verify after next pipeline run |
| `/v1/analyze` billing $0 | Low | Fixed gross_spend injection — verify after deploy |
| MCP self-hosted disabled | Expected | `SKIP_MCP_SPAWN=true` on Railway, not a bug |
| OneDrive OAuth | Deferred | Template ready, Microsoft OAuth app not created |

### Railway Env Vars (current)

```
DATABASE_URL, REDIS_URL, JWT_SECRET, ENCRYPTION_KEY
ANTHROPIC_API_KEY, VOYAGE_API_KEY
GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET, GOOGLE_DRIVE_REDIRECT_URI
RESEND_API_KEY, FROM_EMAIL, APP_URL, ADMIN_EMAIL
SKIP_MCP_SPAWN=true
```

---

## Next Session Priorities

### 1. Super Admin Dashboard (`/admin` — dedalo@polanyi.tech only)

**Backend** — `apps/api/src/routes/admin.ts` (NEW), gated with `requireRole('super_admin')`

| Endpoint | Returns |
|----------|---------|
| `GET /v1/admin/overview` | KPI aggregates: agencies, users, runs today, LLM cost MTD, outcome fees MTD, stale connectors |
| `GET /v1/admin/agencies` | Agency list with user_count, advertiser_count, runs, cost, connectors, status |
| `GET /v1/admin/agencies/:id` | Full detail: users[], advertiser_scopes[], connections[], run history[], billing |
| `GET /v1/admin/users` | All users with role, agency, status, last_login, total_runs |
| `GET /v1/admin/runs` | Pipeline runs with filters (agency, status, run_type, date range) |
| `GET /v1/admin/tokens` | LLM usage: by_agency[], by_model[], by_engine[], by_day[] (30d) |
| `GET /v1/admin/connectors` | All agency_connections with status, last_sync, advertiser_count |
| `POST /v1/admin/users/:id/deactivate` | Deactivate user |
| `POST /v1/admin/users/:id/reactivate` | Reactivate user |
| `DELETE /v1/admin/agencies/:id` | Hard delete + cascade |
| `POST /v1/admin/agencies/:id/impersonate` | Short-lived token (15-min TTL) scoped to agency |

**Frontend** — `apps/web/src/pages/SuperAdminDashboard.tsx` (NEW)

6 sections:
1. **Overview KPI bar** — 6 stat cards: Total Agencies, Total Users, Runs Today, LLM Cost MTD, Outcome Fees MTD, Stale Connectors
2. **Agencies table** — Agency · Admin · Users · Advertisers · Connectors · Last Run · Runs · Cost · Actions (View/Impersonate/Delete)
3. **Users table** — Name · Email · Role · Agency · Status · Last Login · Runs — filters by role/agency/status
4. **Pipeline Runs log** — Run ID · Agency · Advertiser · Type · Status · Started · Duration · Tokens · Cost · Fee — click → detail drawer
5. **Token & Cost monitor** — Line chart (daily tokens 30d, stacked by agency) + Bar chart (cost by model) + table breakdown
6. **Connectors health** — Agency · Platform · Type · Status · Last Sync · Advertisers — bulk "Trigger respawn on stale"

**Impersonate flow:**
- `POST /v1/admin/agencies/:id/impersonate` → `{ impersonate_token, expires_at }`
- Store admin token in sessionStorage, set impersonate as active
- Red banner: "Viewing as [Agency Name] — Exit impersonation"
- Exit → restore admin token, redirect to /admin

**Sidebar:** `/admin` link visible ONLY for `super_admin` role

**Additional considerations based on Plinth context:**
- LLM cost tracking: query `execution_log` table for token counts, map to per-model pricing (Claude Sonnet = $3/$15 per 1M input/output)
- Outcome fees: aggregate from `scorecards.billing.total_fee` per agency
- Connector health: cross-reference `agency_connections.status` + `mcp_connections.status`
- Run duration trends: useful for detecting LLM latency spikes
- Agency onboarding funnel: invited → accepted → first_connector → first_run → first_scorecard (conversion tracking)

### 2. Verify Email Delivery Chain
- [ ] Demo request form → email arrives at hello@polanyi.tech
- [ ] Pipeline completed → email arrives at ADMIN_EMAIL
- [ ] HFL decision → email arrives at ADMIN_EMAIL
- [ ] Santiago (santiago@cerebrosm.com) accepted invite + feedback

### 3. Connect First Real Ad Platform
- [ ] Google Ads MCC: real developer_token + client_id + client_secret + refresh_token
- [ ] Save via agency connector dialog → fetch customer IDs
- [ ] Select advertiser → sync → verify data in pipeline context
- [ ] OR Meta BM: real system_user_token + business_manager_id

### 4. Full Pipeline E2E with Real Data
- [ ] Upload real campaign data (CSV/Excel from client)
- [ ] Run pipeline with real connector data + batch data
- [ ] Verify scorecard persists to DB with billing
- [ ] Verify plan vs actual comparison works
- [ ] HFL approval → email notification

### 5. Scorecard Persistence Fix Verification
- [ ] Run pipeline → check `GET /v1/scorecard` returns data
- [ ] Check Railway logs for `[scorecard] DB save failed` errors
- [ ] If failing: debug the DB save (likely JSONB serialization issue)

### 6. Cross-Client Benchmarking (if time)
- New API: compare waste/lift across multiple clients
- New UI: benchmark dashboard
- Requires: at least 2 clients with pipeline runs

### 7. Onboarding Wizard (deferred)
- Step-by-step guided flow for new agencies
- Connect platform → upload data → run first pipeline → review scorecard

---

## Production Status

| Component | URL | Status |
|-----------|-----|--------|
| Backend | https://polanyi-plinth-production.up.railway.app | LIVE |
| Frontend | https://plinth.polanyi.tech | LIVE |
| DB | PostgreSQL on Railway | 14 tables (001-014) |
| Emails | Resend (polanyi.tech verified) | LIVE |
| Google Drive OAuth | Railway backend callback | LIVE |

## Stress Test Results (18/03/2026)

| Test | Result |
|------|--------|
| Agency connector CRUD (16 tests) | 16/16 PASS |
| Pipeline 4 engines 26 skills | PASS (130s) |
| HFL escalation + approval | PASS |
| Assistant auto-conversation | PASS |
| Upload CSV/PDF/Word | PASS |
| MCP spawn block | PASS (400 not 500) |
| Role gating (admin-only connectors) | PASS |
| Email delivery (invite) | PASS |
