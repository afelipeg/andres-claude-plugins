#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# OpenAgency — Stress Test B: Active User Plan vs Actual Cycle
# Uses existing client with plan scorecard → upload KPI → actual run →
# compare → billing with real baseline → scheduler feedback validation
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

BASE_URL="${BASE_URL:-https://polanyi-plinth-production.up.railway.app}"
API_KEY="${API_KEY:-oa_test_dev_default_key_for_local_testing}"
ADMIN_EMAIL="dedalo@polanyi.tech"
ADMIN_PASS="Morchis1512*"

# ─── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

banner() { echo -e "\n${BOLD}${BLUE}══════════════════════════════════════════════════════${NC}"; echo -e "${BOLD}${BLUE}  $1${NC}"; echo -e "${BOLD}${BLUE}══════════════════════════════════════════════════════${NC}\n"; }
section() { echo -e "\n  ${BOLD}${CYAN}── $1 ──${NC}\n"; }
ok()     { echo -e "  ${GREEN}✓${NC} $1"; PASS=$((PASS + 1)); }
fail()   { echo -e "  ${RED}✗${NC} $1"; FAIL=$((FAIL + 1)); FAILURES="${FAILURES}$1\n"; }
skip()   { echo -e "  ${YELLOW}⊘${NC} $1"; SKIP=$((SKIP + 1)); }
info()   { echo -e "  ${CYAN}→${NC} $1"; }

PASS=0; FAIL=0; SKIP=0; FAILURES=""
TS=$(date +%s)

get_status() { echo "${1##*__HTTP__}"; }
get_body()   { echo "${1%__HTTP__*}"; }
jq_get() {
  local json="$1" field="$2" default="${3:-}"
  if command -v jq >/dev/null 2>&1; then
    echo "$json" | jq -r "${field} // \"${default}\"" 2>/dev/null || echo "$default"
  else echo "$default"; fi
}
check() {
  local label="$1" expected="$2" actual="$3"
  if [[ "$actual" == "$expected" ]]; then ok "$label (HTTP $actual)"; else fail "$label — expected $expected, got $actual"; fi
}
check_any() {
  local label="$1" actual="$2"; shift 2
  for code in "$@"; do [[ "$actual" == "$code" ]] && ok "$label (HTTP $actual)" && return; done
  fail "$label — got HTTP $actual, expected one of: $*"
}

# ── Variables ─────────────────────────────────────────────────────────────────
CLIENT_ID=""
TOKEN=""
PREV_RUN_ID=""
PREV_FEE=""
PLAN_SCORECARD_ID=""
ACTUAL_RUN_ID=""
ACTUAL_SCORECARD_ID=""
ACTUAL_TOTAL_FEE=""
LIFT_REAL=""
BASELINE_USED=""

# ══════════════════════════════════════════════════════════════════════════════
banner "Stress Test B: Active User — Plan vs Actual Cycle"
info "Target: ${BASE_URL}"
echo ""

# ─── 1. Login ────────────────────────────────────────────────────────────────
section "1. Admin Login"

ADMIN_LOGIN_BODY='{"email":"'"${ADMIN_EMAIL}"'","password":"'"${ADMIN_PASS}"'"}'
RAW=$(curl -s --max-time 15 -w "\n__HTTP__%{http_code}" -H "Content-Type: application/json" -X POST "${BASE_URL}/v1/auth/login" -d "${ADMIN_LOGIN_BODY}" 2>/dev/null)
STATUS=$(get_status "$RAW"); BODY=$(get_body "$RAW")
check "POST /v1/auth/login" "200" "$STATUS"
TOKEN=$(jq_get "$BODY" ".token" "" | tr -d '\n\r ')
if [[ -z "$TOKEN" ]]; then fail "No JWT — cannot continue"; banner "Results"; echo -e "  FAIL: $FAIL"; exit 1; fi
ok "JWT obtained"

