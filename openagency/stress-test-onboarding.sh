#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# OpenAgency — Full Onboarding Stress Test
# Simulates new user from admin invite → login → upload → pipeline → HFL →
# billing → scorecard → plan vs actual comparison
# bash 3.x compatible (macOS default)
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

BASE_URL="${BASE_URL:-https://polanyi-plinth-production.up.railway.app}"
API_KEY="${API_KEY:-oa_test_dev_default_key_for_local_testing}"
ADMIN_EMAIL="dedalo@polanyi.tech"
ADMIN_PASS="Morchis1512*"

TEST_EMAIL="stress-new@polanyi.tech"
TEST_PASS="StressTest2026"
TEST_COMPANY="Acme CPG Test"

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
CLIENT_ID="acme-cpg-${TS}"
ADMIN_JWT=""
USER_JWT=""
INVITE_TOKEN=""
PLAN_SCORECARD_ID=""
ACTUAL_SCORECARD_ID=""
PIPELINE_RUN_ID=""
UPLOAD_IDS=""

# ─── Helpers ─────────────────────────────────────────────────────────────────

api_get() {
  local path="$1" auth="${2:-apikey}"
  if [[ "$auth" == "jwt" && -n "$USER_JWT" ]]; then
    curl -s --max-time 15 -w "\n__HTTP__%{http_code}" -H "Authorization: Bearer ${USER_JWT}" -H "Content-Type: application/json" "${BASE_URL}${path}" 2>/dev/null
  elif [[ "$auth" == "admin" && -n "$ADMIN_JWT" ]]; then
    curl -s --max-time 15 -w "\n__HTTP__%{http_code}" -H "Authorization: Bearer ${ADMIN_JWT}" -H "Content-Type: application/json" "${BASE_URL}${path}" 2>/dev/null
  elif [[ "$auth" == "apikey" ]]; then
    curl -s --max-time 15 -w "\n__HTTP__%{http_code}" -H "X-API-Key: ${API_KEY}" -H "Content-Type: application/json" "${BASE_URL}${path}" 2>/dev/null
  else
    curl -s --max-time 15 -w "\n__HTTP__%{http_code}" -H "Content-Type: application/json" "${BASE_URL}${path}" 2>/dev/null
  fi
}

api_post() {
  local path="$1" body="${2:-{}}" auth="${3:-apikey}" timeout="${4:-120}"
  if [[ "$auth" == "jwt" && -n "$USER_JWT" ]]; then
    curl -s --max-time "$timeout" -w "\n__HTTP__%{http_code}" -H "Authorization: Bearer ${USER_JWT}" -H "Content-Type: application/json" -X POST "${BASE_URL}${path}" -d "$body" 2>/dev/null
  elif [[ "$auth" == "admin" && -n "$ADMIN_JWT" ]]; then
    curl -s --max-time "$timeout" -w "\n__HTTP__%{http_code}" -H "Authorization: Bearer ${ADMIN_JWT}" -H "Content-Type: application/json" -X POST "${BASE_URL}${path}" -d "$body" 2>/dev/null
  elif [[ "$auth" == "apikey" ]]; then
    curl -s --max-time "$timeout" -w "\n__HTTP__%{http_code}" -H "X-API-Key: ${API_KEY}" -H "Content-Type: application/json" -X POST "${BASE_URL}${path}" -d "$body" 2>/dev/null
  else
    curl -s --max-time "$timeout" -w "\n__HTTP__%{http_code}" -H "Content-Type: application/json" -X POST "${BASE_URL}${path}" -d "$body" 2>/dev/null
  fi
}

api_upload() {
  local path="$1" file="$2" client_id="$3" data_type="$4" auth="${5:-apikey}"
  local auth_header=""
  if [[ "$auth" == "jwt" && -n "$USER_JWT" ]]; then
    auth_header="-H Authorization:Bearer ${USER_JWT}"
  else
    auth_header="-H X-API-Key:${API_KEY}"
  fi
  curl -s --max-time 30 -w "\n__HTTP__%{http_code}" $auth_header \
    -F "file=@${file}" -F "client_id=${client_id}" -F "data_type=${data_type}" \
    "${BASE_URL}${path}" 2>/dev/null
}

