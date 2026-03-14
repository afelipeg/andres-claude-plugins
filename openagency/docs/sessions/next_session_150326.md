# Next Session: 15/03/2026 — Second Run Auto-Approve + Scorecard UI + Client Pilot

## Session Summary: 14/03/2026

### Final Scorecard

| # | Task | Result |
|---|---|---|
| 0 | Railway redeploy | Admin role `admin` confirmed live |
| 1a | ACME pipeline run (`/v1/analyze`) | 4 engines ran in 150s, billing works |
| 1b | Billing: unwrap `.data` | Fixed (`apps/api/src/routes/analyze.ts`) |
| 1c | Billing: `l1_metrics` field name | Fixed (`packages/core/src/billing.ts`) |
| 1d | Billing: lift dedup (max not sum) | Fixed — ROAS/ROI/MDS take `Math.max()` |
| 1e | Client-selectable rates (0.5-1.5%) | Implemented, default 1% |
| 2a | HFL wiring into mesh | Auto-evaluates after every pipeline completion |
| 2b | HFL pending/approve/reject | Tested live, all working |
| 3 | Folder organization | Root decluttered → `docs/`, `prototypes/` |

### ACME CPG live numbers (confirmed)
- **Recovery**: $35,520 (4% of $888K waste)
- **Lift**: $136,940 (1% of $13.69M MDS)
- **Total fees**: $172,460 (7.2% of $2.4M spend)
- **HFL**: escalated (first run) → human approved with feedback
- 7 commits pushed, all deployed to Railway

### HFL end-to-end verified
1. Pipeline executed — 4 engines ran in 150s
2. HFL evaluated — escalated (first run for client `acme-cpg`)
3. `/v1/hfl/pending` returned the escalated decision with rendered markdown + action URLs
4. `/v1/mesh/runs/:id/approve` → status changed to `human_approved` with feedback

### What was fixed/built

#### Railway redeploy (auth regression)
- Root cause: Railway "Redeploy" reuses cached Docker image — it does NOT rebuild from latest commit
- Fix: used "New Deploy from branch main" → triggered full rebuild
- Confirmed: `/health` seed status + login returning `role: admin`

#### Billing model (3 bugs)
| Bug | Root cause | Fix |
|---|---|---|
| All billing zeros | `mapToEngineOutputs` stored full `EngineResult` wrapper instead of inner `.data` | Extract `.data` in `apps/api/src/routes/analyze.ts` |
| `l1_metrics` mismatch | `extractExecutiveBridgeLift()` looked for `l1_financial`, Executive Bridge outputs `l1_metrics` | Fallback: `revenueResult['l1_financial'] ?? revenueResult['l1_metrics']` |
| Lift fee 197% of spend | ROAS + ROI + MDS summed (same signal x3) | `Math.max(roasLift, roiLift, mdsValue)` |

#### Client-selectable rates
- `0.5% – 1.5%` range (default 1.0%) for Lift and Efficiency
- Recovery stays tiered (3-5% by spend tier, system-computed)
- `BillingInput` accepts `client_lift_rate?` and `client_efficiency_rate?`
- `clampRate()` enforces bounds

#### HFL wired into mesh
- `evaluateHFL()` called automatically after every completed pipeline run
- Force-escalate if pipeline quality score < 40
- First run for any client always escalates
- 70 billing tests passing

#### Folder organization
- Session docs → `docs/sessions/`, community → `docs/community/`, strategy → `docs/strategy/`, assets → `docs/assets/`, connector refs → `docs/connectors/`, landing prototype → `prototypes/landing-scorecard/`
- Monorepo untouched — full `turbo build` passes (13/13 packages)

---

## Current prod state

| Item | Value |
|---|---|
| Backend | `https://polanyi-plinth-production.up.railway.app` |
| Frontend | `https://plinth.polanyi.tech` |
| Admin login | `dedalo@polanyi.tech` / `Morchis1512*` |
| Admin role | `admin` ✅ |
| HFL status | Wired + tested live ✅ |

---

## Task 0: Confirm prod healthy (2 min)

```bash
curl https://polanyi-plinth-production.up.railway.app/health

curl -X POST https://polanyi-plinth-production.up.railway.app/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dedalo@polanyi.tech","password":"Morchis1512*"}'
# Expect: role: "admin"
```