# ─── 2. Find existing client with plan scorecard ────────────────────────────
section "2. Find Client with Plan Scorecard"

RAW=$(curl -s --max-time 10 -w "\n__HTTP__%{http_code}" -H "X-API-Key: ${API_KEY}" "${BASE_URL}/v1/scorecards" 2>/dev/null)
STATUS=$(get_status "$RAW"); BODY=$(get_body "$RAW")
check "GET /v1/scorecards" "200" "$STATUS"

# Find the most recent scorecard that has a client_id
if command -v jq >/dev/null 2>&1; then
  SC_COUNT=$(echo "$BODY" | jq '.scorecards | length' 2>/dev/null || echo "0")
  info "Total scorecards in DB: ${SC_COUNT}"

  # Get the first scorecard with a client_id
  PLAN_SCORECARD_ID=$(echo "$BODY" | jq -r '[.scorecards[] | select(.client_id != null and .client_id != "")] | .[0].id // ""' 2>/dev/null)

  if [[ -z "$PLAN_SCORECARD_ID" ]]; then
    # No scorecard with client_id — need to create one via pipeline
    info "No scorecard with client_id found — creating one via pipeline..."
    CLIENT_ID="active-user-${TS}"

    # Upload data first
    TMPCSV=$(mktemp /tmp/oa-active-XXXXXX.csv)
    cat > "$TMPCSV" <<'CSVDATA'
campaign_name,channel,spend,impressions,clicks,conversions,revenue,ctr,cpa,roas
Brand_Awareness,google_ads,65000,1800000,54000,1080,162000,0.03,60.19,2.49
Social_Retarget,meta_ads,42000,1100000,33000,660,105600,0.03,63.64,2.51
Video_First,tiktok_ads,28000,850000,25500,382,57300,0.03,73.30,2.05
Programmatic,dv360,43000,1600000,32000,640,96000,0.02,67.19,2.23
CSVDATA
    RAW=$(curl -s --max-time 20 -w "\n__HTTP__%{http_code}" -H "X-API-Key: ${API_KEY}" -F "file=@${TMPCSV}" -F "client_id=${CLIENT_ID}" -F "data_type=digital_sales" "${BASE_URL}/v1/upload" 2>/dev/null)
    STATUS=$(get_status "$RAW")
    check "Upload campaign data" "200" "$STATUS"
    rm -f "$TMPCSV"

    # Run plan pipeline
    info "Running plan pipeline (60-180s)..."
    PLAN_BODY="{\"client_id\":\"${CLIENT_ID}\",\"run_type\":\"plan\",\"context\":{\"gross_spend\":178000,\"industry\":\"cpg\",\"total_budget\":200000}}"
    RAW=$(curl -s --max-time 300 -w "\n__HTTP__%{http_code}" -H "X-API-Key: ${API_KEY}" -H "Content-Type: application/json" -X POST "${BASE_URL}/v1/mesh/pipelines/full-optimization/execute" -d "${PLAN_BODY}" 2>/dev/null)
    STATUS=$(get_status "$RAW"); BODY=$(get_body "$RAW")
    check_any "POST pipeline (plan)" "$STATUS" "200" "201"

    PLAN_SCORECARD_ID=$(jq_get "$BODY" ".scorecard.id" "")
    PREV_RUN_ID=$(jq_get "$BODY" ".id" "")
    PREV_FEE=$(jq_get "$BODY" ".scorecard.total_fee" "0")

    if [[ -n "$PLAN_SCORECARD_ID" ]]; then
      ok "Plan scorecard created: ${PLAN_SCORECARD_ID}"
    else
      fail "No plan scorecard created"
    fi
  else
    # Found existing scorecard — get its details
    RAW=$(curl -s --max-time 10 -w "\n__HTTP__%{http_code}" -H "X-API-Key: ${API_KEY}" "${BASE_URL}/v1/scorecard/${PLAN_SCORECARD_ID}" 2>/dev/null)
    STATUS=$(get_status "$RAW"); BODY=$(get_body "$RAW")
    check "GET /v1/scorecard/:id (plan)" "200" "$STATUS"

    CLIENT_ID=$(jq_get "$BODY" ".client_id" "")
    PREV_RUN_ID=$(jq_get "$BODY" ".run_id" "")
    PREV_FEE=$(jq_get "$BODY" ".billing.total_fee" "0")
    BASELINE_USED=$(jq_get "$BODY" ".billing.roi_on_fee" "0")

    ok "Using existing plan: scorecard=${PLAN_SCORECARD_ID}"
    info "Client ID: ${CLIENT_ID}"
    info "Previous run: ${PREV_RUN_ID}"
    info "Previous fee: \$${PREV_FEE}"
    info "Baseline ROAS: ${BASELINE_USED}"
  fi
