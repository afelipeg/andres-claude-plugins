# Session 23/03/2026 — Data Pipeline Validation + DV360 JWT + Airbyte Decision

## Commits (7 total across sessions 22-23/03)
- `b4014d2` — fix: dark theme for dialog modal + KB dropzone hover
- `11a3a59` — feat: credential-only mode for MCP marketplace on hosted environments
- `d889790` — feat: data ingestion pipeline — sync persistence, tenant isolation, weekly scheduler
- `0cb97f3` — feat: pipeline health check + E2E tests + sync scheduler + migration 021
- `c4fb414` — fix: health check table names + on-the-fly connector creation from DB creds
- `6743d75` — feat: Airbyte Agent MCP sidecar service (created but NOT deployed — skip for now)
- `05b55c0` — feat: DV360 service account JWT auth — no OAuth needed

## Key Decisions

### 1. Airbyte Agent Engine — Evaluated, Sidecar Skipped
- Researched `airbyte-agent-connectors` repo + Airbyte Agent Engine public beta
- Reference: https://airbyte.com/blog/agent-engine-public-beta
- MCP-native, Python packages, 7 ad platform connectors, no Docker
- **Problem**: static YAML config doesn't fit multi-tenant (each agency has their own creds)
- **Decision**: Skip sidecar deployment. Use existing on-the-fly connectors from DB credentials.
- **Revisit** when Airbyte Agent Engine supports dynamic per-tenant credential injection

### 2. Plinth Core = A2A Engines + HFL, NOT Connectors
- Connectors are commodity infrastructure — don't rebuild from scratch
- Engineering time goes to: engines (39 skills), HFL, NL assistant
- Exception: DV360 (no Airbyte alternative) — keep custom connector

### 3. Weekly Pre-fetch, Not Live Per Pipeline
- `PlatformSyncScheduler` syncs data weekly (Monday 3am UTC, configurable via `SYNC_CRON`)
- Data stored in `sync_results` table (PostgreSQL, survives redeploys)
- Engines read from cache — fast, reliable, quota-aware
- No live API calls during pipeline execution

### 4. Multi-Tenant Platform Vision (Next 6 Months)
Plinth is NOT a single-client tool for Cerebro. It's a multi-tenant platform:
1. Any agency signs up → gets their own tenant (`agency_id`)
2. Agency connects platforms via Connectors UI (credentials per-tenant, encrypted in DB)
3. Weekly automated sync pulls platform data per-tenant
4. Engines analyze each tenant's data independently (context assembler filters by `agency_id`)
5. HFL decisions, NL Assistant, billing — all per-tenant
6. Super Admin sees all tenants; agency admin sees only their own

## What Was Built

### Data Ingestion Pipeline (P0 fix)
- SyncResultCache key mismatch fixed: `${agencyId}:${platform}` with fallback
- Tenant-isolated context assembly via `agency_id` from JWT
- Migration 021: `sync_results` table for PostgreSQL persistence
- DB fallback on cold start: `assembleContextFromSyncWithDbFallback()`
- `PlatformSyncScheduler`: weekly cron, syncs all agencies
- Admin stale detection fixed
- `getOrCreateConnector()`: instantiates connectors on-the-fly from decrypted DB credentials (no env vars needed on Railway)

### Pipeline Health Check (`GET /v1/health/pipeline`)
- 6 stages: Infrastructure → Connectors → Context Assembly → Engines → HFL → Integration
- Admin-only, 60s timeout, 5-min cache
- Super Admin "Pipeline" tab with visual stage flow
- 25 E2E tests covering full pipeline

### DV360 Service Account JWT Auth
- Native Node.js `crypto` (RS256), zero dependencies
- `GoogleServiceAccountKey` type + `getServiceAccountToken()` utility
- Token cache with 5-min buffer before expiry
- DV360 connector accepts both OAuth2 and service_account configs
- `buildPlatformCredentials()` passes `service_account_json` through

### UI Fixes
- Dialog component: dark glassmorphism (`bg-[#0a0f1a]/95 backdrop-blur-xl`)
- KB DropZone: `hover:bg-white/10` (was `hover:bg-white`)
- MCP Marketplace: credential-only mode for self-hosted MCPs on Railway
- Connector cards: sync status, "Sync Now" button, freshness indicators
- Data page: ConnectedSourcesPanel with per-platform sync triggers

