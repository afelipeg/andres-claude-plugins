# Next Session: 15/03/2026 — Real Platform Connect + Email Notifications

## Session Summary: 14/03/2026 (Complete)

### Commits (16 total this session)

| Commit | Description |
|---|---|
| `6251b35` | Folder organization + next_session_150326 |
| `95529e8` | Billing UI rates update (0.5-1.5%) |
| `5f4f851` | Rate selector + HFL UI wiring + pending decisions fix |
| `2b1e3bf` | Scorecard auto-creation from mesh pipeline |
| `5fb6377` | Session doc update + COGS breakdown |
| `c6cd6d5` | Self-service sprint: demo form, invite flow, onboarding wizard |
| `be016fc` | Email notification attempt (mailto) |
| `c7dd3ff` | Fix mailto iframe (still broken) |
| `fd0ae75` | Onboarding UX: dismissible banner, OAuth popup, MCP option |
| `ec08fa2` | Remove broken mailto, demo requests stored server-side only |

### What was built

| Category | Deliverable |
|---|---|
| **Billing** | Rates updated to 0.5-1.5%, rate selector dropdown, BILLING_TIERS fixed |
| **HFL UI** | Badges on runs, decision panel, pending decisions via /v1/hfl/pending |
| **Scorecard** | Auto-creates after pipeline run, populates /app/scorecard dynamically |
| **Self-service** | Request Demo form (CTA), Accept Invite page, Onboarding wizard (3 steps) |
| **Landing** | How It Works updated to self-service flow, Request Demo replaces mailto |
| **Admin** | Invite link with copy button, GET /v1/demo-requests for lead tracking |
| **Folder org** | docs/sessions/, docs/community/, docs/strategy/, prototypes/ |

### COGS per run
- 8 Claude API calls per pipeline run (~$0.08)
- 30 runs/month = ~$10/month total COGS
- Revenue per ACME-sized client: $172K/month

### Current prod state

| Item | Value |
|---|---|
| Backend | `https://polanyi-plinth-production.up.railway.app` |
| Frontend | `https://plinth.polanyi.tech` |
| Latest Railway deploy | `c6cd6d5` (self-service sprint) |
| Latest Vercel deploy | `ec08fa2` (auto-deploy) |
| Admin login | `dedalo@polanyi.tech` / `Morchis1512*` |
| Build | 13/13 packages pass |
| Tests | 333+ tests, all passing |

---

## Next Session Priorities

### 1. Email notification for demo requests
- Current: demo requests stored in backend only, no inbox notification
- Need: server-side email via Resend or SendGrid when demo form submitted
- Add `RESEND_API_KEY` to Railway env, wire into `POST /v1/demo-request`

### 2. Connect first real ad platform
- Set up OAuth credentials for Google Ads or Meta on Railway
- Test full flow: OAuth popup → token exchange → data sync → pipeline with real data
- Verify scorecard shows real recovery/lift values

### 3. Second pipeline run — auto-approve verification
- First run for `acme-cpg` always escalates (expected)
- Second run should auto-approve (HFL `first_run_for_client` flag clears)
- Note: in-memory state resets on Railway redeploy — second run test must happen without redeploy

### 4. SSE events verification
```bash
curl --max-time 60 https://polanyi-plinth-production.up.railway.app/v1/agents/events/stream \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: text/event-stream"
```

### 5. Onboarding flow E2E test
- Admin invites user from /app/settings/users
- New user opens /accept-invite?token=xxx → sets password
- Logs in → sees onboarding banner → connects platform → selects rates → runs pipeline

---

## Data Dictionary (confirmed)

All 6 platform connectors pull read-only data at campaign/ad_set/ad levels:

| Platform | API | Levels | Core Metrics |
|---|---|---|---|
| Google Ads | GAQL v17 | Campaign, Ad Group, Ad | spend, impressions, clicks, conversions, revenue + 12 extended |
| Meta | Graph API v21.0 | Campaign, Ad Set, Ad | + reach, frequency, video quartiles |
| DV360 | Reporting API v3 | IO, Line Item, Creative | + viewable_impressions, TrueView |
| TikTok Ads | Business API v1.3 | Campaign, Ad Group, Ad | + reach, frequency, video quartiles, engagement |
| Amazon Ads | Reporting API v3 | Campaign, Ad Group, Ad (SP/SB/SD) | + ACOS, DPV, new-to-brand |
| TikTok Shop | Orders API | Daily, Product | conversions, revenue, GMV (no ad spend) |

All normalize to `NormalizedCampaignRow` with: platform, date, campaign_id/name, ad_set_id/name, ad_id/name, spend, impressions, clicks, conversions, revenue, ctr, cpc, cpa, roas.

---

## Key technical context

```
Git root:     /Users/andresgutierrezhenao/Documents/claude-plugins/
Monorepo:     .../openagency/
PATH:         export PATH="/Users/andresgutierrezhenao/.nvm/versions/node/v20.19.5/bin:..."
Dev API key:  oa_test_dev_default_key_for_local_testing
API port:     3100
```

### User flows (production-ready)
1. Landing → Request Demo form → data stored server-side
2. Admin invites → copy link → prospect accepts invite → sets password
3. First login → onboarding banner → connect platforms → select rates → first run
4. Ongoing: Command Center → execute pipeline → HFL → scorecard → approve/reject
5. Billing: rate selector (0.5-1.5%), tier table, calculator

### Railway deploy checklist
- "Redeploy" = cached image (DOES NOT rebuild)
- "New Deploy from branch main" = full rebuild
- After deploy: check `/health` for uptime reset