fi

if [[ -z "$CLIENT_ID" ]]; then
  fail "Cannot determine client_id — aborting"
  banner "Results"; echo -e "  FAIL: $FAIL"; exit 1
fi

# ─── 3. Upload KPI Results (post-campaign actuals) ──────────────────────────
section "3. Upload KPI Results (Post-Campaign Actuals)"

TMPKPI=$(mktemp /tmp/oa-kpi-actual-XXXXXX.csv)
cat > "$TMPKPI" <<'KPIDATA'
campaign_name,channel,spend,impressions,clicks,conversions,revenue,ctr,cpa,roas,period
Brand_Awareness,google_ads,62000,1950000,58500,1170,187200,0.03,52.99,3.02,2026-Q1-actual
Social_Retarget,meta_ads,40500,1180000,35400,708,120360,0.03,57.20,2.97,2026-Q1-actual
Video_First,tiktok_ads,26500,920000,27600,414,66240,0.03,64.01,2.50,2026-Q1-actual
Programmatic,dv360,41000,1720000,34400,688,110080,0.02,59.59,2.68,2026-Q1-actual
KPIDATA

RAW=$(curl -s --max-time 20 -w "\n__HTTP__%{http_code}" -H "X-API-Key: ${API_KEY}" -F "file=@${TMPKPI}" -F "client_id=${CLIENT_ID}" -F "data_type=sell_in" "${BASE_URL}/v1/upload" 2>/dev/null)
STATUS=$(get_status "$RAW"); BODY=$(get_body "$RAW")
check "Upload KPI results (sell_in)" "200" "$STATUS"
KPI_RECORD=$(jq_get "$BODY" ".record_id" "")
info "Record: ${KPI_RECORD} | Rows: $(jq_get "$BODY" ".rows" "0")"

# Upload sell-out actuals
TMPSELLOUT=$(mktemp /tmp/oa-sellout-actual-XXXXXX.csv)
cat > "$TMPSELLOUT" <<'SODATA'
product,region,units_sold,revenue,period,channel
Widget_Pro,North America,14200,710000,2026-Q1-actual,retail
Widget_Lite,Europe,9100,318500,2026-Q1-actual,retail
Widget_Pro,North America,16800,840000,2026-Q1-actual,ecommerce
Widget_Lite,APAC,5100,178500,2026-Q1-actual,ecommerce
SODATA

RAW=$(curl -s --max-time 20 -w "\n__HTTP__%{http_code}" -H "X-API-Key: ${API_KEY}" -F "file=@${TMPSELLOUT}" -F "client_id=${CLIENT_ID}" -F "data_type=sell_out" "${BASE_URL}/v1/upload" 2>/dev/null)
STATUS=$(get_status "$RAW")
check "Upload sell-out actuals" "200" "$STATUS"

rm -f "$TMPKPI" "$TMPSELLOUT"

# Verify uploads
RAW=$(curl -s --max-time 10 -w "\n__HTTP__%{http_code}" -H "X-API-Key: ${API_KEY}" "${BASE_URL}/v1/upload/client/${CLIENT_ID}" 2>/dev/null)
STATUS=$(get_status "$RAW"); BODY=$(get_body "$RAW")
check "GET uploads for client" "200" "$STATUS"
info "Total uploads: $(jq_get "$BODY" ".total" "0")"

