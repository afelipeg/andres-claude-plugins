# Next Session: 15/03/2026 — Real Data Pipeline + COGS Tracking

## Session Summary: 14/03/2026 (Extended)

### Final Scorecard

| # | Task | Result |
|---|---|---|
| 0 | Railway redeploy | Admin role `admin` confirmed live |
| 1a | ACME pipeline run | 4 engines ran in 150s, billing works |
| 1b | Billing: unwrap `.data` | Fixed (`apps/api/src/routes/analyze.ts`) |
| 1c | Billing: `l1_metrics` field name | Fixed (`packages/core/src/billing.ts`) |
| 1d | Billing: lift dedup (max not sum) | Fixed — ROAS/ROI/MDS take `Math.max()` |
| 1e | Client-selectable rates (0.5-1.5%) | Implemented, default 1% |
| 2a | HFL wiring into mesh | Auto-evaluates after every pipeline completion |
| 2b | HFL pending/approve/reject | Tested live, all working |
| 3 | Folder organization | Root decluttered → `docs/`, `prototypes/` |
| 4 | Billing UI: tier table + rates | Updated to 0.5-1.5% (was 10-20%) |
| 5 | Billing UI: rate selector | Dropdown for Lift/Efficiency rate in calculator |
| 6 | HFL UI: badges + decision panel | Runs show HFL status, detail shows reason/feedback |
| 7 | Pending decisions: real endpoints | Rewired to `/v1/hfl/pending` + approve/reject |
| 8 | Scorecard auto-creation | Pipeline → scorecard auto-created → UI populates |
| 9 | Full E2E test (no real data) | Mesh + HFL + Scorecard all reflecting in UI |

### Commits pushed (11 total)
| Commit | Description |
|---|---|
| `6ac647c` | (prior) next_session_100326 |
| `6251b35` | Folder organization + next_session_150326 |
| `95529e8` | Billing UI rates update (0.5-1.5%) |
| `5f4f851` | Rate selector + HFL UI wiring + pending decisions fix |
| `2b1e3bf` | Scorecard auto-creation from mesh pipeline |

### ACME CPG live numbers (confirmed)
- **Recovery**: $35,520 (4% of $888K waste)
- **Lift**: $136,940 (1% of $13.69M MDS)
- **Total fees**: $172,460 (7.2% of $2.4M spend)
- **HFL**: escalated (first run) → human approved

---

## Cost Per Pipeline Run (COGS for P&L)

### LLM calls per run

Each pipeline run triggers 4 engines. Each engine runs 1 OODA cycle with 2 LLM calls:
- **Orient** (1 call): analyzes observations, produces orientation
- **Decide** (1 call): plans actions from orientation

| Component | LLM Calls | Model | Est. Tokens (in+out) |
|---|---|---|---|
| Leak Detector (orient+decide) | 2 | claude-sonnet-4 | ~3K + ~1K |
| Media Architect (orient+decide) | 2 | claude-sonnet-4 | ~3K + ~1K |
| Campaign Ops (orient+decide) | 2 | claude-sonnet-4 | ~3K + ~1K |
| Executive Bridge (orient+decide) | 2 | claude-sonnet-4 | ~3K + ~1K |
| **Total per run** | **8** | | **~16K tokens** |

### Delivery engine (if `full-with-deliverables` pipeline)
- Adds 1 more engine with LLM calls for report generation
- Each delivery skill (PDF, PPTX, etc.) may call LLM once for content

### Cost estimate per run

| Provider | Model | Input/1M tokens | Output/1M tokens | Est. cost/run |
|---|---|---|---|---|
| Anthropic | claude-sonnet-4 | $3.00 | $15.00 | **~$0.06 - $0.10** |
| DeepSeek | deepseek-chat | $0.14 | $0.28 | **~$0.005** |
| Ollama | llama3 (local) | $0 | $0 | **$0** |