---

## Task 1: Second pipeline run — auto-approve verification

The first run for `acme-cpg` was escalated (expected: `first_run_for_client`). A second run for the same client should auto-approve.

```bash
TOKEN="<jwt-from-login>"

curl -X POST https://polanyi-plinth-production.up.railway.app/v1/mesh/pipelines/full-optimization/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"client_id":"acme-cpg"}'
```

Expected: `hfl_decision.status = "auto_approved"`, `needs_human = false`.

---

## Task 2: Scorecard UI verification with real data

After pipeline runs, verify the scorecard page in `/app/scorecard` shows:
- Recovery: $35,520 (or similar based on run data)
- Lift: $136,940 (at 1% default rate)
- Total fees displayed correctly
- HFL decision status visible

If data isn't flowing to the UI, check:
1. Does `/v1/mesh/runs` return the ACME runs?
2. Does `/v1/mesh/runs/:id/recovery` return the breakdown?
3. Does the Scorecard page call these endpoints?

---

## Task 3: Billing rate selection UI

Backend supports it, UI doesn't yet.

### Where to add
- `apps/web/src/pages/app/Scorecard.tsx` (or new Settings/Billing page)
- Slider or dropdown: 0.5% / 0.75% / 1.0% / 1.25% / 1.5%
- Pass selected rate in pipeline execute body

### API contract
```json
POST /v1/mesh/pipelines/full-optimization/execute
{
  "client_id": "acme-cpg",
  "client_lift_rate": 0.01,
  "client_efficiency_rate": 0.01
}
```

---

## Task 4: SSE events stream verification

```bash
curl --max-time 60 https://polanyi-plinth-production.up.railway.app/v1/agents/events/stream \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: text/event-stream"
# Run a pipeline in another terminal → expect hfl.auto_approved or hfl.escalated events
```

---

## Task 5: First client pilot prep

If all above passes, the system is production-ready for a demo.

### Demo flow
1. Upload client ad data CSV (or use ACME CPG: $2.4M spend, 6 channels, 8 campaigns)
2. Run `full-optimization` pipeline
3. Show `/app/scorecard`: recovery + lift + efficiency fees
4. Client approves/rejects via HFL
5. SSE events fire in real time

### Connect first real ad platform (if credentials available)
- `/app/integrations` → connect Google Ads or Meta
- Sync real campaign data
- Run pipeline with real data

---

## Known bugs (non-blocking)

| Bug | File | Description | Priority |
|---|---|---|---|
| `listPendingDecisions` | `apps/web/src/api/agents.ts:63` | Calls `/v1/agents/decisions/pending` (doesn't exist). Never used in any page. | Low |
| Railway auto-deploy | `railway.toml` | watchPatterns may not trigger. Always use "New Deploy" from dashboard. | Low |

---

## Key technical context

```
Git root:     /Users/andresgutierrezhenao/Documents/claude-plugins/
Monorepo:     .../openagency/
PATH:         export PATH="/Users/andresgutierrezhenao/.nvm/versions/node/v20.19.5/bin:..."
Dev API key:  oa_test_dev_default_key_for_local_testing
API port:     3100
```

### Billing rate reference
| Fee stream | Rate | Who sets it |
|---|---|---|
| Recovery | 3-5% (tiered by spend) | System |
| Lift | 0.5-1.5% (default 1.0%) | Client |
| Efficiency | 0.5-1.5% (default 1.0%) | Client |

### HFL flow (confirmed working)
1. Pipeline completes → `evaluateHFL()` called automatically
2. `RiskScorer.evaluate()` → needs_human?
3. Pipeline score < 40 → force escalate
4. First run for client → always escalates
5. Auto-approved → event `hfl.auto_approved`
6. Escalated → rendered markdown + action URLs → human approves/rejects via REST

### Railway deploy checklist
- "Redeploy" = reuses cached image (DOES NOT rebuild)
- "New Deploy from branch main" = full rebuild ✅
- After deploy: check `/health` for uptime reset + seed status

---

## Session order

1. Health check → confirm prod live
2. Second run for `acme-cpg` → verify auto-approve
3. Scorecard UI with real data
4. Billing rate selection UI
5. SSE events stream
6. First client pilot / real ad platform connection