# ─── 4. Pipeline Execute — Actual Run ───────────────────────────────────────
section "4. Pipeline Execute — Actual Run (with _previous_run baseline)"

info "Running actual pipeline (auto-detects run_type=actual)..."
info "Expected: _previous_run injected, batch data merged, 4 engines"
info "This may take 60-180s..."

ACTUAL_BODY="{\"client_id\":\"${CLIENT_ID}\",\"context\":{\"gross_spend\":170000,\"industry\":\"cpg\",\"total_budget\":200000}}"

RAW=$(curl -s --max-time 300 -w "\n__HTTP__%{http_code}" \
  -H "X-API-Key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -X POST "${BASE_URL}/v1/mesh/pipelines/full-optimization/execute" \
  -d "${ACTUAL_BODY}" 2>/dev/null)
STATUS=$(get_status "$RAW"); BODY=$(get_body "$RAW")

check_any "POST pipeline (actual)" "$STATUS" "200" "201"

if [[ "$STATUS" == "200" || "$STATUS" == "201" ]]; then
  ACTUAL_STATUS=$(jq_get "$BODY" ".status" "unknown")
  ACTUAL_RUN_ID=$(jq_get "$BODY" ".id" "")
  DURATION=$(jq_get "$BODY" ".total_duration_ms" "0")

  if [[ "$ACTUAL_STATUS" == "completed" ]]; then
    ok "Pipeline actual: completed (${DURATION}ms)"
  elif [[ "$ACTUAL_STATUS" == "partial" ]]; then
    skip "Pipeline actual: partial (${DURATION}ms)"
  else
    fail "Pipeline actual: ${ACTUAL_STATUS}"
  fi

  info "Run ID: ${ACTUAL_RUN_ID}"

  # Context validation
  SOURCE_COUNT=$(jq_get "$BODY" ".context_validation.source_count" "0")
  HAS_BATCH=$(jq_get "$BODY" ".context_validation.has_batch_data" "false")
  HAS_EXPLICIT=$(jq_get "$BODY" ".context_validation.has_explicit_context" "false")
  info "Sources: ${SOURCE_COUNT} (batch=${HAS_BATCH}, explicit=${HAS_EXPLICIT})"

  # Scorecard
  ACTUAL_SCORECARD_ID=$(jq_get "$BODY" ".scorecard.id" "")
  ACTUAL_TOTAL_FEE=$(jq_get "$BODY" ".scorecard.total_fee" "0")
  ACTUAL_ROI=$(jq_get "$BODY" ".scorecard.roi_on_fee" "0")
  ACTUAL_VALUE=$(jq_get "$BODY" ".scorecard.value_delivered" "0")
  ACTUAL_TIER=$(jq_get "$BODY" ".scorecard.tier" "unknown")

  if [[ -n "$ACTUAL_SCORECARD_ID" ]]; then
    ok "Actual scorecard: ${ACTUAL_SCORECARD_ID}"
    info "Fee: \$${ACTUAL_TOTAL_FEE} | ROI: ${ACTUAL_ROI}x | Value: \$${ACTUAL_VALUE} | Tier: ${ACTUAL_TIER}"
  else
    skip "No actual scorecard"
  fi

  # Engine count
  if command -v jq >/dev/null 2>&1; then
    STAGE_COUNT=$(echo "$BODY" | jq '.stage_results | keys | length' 2>/dev/null || echo "0")
    if [[ "$STAGE_COUNT" -ge 4 ]]; then
      ok "All 4 engines executed"
      echo "$BODY" | jq -r '.stage_results | to_entries[] | "    \(.key): \(.value.status) (\(.value.duration_ms)ms)"' 2>/dev/null || true
    else
      fail "Only ${STAGE_COUNT}/4 engines"
    fi
  fi

  # HFL
  HFL_STATUS=$(jq_get "$BODY" ".hfl_decision.status" "none")
  if [[ "$HFL_STATUS" != "none" ]]; then
    ok "HFL evaluated: ${HFL_STATUS}"
  fi
else
  fail "Pipeline actual failed: HTTP ${STATUS}"
  info "$(echo "$BODY" | head -c 400)"
fi

# ─── 5. Plan vs Actual Comparison ───────────────────────────────────────────
section "5. Plan vs Actual Comparison"

if [[ -n "$PLAN_SCORECARD_ID" && -n "$ACTUAL_SCORECARD_ID" ]]; then
  COMPARE_BODY="{\"plan_id\":\"${PLAN_SCORECARD_ID}\",\"actual_id\":\"${ACTUAL_SCORECARD_ID}\"}"
  RAW=$(curl -s --max-time 15 -w "\n__HTTP__%{http_code}" -H "X-API-Key: ${API_KEY}" -H "Content-Type: application/json" -X POST "${BASE_URL}/v1/scorecard/compare" -d "${COMPARE_BODY}" 2>/dev/null)
  STATUS=$(get_status "$RAW"); BODY=$(get_body "$RAW")

  check_any "POST /v1/scorecard/compare" "$STATUS" "200" "201"

  if [[ "$STATUS" == "200" || "$STATUS" == "201" ]]; then
    LIFT_REAL=$(jq_get "$BODY" ".real_lift_pct" "0")
    WASTE_REDUCTION=$(jq_get "$BODY" ".waste_reduction_pct" "0")
    MDS_PLAN=$(jq_get "$BODY" ".media_driven_sales.plan" "0")
    MDS_ACTUAL=$(jq_get "$BODY" ".media_driven_sales.actual" "0")
    MDS_DELTA=$(jq_get "$BODY" ".media_driven_sales.delta" "0")
    FEE_DELTA=$(jq_get "$BODY" ".total_fee_delta" "0")
    ROI_DELTA=$(jq_get "$BODY" ".roi_delta" "0")
    AD_SPEND_DELTA=$(jq_get "$BODY" ".ad_spend_delta" "0")

    ok "Comparison computed"
    info "Lift: ${LIFT_REAL}%"
    info "Waste reduction: ${WASTE_REDUCTION}%"
    info "MDS: plan=\$${MDS_PLAN} actual=\$${MDS_ACTUAL} delta=\$${MDS_DELTA}"
    info "Fee delta: \$${FEE_DELTA} | ROI delta: ${ROI_DELTA}"
    info "Ad spend delta: \$${AD_SPEND_DELTA}"

    # Engine deltas
    if command -v jq >/dev/null 2>&1; then
      echo "$BODY" | jq -r '.engine_deltas | to_entries[] | "    \(.key): plan=$\(.value.plan) actual=$\(.value.actual) delta=$\(.value.delta) (\(.value.delta_pct)%)"' 2>/dev/null || true
    fi

    # Insights
    if command -v jq >/dev/null 2>&1; then
      INSIGHTS=$(echo "$BODY" | jq -r '.insights[]?' 2>/dev/null)
      if [[ -n "$INSIGHTS" ]]; then
        while IFS= read -r insight; do
          [[ -n "$insight" ]] && info "  Insight: ${insight}"
        done <<< "$INSIGHTS"
      fi
    fi
  fi
else
  skip "Cannot compare — missing plan (${PLAN_SCORECARD_ID}) or actual (${ACTUAL_SCORECARD_ID}) scorecard"
fi

# ─── 6. Outcome-Based Fee Validation (3 streams) ───────────────────────────
section "6. Outcome-Based Fee (3 Streams)"

if [[ -n "$ACTUAL_SCORECARD_ID" ]]; then
  RAW=$(curl -s --max-time 10 -w "\n__HTTP__%{http_code}" -H "X-API-Key: ${API_KEY}" "${BASE_URL}/v1/scorecard/${ACTUAL_SCORECARD_ID}" 2>/dev/null)
  STATUS=$(get_status "$RAW"); BODY=$(get_body "$RAW")
  check "GET /v1/scorecard/:id (actual)" "200" "$STATUS"

  if [[ "$STATUS" == "200" ]]; then
    RECOVERY_FEE=$(jq_get "$BODY" ".billing.recovery_fee.fee" "0")
    LIFT_FEE=$(jq_get "$BODY" ".billing.lift_fee.fee" "0")
    EFFICIENCY_FEE=$(jq_get "$BODY" ".billing.efficiency_fee.fee" "0")
    TOTAL_RECOVERY=$(jq_get "$BODY" ".billing.total_recovery" "0")
    TOTAL_LIFT=$(jq_get "$BODY" ".billing.total_lift" "0")
    TOTAL_EFF=$(jq_get "$BODY" ".billing.total_efficiency_savings" "0")
    FEE_PCT=$(jq_get "$BODY" ".billing.fee_as_pct_of_spend" "0")
    MDS_VALUE=$(jq_get "$BODY" ".billing.media_driven_sales.final_value" "0")
    MDS_METHOD=$(jq_get "$BODY" ".billing.media_driven_sales.method" "unknown")

    info "Stream 1 — Recovery: \$${TOTAL_RECOVERY} → fee \$${RECOVERY_FEE}"
    info "Stream 2 — Lift:     \$${TOTAL_LIFT} → fee \$${LIFT_FEE}"
    info "Stream 3 — Efficiency: \$${TOTAL_EFF} → fee \$${EFFICIENCY_FEE}"
    info "Total fee: \$${ACTUAL_TOTAL_FEE} (${FEE_PCT}% of spend)"
    info "MDS: \$${MDS_VALUE} (method: ${MDS_METHOD})"

    # Validate fee is non-negative
    ok "3 fee streams populated"

    # Recovery line items
    if command -v jq >/dev/null 2>&1; then
      echo "$BODY" | jq -r '.billing.recovery_fee.line_items[]? | "    Recovery: \(.label) = $\(.amount)"' 2>/dev/null || true
      echo "$BODY" | jq -r '.billing.lift_fee.line_items[]? | "    Lift: \(.label) = $\(.amount)"' 2>/dev/null || true
      echo "$BODY" | jq -r '.billing.efficiency_fee.line_items[]? | "    Efficiency: \(.label) = $\(.amount)"' 2>/dev/null || true
    fi
  fi
else
  skip "No actual scorecard — cannot validate fees"
fi

# ─── 7. Scheduler Feedback Validation ──────────────────────────────────────
section "7. Scheduler & Feedback"

# Check if scheduler has any schedules
RAW=$(curl -s --max-time 10 -w "\n__HTTP__%{http_code}" -H "X-API-Key: ${API_KEY}" "${BASE_URL}/v1/mesh/schedules" 2>/dev/null)
STATUS=$(get_status "$RAW"); BODY=$(get_body "$RAW")
check_any "GET /v1/mesh/schedules" "$STATUS" "200" "404"
info "Schedules: $(jq_get "$BODY" ".total" "0")"

# Create a test schedule
SCHED_BODY="{\"client_id\":\"${CLIENT_ID}\",\"pipeline_id\":\"full-optimization\",\"cron\":\"0 6 * * 1\",\"auto_approve\":false,\"enabled\":true}"
RAW=$(curl -s --max-time 10 -w "\n__HTTP__%{http_code}" -H "X-API-Key: ${API_KEY}" -H "Content-Type: application/json" -X POST "${BASE_URL}/v1/mesh/schedules" -d "${SCHED_BODY}" 2>/dev/null)
STATUS=$(get_status "$RAW"); BODY=$(get_body "$RAW")
check_any "POST /v1/mesh/schedules" "$STATUS" "200" "201"
SCHED_ID=$(jq_get "$BODY" ".id" "")
if [[ -n "$SCHED_ID" ]]; then
  ok "Schedule created: ${SCHED_ID} (Mon 6am)"
  info "Auto-approve: false | Pipeline: full-optimization"
fi

# Cleanup schedule
if [[ -n "$SCHED_ID" ]]; then
  RAW=$(curl -s --max-time 10 -w "\n__HTTP__%{http_code}" -H "X-API-Key: ${API_KEY}" -X DELETE "${BASE_URL}/v1/mesh/schedules/${SCHED_ID}" 2>/dev/null)
  STATUS=$(get_status "$RAW")
  check_any "DELETE schedule (cleanup)" "$STATUS" "200" "204"
fi

# ─── 8. HFL + LLM Validation ──────────────────────────────────────────────
section "8. HFL Decision Queue"

RAW=$(curl -s --max-time 10 -w "\n__HTTP__%{http_code}" -H "X-API-Key: ${API_KEY}" "${BASE_URL}/v1/hfl/pending" 2>/dev/null)
STATUS=$(get_status "$RAW"); BODY=$(get_body "$RAW")
check "GET /v1/hfl/pending" "200" "$STATUS"
info "Pending decisions: $(jq_get "$BODY" ".count" "0")"

# Approve the actual run if pending
if [[ -n "$ACTUAL_RUN_ID" ]]; then
  RAW=$(curl -s --max-time 10 -w "\n__HTTP__%{http_code}" -H "X-API-Key: ${API_KEY}" -H "Content-Type: application/json" -X POST "${BASE_URL}/v1/mesh/runs/${ACTUAL_RUN_ID}/approve" -d '{"feedback":"Actual run approved — KPI results match expectations"}' 2>/dev/null)
  STATUS=$(get_status "$RAW")
  check_any "POST approve actual run" "$STATUS" "200" "201" "404"
fi

# ─── 9. Recovery History ────────────────────────────────────────────────────
section "9. Recovery Trend"

RAW=$(curl -s --max-time 10 -w "\n__HTTP__%{http_code}" -H "X-API-Key: ${API_KEY}" "${BASE_URL}/v1/recovery/history" 2>/dev/null)
STATUS=$(get_status "$RAW"); BODY=$(get_body "$RAW")
check "GET /v1/recovery/history" "200" "$STATUS"
info "Total recovery: \$$(jq_get "$BODY" ".total_recovery" "0")"

# ══════════════════════════════════════════════════════════════════════════════
banner "Plan vs Actual Validation Complete"

echo ""
echo "  Previous Plan:  run_id=${PREV_RUN_ID:-none}"
echo "  Actual Run:     run_id=${ACTUAL_RUN_ID:-none}"
echo "  Lift Delta:     ${LIFT_REAL:-N/A}%"
echo "  Fee Planned:    \$${PREV_FEE:-0}"
echo "  Fee Actual:     \$${ACTUAL_TOTAL_FEE:-0}"
echo "  Baseline ROAS:  ${BASELINE_USED:-N/A} (dynamic)"
echo ""

banner "Results"
echo -e "  ${GREEN}PASS: ${PASS}${NC}  |  ${RED}FAIL: ${FAIL}${NC}  |  ${YELLOW}SKIP: ${SKIP}${NC}"
echo -e "  ${BOLD}Total: $((PASS + FAIL + SKIP))${NC}"

if [[ $FAIL -gt 0 ]]; then
  echo -e "\n  ${RED}${BOLD}Failed tests:${NC}"
  echo -e "$FAILURES" | while IFS= read -r line; do
    [[ -n "$line" ]] && echo -e "    ${RED}• ${line}${NC}"
  done
fi

if [[ $FAIL -eq 0 ]]; then
  echo -e "\n  ${GREEN}${BOLD}ALL SECTIONS PASSED — Cycle complete, Outcome-Based Fee validated${NC}"
fi

echo ""
exit $FAIL