### Other infra costs per run
| Item | Cost |
|---|---|
| Railway compute (~150s CPU) | ~$0.001 |
| PostgreSQL (state writes) | negligible |
| Redis (events) | negligible |
| Voyage AI embeddings (if enabled) | ~$0.01 per 1K docs |

### COGS summary
| Scenario | Cost/run | Monthly (100 runs) | Monthly (1000 runs) |
|---|---|---|---|
| Claude Sonnet (production) | ~$0.08 | ~$8 | ~$80 |
| DeepSeek (budget) | ~$0.005 | ~$0.50 | ~$5 |
| Ollama (self-hosted) | ~$0 | ~$0 | ~$0 |

**Note**: These are per-pipeline-run costs. No LLM calls happen for the billing calculation, HFL evaluation, or scorecard creation — those are pure compute.

---

## Current prod state

| Item | Value |
|---|---|
| Backend | `https://polanyi-plinth-production.up.railway.app` |
| Frontend | `https://plinth.polanyi.tech` |
| Admin login | `dedalo@polanyi.tech` / `Morchis1512*` |
| Admin role | `admin` ✅ |
| HFL status | Wired + tested live ✅ |
| Scorecard auto-create | Wired ✅ |
| Billing rates | 0.5-1.5% selectable ✅ |
| Latest deploy | `2b1e3bf` |

---

## Task 0: Confirm prod healthy

```bash
curl https://polanyi-plinth-production.up.railway.app/health
```

---

## Task 1: Second pipeline run — auto-approve verification

First run for `acme-cpg` escalated. Second should auto-approve.

```bash
TOKEN="<jwt-from-login>"

curl -X POST https://polanyi-plinth-production.up.railway.app/v1/mesh/pipelines/full-optimization/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"client_id":"acme-cpg"}'
```

Expected: `hfl_decision.status = "auto_approved"` + `scorecard` in response.

---

## Task 2: Connect first real ad platform

If Google Ads or Meta credentials available:
1. `/app/integrations` → connect platform
2. Sync real campaign data
3. Run pipeline with real data
4. Verify scorecard shows real recovery/lift values

---

## Task 3: SSE events stream verification

```bash
curl --max-time 60 https://polanyi-plinth-production.up.railway.app/v1/agents/events/stream \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: text/event-stream"
# Run pipeline in another terminal → expect hfl.auto_approved or hfl.escalated events
```

---

## Task 4: COGS tracking implementation (optional)

To track actual LLM costs per run:
1. The `UsageMeter` in `packages/agent/src/mesh/usage-meter.ts` already tracks `llm_tokens_used`
2. Add cost calculation: `(prompt_tokens / 1M * input_rate) + (completion_tokens / 1M * output_rate)`
3. Store in `MeshRun.usage` and expose via `/v1/mesh/runs/:id`
4. Show in Consumption page (`/app/consumption`)

---

## Known bugs (non-blocking)

| Bug | Description | Priority |
|---|---|---|
| Railway auto-deploy | watchPatterns may not trigger. Always use "New Deploy" from dashboard. | Low |

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

### Full pipeline flow (confirmed working)
1. Command Center → "Execute Full Pipeline"
2. 4 engines run OODA cycle (8 LLM calls total)
3. `evaluateHFL()` auto-evaluates risk → escalate or auto-approve
4. `createScorecardFromMeshRun()` auto-creates scorecard
5. `/app/scorecard` shows billing cards dynamically
6. Human approves/rejects via HFL decision queue
7. SSE events fire for each step

### Railway deploy checklist
- "Redeploy" = reuses cached image (DOES NOT rebuild)
- "New Deploy from branch main" = full rebuild ✅
- After deploy: check `/health` for uptime reset

---

## Session order

1. Health check → confirm prod live
2. Second run for `acme-cpg` → verify auto-approve + scorecard
3. Connect real ad platform (if credentials available)
4. SSE events verification
5. COGS tracking (optional)