## Pipeline Validation Results (Prod)

| Platform | Pipeline | Blocker |
|----------|----------|---------|
| Google Ads | ✅ Reaches API, GAQL v23 | 401 OAuth token expired — need fresh `refresh_token` |
| Meta Ads | ✅ Connector creates OK | 0 advertisers — need `act_XXXXXXX` IDs |
| TikTok Ads | ✅ Connector creates OK | 0 advertisers — need advertiser IDs |
| DV360 | ✅ Service account JWT works | 0 advertisers — need to add from 98 discovered |

### Health Check Results (Prod)
- 30 passed, 6 warnings, 4 failures → **after fixes**: failures were config mismatches, not bugs
- Pipeline Integration: ✅ PASS (4/4 engines, billing, event bus)
- All 5 engines registered, 39 skills available

## DV360 Discovery — Cerebro (Partner 1332639: Cerebro_DBM_MXP)

98 active advertisers discovered via DV360 API v4:

| ID | Brand | ID | Brand |
|----|-------|----|-------|
| 1343035 | BF-GOODRICH | 1531731 | COCA COLA |
| 1345546 | JW BLUE | 1532040 | GENERAL MOTORS |
| 1350142 | ROYAL CARIBBEAN | 1538331 | CIEL |
| 1359433 | GM BUICK | 1544241 | NISSAN |
| 1376849 | CINEPOLIS | 1554788 | MERCEDES BENZ |
| 1382831 | SURA | 1560873 | GATORADE |
| 1383737 | MOVISTAR | 1585331 | NBA |
| 1395037 | NATURA | 1585837 | CHEDRAUI |
| 1398467 | TOYOTA | 1609837 | STARBUCKS |
| 1399132 | AMERICAN EAGLE | 1614541 | SPORT CITY |
| 1401076 | BODEGA AURRERA | 1614542 | SMART FIT |
| 1422040 | VOLKSWAGEN | 1654331 | BANCO DE MEXICO |
| 1424340 | DEL VALLE | 1659032 | FANTA |
| 1459531 | XBOX | 1665231 | MODELO |
| 1460285 | MASTERCARD | 1677031 | BANAMEX |
| 1466634 | SEGUROS MONTERREY | 1705134 | HSBC |
| 1498654 | MAZDA | 1726432 | SPRITE |
| 1498655 | AMEX | 1758438 | CORONA |
| 1501332 | 20TH CENTURY FOX | 1783857 | COMPARTAMOS BANCO |
| 1506542 | VICTORIAS SECRET | 1816440 | RENAULT |

+ 58 more (TOMMY HILFIGER, OLD NAVY, COACH, INFINITY, PRITT, VEET, AIR FRANCE, INFONAVIT, etc.)

## Brand Discovery UX (TODO — Next Session Priority #1)

After an agency connects platform credentials, Plinth must:
1. **Auto-discover brands/advertisers** from the platform API
2. **Show brand list in the connector card UI** with checkboxes/toggles
3. **User picks which brands to activate** for Plinth's engines
4. **Same brands must be selectable across all 4 platforms** — cross-platform matching
5. **Only selected brands sync weekly** — respects quotas
6. **Engines run cross-platform analysis** on those selected brands

```
Connect Google Ads → discovers: Coca Cola (ID: 123), Toyota (ID: 456), Nissan (ID: 789)
Connect Meta Ads  → discovers: Coca Cola (act_111), Toyota (act_222), Nissan (act_333)
Connect DV360     → discovers: COCA COLA (1531731), TOYOTA (1398467), NISSAN (1544241)
Connect TikTok    → discovers: coca_cola (adv_AAA), toyota_mx (adv_BBB)

User selects: [x] Coca Cola  [x] Toyota  [ ] Nissan
→ Sync pulls data for Coca Cola + Toyota across all 4 platforms
→ Engines analyze cross-platform performance for these 2 brands
```

## Next Session Priorities

1. **Brand Discovery UX** — auto-discover + UI checkboxes in connector cards
2. **DV360 connector → API v4** (v3 is sunset)
3. **Google Ads OAuth refresh** — Cerebro needs new `refresh_token`
4. **First real sync** — validate data flows all the way to engine output
5. **Airbyte Agent Engine** — monitor for multi-tenant support
6. **Cross-client benchmarking UI** dashboard