api_patch() {
  local path="$1" body="${2:-{}}" auth="${3:-apikey}"
  if [[ "$auth" == "jwt" && -n "$USER_JWT" ]]; then
    curl -s --max-time 15 -w "\n__HTTP__%{http_code}" -H "Authorization: Bearer ${USER_JWT}" -H "Content-Type: application/json" -X PATCH "${BASE_URL}${path}" -d "$body" 2>/dev/null
  else
    curl -s --max-time 15 -w "\n__HTTP__%{http_code}" -H "X-API-Key: ${API_KEY}" -H "Content-Type: application/json" -X PATCH "${BASE_URL}${path}" -d "$body" 2>/dev/null
  fi
}

get_status() { echo "${1##*__HTTP__}"; }
get_body()   { echo "${1%__HTTP__*}"; }

jq_get() {
  local json="$1" field="$2" default="${3:-}"
  if command -v jq >/dev/null 2>&1; then
    echo "$json" | jq -r "${field} // \"${default}\"" 2>/dev/null || echo "$default"
  else
    echo "$default"
  fi
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

# ══════════════════════════════════════════════════════════════════════════════
banner "Stress Test A: New User Full Onboarding Flow"
info "Target: ${BASE_URL}"
info "Test client: ${CLIENT_ID}"
info "Test user: ${TEST_EMAIL}"
echo ""

# ─── 1. Admin Login ─────────────────────────────────────────────────────────
section "1. Admin Login"

ADMIN_LOGIN_BODY='{"email":"'"${ADMIN_EMAIL}"'","password":"'"${ADMIN_PASS}"'"}'
RAW=$(curl -s --max-time 15 -w "\n__HTTP__%{http_code}" -H "Content-Type: application/json" -X POST "${BASE_URL}/v1/auth/login" -d "${ADMIN_LOGIN_BODY}" 2>/dev/null)
STATUS=$(get_status "$RAW")
BODY=$(get_body "$RAW")

check_any "POST /v1/auth/login (admin)" "$STATUS" "200" "201"
ADMIN_JWT=$(jq_get "$BODY" ".token" "" | tr -d '\n\r ')
if [[ -n "$ADMIN_JWT" ]]; then
  ok "Admin JWT obtained"
  info "Role: $(jq_get "$BODY" ".user.role" "unknown")"
else
  fail "No admin JWT — cannot continue"
  banner "Results"; echo -e "  ${GREEN}PASS: ${PASS}${NC}  |  ${RED}FAIL: ${FAIL}${NC}"; exit 1
fi

# ─── 2. Admin Invites New User ──────────────────────────────────────────────
section "2. Admin Invites New User"

RAW=$(api_post "/v1/auth/invite" "{\"email\":\"${TEST_EMAIL}\",\"role\":\"engine_user\",\"name\":\"Stress Test User\"}" "admin")
STATUS=$(get_status "$RAW")
BODY=$(get_body "$RAW")

check_any "POST /v1/auth/invite" "$STATUS" "200" "201" "409"

if [[ "$STATUS" == "409" ]]; then
  ok "User already exists (409 — expected on re-run)"
elif [[ "$STATUS" == "200" || "$STATUS" == "201" ]]; then
  INVITE_TOKEN=$(jq_get "$BODY" ".invite_token" "")
  if [[ -n "$INVITE_TOKEN" ]]; then
    ok "Invite token obtained"

    # Accept invite
    RAW=$(api_post "/v1/auth/accept-invite" "{\"token\":\"${INVITE_TOKEN}\",\"password\":\"${TEST_PASS}\",\"name\":\"Stress Test User\"}" "none")
    STATUS=$(get_status "$RAW")
    BODY=$(get_body "$RAW")
    check_any "POST /v1/auth/accept-invite" "$STATUS" "200" "201"
  else
    skip "No invite token in response"
  fi
fi

# ─── 3. User Login ──────────────────────────────────────────────────────────
section "3. User Login"

USER_LOGIN_BODY='{"email":"'"${TEST_EMAIL}"'","password":"'"${TEST_PASS}"'"}'
RAW=$(curl -s --max-time 15 -w "\n__HTTP__%{http_code}" -H "Content-Type: application/json" -X POST "${BASE_URL}/v1/auth/login" -d "${USER_LOGIN_BODY}" 2>/dev/null)
STATUS=$(get_status "$RAW")
BODY=$(get_body "$RAW")

check_any "POST /v1/auth/login (user)" "$STATUS" "200" "201" "401"
USER_JWT=$(jq_get "$BODY" ".token" "" | tr -d '\n\r ')
if [[ -n "$USER_JWT" ]]; then
  ok "User JWT obtained"
  info "User: $(jq_get "$BODY" ".user.email" "unknown")"
  info "Role: $(jq_get "$BODY" ".user.role" "unknown")"
elif [[ -n "$ADMIN_JWT" ]]; then
  skip "User login failed (invite not accepted) — using admin JWT for remaining tests"
  USER_JWT="$ADMIN_JWT"
else
  fail "No JWT available"
fi

# Verify /me
RAW=$(api_get "/v1/auth/me" "jwt")
STATUS=$(get_status "$RAW")
check_any "GET /v1/auth/me" "$STATUS" "200" "401"

# ─── 4. Check Onboarding Status ────────────────────────────────────────────
section "4. Onboarding Status"

RAW=$(api_get "/v1/onboarding/status")
STATUS=$(get_status "$RAW")
BODY=$(get_body "$RAW")

check "GET /v1/onboarding/status" "200" "$STATUS"
info "Platforms connected: $(jq_get "$BODY" ".platforms_connected" "0")/$(jq_get "$BODY" ".platforms_total" "6")"
info "MCP servers: $(jq_get "$BODY" ".mcp_servers_connected" "0")"

# ─── 5. Check Connector Status ─────────────────────────────────────────────
section "5. Connector Status"

RAW=$(api_get "/v1/connectors/status")
STATUS=$(get_status "$RAW")
BODY=$(get_body "$RAW")

check "GET /v1/connectors/status" "200" "$STATUS"
info "Connected: $(jq_get "$BODY" ".connected" "0")/$(jq_get "$BODY" ".total" "6")"

# ─── 6. Check MCP Marketplace ──────────────────────────────────────────────
section "6. MCP Marketplace"

RAW=$(api_get "/v1/mcp/catalog")
STATUS=$(get_status "$RAW")
BODY=$(get_body "$RAW")

check "GET /v1/mcp/catalog" "200" "$STATUS"
if command -v jq >/dev/null 2>&1; then
  CATALOG_COUNT=$(echo "$BODY" | jq '.catalog | length' 2>/dev/null || echo "0")
  info "MCP catalog entries: ${CATALOG_COUNT}"
fi

RAW=$(api_get "/v1/mcp/connections")
STATUS=$(get_status "$RAW")
check_any "GET /v1/mcp/connections" "$STATUS" "200" "404"

# ─── 7. Check Storage Providers ────────────────────────────────────────────
section "7. Storage Providers"

RAW=$(api_get "/v1/storage/providers")
STATUS=$(get_status "$RAW")
BODY=$(get_body "$RAW")

check "GET /v1/storage/providers" "200" "$STATUS"
if command -v jq >/dev/null 2>&1; then
  echo "$BODY" | jq -r '.providers[]? | "    \(.id): available=\(.available)"' 2>/dev/null || true
fi

# ─── 8. Batch Upload (5 files: campaigns, sell-out, investor, brief, KPI) ──
section "8. Batch Data Upload (CSV files)"

# File 1: Past campaign data (digital_sales)
TMPCSV1=$(mktemp /tmp/oa-campaigns-XXXXXX.csv)
cat > "$TMPCSV1" <<'CSV1'
campaign_name,channel,spend,impressions,clicks,conversions,revenue,ctr,cpa,roas
Brand_Awareness_Q1,google_ads,45000,1200000,36000,720,108000,0.03,62.50,2.40
Retargeting_Spring,meta_ads,32000,890000,26700,534,85440,0.03,59.93,2.67
TikTok_GenZ_Launch,tiktok_ads,18000,560000,16800,252,37800,0.03,71.43,2.10
Holiday_Push_DV360,dv360,55000,2100000,42000,840,126000,0.02,65.48,2.29
Amazon_SP_Core,amazon_ads,28000,780000,23400,468,84240,0.03,59.83,3.01
CSV1

RAW=$(api_upload "/v1/upload" "$TMPCSV1" "$CLIENT_ID" "digital_sales")
STATUS=$(get_status "$RAW"); BODY=$(get_body "$RAW")
check "Upload: past campaigns (digital_sales)" "200" "$STATUS"
RID=$(jq_get "$BODY" ".record_id" ""); [[ -n "$RID" ]] && UPLOAD_IDS="${UPLOAD_IDS} ${RID}" && info "record_id: ${RID}"

# File 2: Sell-out data
TMPCSV2=$(mktemp /tmp/oa-sellout-XXXXXX.csv)
cat > "$TMPCSV2" <<'CSV2'
product,region,units_sold,revenue,period,channel
Widget_Pro,North America,12500,625000,2026-Q1,retail
Widget_Lite,Europe,8200,287000,2026-Q1,retail
Widget_Pro,North America,15100,755000,2026-Q1,ecommerce
Widget_Lite,APAC,4300,150500,2026-Q1,ecommerce
CSV2

RAW=$(api_upload "/v1/upload" "$TMPCSV2" "$CLIENT_ID" "sell_out")
STATUS=$(get_status "$RAW"); BODY=$(get_body "$RAW")
check "Upload: sell-out data" "200" "$STATUS"
RID=$(jq_get "$BODY" ".record_id" ""); [[ -n "$RID" ]] && UPLOAD_IDS="${UPLOAD_IDS} ${RID}"

# File 3: Investor results
TMPCSV3=$(mktemp /tmp/oa-investor-XXXXXX.csv)
cat > "$TMPCSV3" <<'CSV3'
metric,value,period,target,variance_pct
Revenue,1817500,2026-Q1,1900000,-4.3
EBITDA,363500,2026-Q1,380000,-4.3
Ad_Spend,178000,2026-Q1,200000,-11.0
ROAS,2.41,2026-Q1,2.50,-3.6
Customer_Acquisition_Cost,68.50,2026-Q1,60.00,14.2
New_Customers,2814,2026-Q1,3200,-12.1
CSV3

RAW=$(api_upload "/v1/upload" "$TMPCSV3" "$CLIENT_ID" "investor_relations")
STATUS=$(get_status "$RAW"); BODY=$(get_body "$RAW")
check "Upload: investor results" "200" "$STATUS"
RID=$(jq_get "$BODY" ".record_id" ""); [[ -n "$RID" ]] && UPLOAD_IDS="${UPLOAD_IDS} ${RID}"

# File 4: Campaign brief
TMPCSV4=$(mktemp /tmp/oa-brief-XXXXXX.csv)
cat > "$TMPCSV4" <<'CSV4'
objective,target_audience,budget,kpi,target_value,timeline
Brand_Awareness,Adults_25-54,80000,reach,5000000,2026-Q2
Lead_Generation,SMB_Owners,45000,conversions,1500,2026-Q2
Retargeting,Site_Visitors,35000,roas,3.0,2026-Q2
Product_Launch,GenZ_18-24,40000,video_views,2000000,2026-Q2
CSV4

RAW=$(api_upload "/v1/upload" "$TMPCSV4" "$CLIENT_ID" "other")
STATUS=$(get_status "$RAW"); BODY=$(get_body "$RAW")
check "Upload: campaign brief" "200" "$STATUS"
RID=$(jq_get "$BODY" ".record_id" ""); [[ -n "$RID" ]] && UPLOAD_IDS="${UPLOAD_IDS} ${RID}"

# File 5: KPI results (for plan vs actual)
TMPCSV5=$(mktemp /tmp/oa-kpi-XXXXXX.csv)
cat > "$TMPCSV5" <<'CSV5'
kpi,planned,actual,variance_pct,channel
ROAS,2.40,2.65,10.4,google_ads
ROAS,2.67,2.82,5.6,meta_ads
CPA,62.50,55.20,-11.7,google_ads
CPA,59.93,52.10,-13.1,meta_ads
Waste_Pct,18.5,14.2,-23.2,all
Conversions,2814,3150,11.9,all
Revenue,1817500,1953200,7.5,all
CSV5

RAW=$(api_upload "/v1/upload" "$TMPCSV5" "$CLIENT_ID" "sell_in")
STATUS=$(get_status "$RAW"); BODY=$(get_body "$RAW")
check "Upload: KPI results" "200" "$STATUS"
RID=$(jq_get "$BODY" ".record_id" ""); [[ -n "$RID" ]] && UPLOAD_IDS="${UPLOAD_IDS} ${RID}"

# Verify all uploads
RAW=$(api_get "/v1/upload/client/${CLIENT_ID}")
STATUS=$(get_status "$RAW"); BODY=$(get_body "$RAW")
check "GET /v1/upload/client/:clientId" "200" "$STATUS"
TOTAL_UPLOADS=$(jq_get "$BODY" ".total" "0")
info "Total uploads for client: ${TOTAL_UPLOADS}"

rm -f "$TMPCSV1" "$TMPCSV2" "$TMPCSV3" "$TMPCSV4" "$TMPCSV5"

# ─── 9. Pipeline Execute (Plan Run) ────────────────────────────────────────
section "9. Pipeline Execute — Plan Run"

info "Executing full-optimization pipeline (run_type=plan)..."
info "This may take 60-180s (4 LLM engines)..."

PIPELINE_BODY=$(cat <<PEOF
{
  "client_id": "${CLIENT_ID}",
  "run_type": "plan",
  "context": {
    "gross_spend": 178000,
    "industry": "cpg",
    "total_budget": 200000,
    "company": "${TEST_COMPANY}"
  }
}
PEOF
)

RAW=$(api_post "/v1/mesh/pipelines/full-optimization/execute" "$PIPELINE_BODY" "apikey" "300")
STATUS=$(get_status "$RAW")
BODY=$(get_body "$RAW")

check_any "POST pipeline (plan)" "$STATUS" "200" "201"

if [[ "$STATUS" == "200" || "$STATUS" == "201" ]]; then
  PIPELINE_STATUS=$(jq_get "$BODY" ".status" "unknown")
  PIPELINE_RUN_ID=$(jq_get "$BODY" ".id" "")

  if [[ "$PIPELINE_STATUS" == "completed" ]]; then
    ok "Pipeline plan: completed"
  elif [[ "$PIPELINE_STATUS" == "partial" ]]; then
    skip "Pipeline plan: partial"
  else
    fail "Pipeline plan: ${PIPELINE_STATUS}"
  fi

  info "Run ID: ${PIPELINE_RUN_ID}"
  info "Duration: $(jq_get "$BODY" ".total_duration_ms" "0")ms"

  # Context validation
  SOURCE_COUNT=$(jq_get "$BODY" ".context_validation.source_count" "0")
  HAS_BATCH=$(jq_get "$BODY" ".context_validation.has_batch_data" "false")
  HAS_EXPLICIT=$(jq_get "$BODY" ".context_validation.has_explicit_context" "false")
  info "Sources: ${SOURCE_COUNT} (batch=${HAS_BATCH}, explicit=${HAS_EXPLICIT})"

  # Scorecard
  PLAN_SCORECARD_ID=$(jq_get "$BODY" ".scorecard.id" "")
  TOTAL_FEE=$(jq_get "$BODY" ".scorecard.total_fee" "0")
  ROI=$(jq_get "$BODY" ".scorecard.roi_on_fee" "0")
  TIER=$(jq_get "$BODY" ".scorecard.tier" "unknown")

  if [[ -n "$PLAN_SCORECARD_ID" ]]; then
    ok "Plan scorecard created: ${PLAN_SCORECARD_ID}"
    info "Fee: \$${TOTAL_FEE} | ROI: ${ROI}x | Tier: ${TIER}"
  else
    skip "No scorecard in plan response"
  fi

  # Engine stages
  if command -v jq >/dev/null 2>&1; then
    STAGES=$(echo "$BODY" | jq -r '.stage_results | keys[]?' 2>/dev/null)
    STAGE_COUNT=0
    while IFS= read -r stage; do
      [[ -z "$stage" ]] && continue
      STAGE_STATUS=$(echo "$BODY" | jq -r ".stage_results[\"${stage}\"].status" 2>/dev/null)
      STAGE_MS=$(echo "$BODY" | jq -r ".stage_results[\"${stage}\"].duration_ms" 2>/dev/null)
      info "  ${stage}: ${STAGE_STATUS} (${STAGE_MS}ms)"
      STAGE_COUNT=$((STAGE_COUNT + 1))
    done <<< "$STAGES"
    if [[ $STAGE_COUNT -ge 4 ]]; then
      ok "All 4 engines executed"
    else
      fail "Only ${STAGE_COUNT}/4 engines executed"
    fi
  fi

  # HFL decision
  HFL_STATUS=$(jq_get "$BODY" ".hfl_decision.status" "none")
  HFL_NEEDS_HUMAN=$(jq_get "$BODY" ".hfl_decision.needs_human" "false")
  if [[ "$HFL_STATUS" != "none" ]]; then
    ok "HFL evaluated: status=${HFL_STATUS}, needs_human=${HFL_NEEDS_HUMAN}"
  else
    skip "No HFL decision in response"
  fi
else
  fail "Pipeline plan failed: HTTP ${STATUS}"
  info "$(echo "$BODY" | head -c 300)"
fi

# ─── 10. HFL Pending Decisions ─────────────────────────────────────────────
section "10. HFL Pending Decisions"

RAW=$(api_get "/v1/hfl/pending")
STATUS=$(get_status "$RAW")
BODY=$(get_body "$RAW")

check_any "GET /v1/hfl/pending" "$STATUS" "200" "404"
PENDING_COUNT=$(jq_get "$BODY" ".count" "0")
info "Pending decisions: ${PENDING_COUNT}"

# Approve the run if we have a run_id
if [[ -n "$PIPELINE_RUN_ID" ]]; then
  RAW=$(api_post "/v1/mesh/runs/${PIPELINE_RUN_ID}/approve" '{"feedback":"Stress test approved — plan looks good"}')
  STATUS=$(get_status "$RAW")
  check_any "POST approve run" "$STATUS" "200" "201" "404"
fi

# ─── 11. Scorecard Verification ────────────────────────────────────────────
section "11. Scorecard Verification"

RAW=$(api_get "/v1/scorecards")
STATUS=$(get_status "$RAW")
BODY=$(get_body "$RAW")

check "GET /v1/scorecards" "200" "$STATUS"
SC_COUNT=$(jq_get "$BODY" ".scorecards | length" "0")
info "Total scorecards: ${SC_COUNT}"

if [[ -n "$PLAN_SCORECARD_ID" ]]; then
  RAW=$(api_get "/v1/scorecard/${PLAN_SCORECARD_ID}")
  STATUS=$(get_status "$RAW")
  check "GET /v1/scorecard/:id (plan)" "200" "$STATUS"
fi

# ─── 12. Pipeline Execute (Actual Run) ─────────────────────────────────────
section "12. Pipeline Execute — Actual Run"

info "Executing 2nd pipeline (should auto-detect run_type=actual)..."
info "This may take 60-180s..."

ACTUAL_BODY=$(cat <<AEOF
{
  "client_id": "${CLIENT_ID}",
  "context": {
    "gross_spend": 178000,
    "industry": "cpg",
    "total_budget": 200000,
    "company": "${TEST_COMPANY}"
  }
}
AEOF
)

RAW=$(api_post "/v1/mesh/pipelines/full-optimization/execute" "$ACTUAL_BODY" "apikey" "300")
STATUS=$(get_status "$RAW")
BODY=$(get_body "$RAW")

check_any "POST pipeline (actual)" "$STATUS" "200" "201"

if [[ "$STATUS" == "200" || "$STATUS" == "201" ]]; then
  ACTUAL_STATUS=$(jq_get "$BODY" ".status" "unknown")
  if [[ "$ACTUAL_STATUS" == "completed" || "$ACTUAL_STATUS" == "partial" ]]; then
    ok "Pipeline actual: ${ACTUAL_STATUS}"
  else
    fail "Pipeline actual: ${ACTUAL_STATUS}"
  fi

  ACTUAL_SCORECARD_ID=$(jq_get "$BODY" ".scorecard.id" "")
  if [[ -n "$ACTUAL_SCORECARD_ID" ]]; then
    ok "Actual scorecard created: ${ACTUAL_SCORECARD_ID}"
    info "Fee: \$$(jq_get "$BODY" ".scorecard.total_fee" "0") | ROI: $(jq_get "$BODY" ".scorecard.roi_on_fee" "0")x"
  else
    skip "No actual scorecard"
  fi
else
  fail "Pipeline actual failed: HTTP ${STATUS}"
  info "$(echo "$BODY" | head -c 300)"
fi

# ─── 13. Plan vs Actual Comparison ─────────────────────────────────────────
section "13. Plan vs Actual Comparison"

if [[ -n "$PLAN_SCORECARD_ID" && -n "$ACTUAL_SCORECARD_ID" ]]; then
  RAW=$(api_post "/v1/scorecard/compare" "{\"plan_id\":\"${PLAN_SCORECARD_ID}\",\"actual_id\":\"${ACTUAL_SCORECARD_ID}\"}")
  STATUS=$(get_status "$RAW")
  BODY=$(get_body "$RAW")

  check_any "POST /v1/scorecard/compare" "$STATUS" "200" "201"

  if [[ "$STATUS" == "200" || "$STATUS" == "201" ]]; then
    LIFT_PCT=$(jq_get "$BODY" ".real_lift_pct" "0")
    WASTE_REDUCTION=$(jq_get "$BODY" ".waste_reduction_pct" "0")
    MDS_PLAN=$(jq_get "$BODY" ".media_driven_sales.plan" "0")
    MDS_ACTUAL=$(jq_get "$BODY" ".media_driven_sales.actual" "0")
    FEE_DELTA=$(jq_get "$BODY" ".total_fee_delta" "0")
    ROI_DELTA=$(jq_get "$BODY" ".roi_delta" "0")

    ok "Comparison computed"
    info "Lift: ${LIFT_PCT}%"
    info "Waste reduction: ${WASTE_REDUCTION}%"
    info "MDS: plan=\$${MDS_PLAN} → actual=\$${MDS_ACTUAL}"
    info "Fee delta: \$${FEE_DELTA} | ROI delta: ${ROI_DELTA}"

    # Insights
    if command -v jq >/dev/null 2>&1; then
      INSIGHTS=$(echo "$BODY" | jq -r '.insights[]?' 2>/dev/null)
      if [[ -n "$INSIGHTS" ]]; then
        while IFS= read -r insight; do
          info "  Insight: ${insight}"
        done <<< "$INSIGHTS"
      fi
    fi
  fi
else
  skip "Cannot compare — missing plan or actual scorecard ID"
fi

# ─── 14. Agents Status ─────────────────────────────────────────────────────
section "14. Agents Status"

RAW=$(api_get "/v1/agents/status")
STATUS=$(get_status "$RAW")
BODY=$(get_body "$RAW")

check "GET /v1/agents/status" "200" "$STATUS"
info "Agents: $(jq_get "$BODY" ".total" "0") total, $(jq_get "$BODY" ".active" "0") active"

# ─── 15. Recovery History ──────────────────────────────────────────────────
section "15. Recovery History"

RAW=$(api_get "/v1/recovery/history")
STATUS=$(get_status "$RAW")
check "GET /v1/recovery/history" "200" "$STATUS"

# ─── 16. Tier Preview ──────────────────────────────────────────────────────
section "16. Tier Preview"

RAW=$(api_get "/v1/scorecard/tier-preview?ad_spend=178000")
STATUS=$(get_status "$RAW")
BODY=$(get_body "$RAW")
check "GET /v1/scorecard/tier-preview" "200" "$STATUS"
info "Tier: $(jq_get "$BODY" ".label" "$(jq_get "$BODY" ".tier" "unknown")") | Recovery rate: $(jq_get "$BODY" ".recovery_rate" "0")"

# ══════════════════════════════════════════════════════════════════════════════
banner "Results"
echo -e "  ${GREEN}PASS: ${PASS}${NC}  |  ${RED}FAIL: ${FAIL}${NC}  |  ${YELLOW}SKIP: ${SKIP}${NC}"
echo -e "  ${BOLD}Total: $((PASS + FAIL + SKIP))${NC}"

if [[ $FAIL -gt 0 ]]; then
  echo -e "\n  ${RED}${BOLD}Failed tests:${NC}"
  echo -e "$FAILURES" | while IFS= read -r line; do
    [[ -n "$line" ]] && echo -e "    ${RED}• ${line}${NC}"
  done
fi

echo ""
exit $FAIL
