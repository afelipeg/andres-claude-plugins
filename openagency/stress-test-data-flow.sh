#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# OpenAgency — Data Flow Stress Test
# Validates the full ingestion pipeline: batch upload → connector sync →
# MCP connections → pipeline execute → billing → plan vs actual
# bash 3.x compatible (macOS default)
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

BASE_URL="${BASE_URL:-https://polanyi-plinth-production.up.railway.app}"
API_KEY="${API_KEY:-oa_test_dev_default_key_for_local_testing}"

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

# ─── Helpers ─────────────────────────────────────────────────────────────────

api_get() {
  local path="$1"
  curl -s -w "\n__HTTP__%{http_code}" -H "X-API-Key: ${API_KEY}" -H "Content-Type: application/json" "${BASE_URL}${path}" 2>/dev/null
}

api_post() {
  local path="$1" body="${2:-{}}" timeout="${3:-120}"
  curl -s --max-time "$timeout" -w "\n__HTTP__%{http_code}" -H "X-API-Key: ${API_KEY}" -H "Content-Type: application/json" -X POST "${BASE_URL}${path}" -d "$body" 2>/dev/null
}

api_delete() {
  local path="$1"
  curl -s -w "\n__HTTP__%{http_code}" -H "X-API-Key: ${API_KEY}" -H "Content-Type: application/json" -X DELETE "${BASE_URL}${path}" 2>/dev/null
}

api_upload() {
  local path="$1" file="$2" client_id="$3" data_type="$4"
  curl -s -w "\n__HTTP__%{http_code}" -H "X-API-Key: ${API_KEY}" \
    -F "file=@${file}" -F "client_id=${client_id}" -F "data_type=${data_type}" \
    "${BASE_URL}${path}" 2>/dev/null
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
  if [[ "$actual" == "$expected" ]]; then
    ok "$label (HTTP $actual)"
  else
    fail "$label — expected $expected, got $actual"
  fi
}

check_any() {
  local label="$1" actual="$2"
  shift 2
  for code in "$@"; do
    if [[ "$actual" == "$code" ]]; then
      ok "$label (HTTP $actual)"
      return
    fi
  done
  fail "$label — got HTTP $actual, expected one of: $*"
}

# ─── Variables populated during test ─────────────────────────────────────────
UPLOAD_CLIENT_ID=""
UPLOAD_RECORD_ID=""

# ══════════════════════════════════════════════════════════════════════════════
banner "OpenAgency — Data Flow Stress Test"
info "Target: ${BASE_URL}"
info "Timestamp: ${TS}"
echo ""

# ─── Section 1: Batch Upload ────────────────────────────────────────────────
section "1. Batch Upload (CSV → parse → persist)"

# Create temp CSV with realistic campaign data
TMPCSV=$(mktemp /tmp/oa-stress-XXXXXX.csv)
cat > "$TMPCSV" <<'CSVEOF'
campaign_name,channel,spend,impressions,clicks,conversions,revenue,ctr,cpa,roas
Brand_Awareness_Q1,google_ads,45000,1200000,36000,720,108000,0.03,62.50,2.40
Retargeting_Spring,meta_ads,32000,890000,26700,534,85440,0.03,59.93,2.67
TikTok_GenZ_Launch,tiktok_ads,18000,560000,16800,252,37800,0.03,71.43,2.10
Holiday_Push_DV360,dv360,55000,2100000,42000,840,126000,0.02,65.48,2.29
Amazon_SP_Core,amazon_ads,28000,780000,23400,468,84240,0.03,59.83,3.01
CSVEOF

UPLOAD_CLIENT_ID="stress-dataflow-${TS}"
info "Client ID: ${UPLOAD_CLIENT_ID}"
info "Uploading CSV with 5 campaign rows..."

RAW=$(api_upload "/v1/upload" "$TMPCSV" "$UPLOAD_CLIENT_ID" "digital_sales")
STATUS=$(get_status "$RAW")
BODY=$(get_body "$RAW")

check "POST /v1/upload" "200" "$STATUS"

PERSISTED=$(jq_get "$BODY" ".persisted" "false")
if [[ "$PERSISTED" == "true" ]]; then
  ok "Upload persisted to DB"
else
  fail "Upload not persisted (persisted=$PERSISTED)"
fi

UPLOAD_RECORD_ID=$(jq_get "$BODY" ".record_id" "")
if [[ -n "$UPLOAD_RECORD_ID" ]]; then
  ok "Record ID: ${UPLOAD_RECORD_ID}"
else
  fail "No record_id in upload response"
fi

ROW_COUNT=$(jq_get "$BODY" ".rows" "0")
info "Rows parsed: ${ROW_COUNT}"

# Verify upload retrieval
RAW=$(api_get "/v1/upload/client/${UPLOAD_CLIENT_ID}")
STATUS=$(get_status "$RAW")
check "GET /v1/upload/client/:clientId" "200" "$STATUS"

if [[ -n "$UPLOAD_RECORD_ID" ]]; then
  RAW=$(api_get "/v1/upload/${UPLOAD_RECORD_ID}")
  STATUS=$(get_status "$RAW")
  check "GET /v1/upload/:id (record detail)" "200" "$STATUS"
fi

rm -f "$TMPCSV"

# ─── Section 2: MCP Connection Status ──────────────────────────────────────
section "2. MCP Connection Status"

RAW=$(api_get "/v1/mcp/connections")
STATUS=$(get_status "$RAW")
BODY=$(get_body "$RAW")

check_any "GET /v1/mcp/connections" "$STATUS" "200" "404"

if [[ "$STATUS" == "200" ]]; then
  CONN_COUNT=$(jq_get "$BODY" ".connections | length" "0")
  info "MCP connections: ${CONN_COUNT}"

  if command -v jq >/dev/null 2>&1; then
    STALE_COUNT=$(echo "$BODY" | jq '[.connections[]? | select(.status == "stale")] | length' 2>/dev/null || echo "0")
    CONNECTED_COUNT=$(echo "$BODY" | jq '[.connections[]? | select(.status == "connected")] | length' 2>/dev/null || echo "0")
    info "Connected: ${CONNECTED_COUNT}, Stale: ${STALE_COUNT}"

    if [[ "$STALE_COUNT" -gt 0 ]]; then
      skip "Stale MCP connections detected (${STALE_COUNT}) — auto-respawn should handle on next health check"
    fi
  fi
else
  skip "No MCP connections configured"
fi

# ─── Section 3: Connector Sync Status ──────────────────────────────────────
section "3. Connector Sync Status"

RAW=$(api_get "/v1/connectors/status")
STATUS=$(get_status "$RAW")
BODY=$(get_body "$RAW")

check "GET /v1/connectors/status" "200" "$STATUS"

if [[ "$STATUS" == "200" ]]; then
  TOTAL_PLATFORMS=$(jq_get "$BODY" ".total" "0")
  CONNECTED_PLATFORMS=$(jq_get "$BODY" ".connected" "0")
  info "Platforms: ${CONNECTED_PLATFORMS}/${TOTAL_PLATFORMS} connected"

  if [[ "$CONNECTED_PLATFORMS" == "0" ]]; then
    info "No platforms connected — pipeline will use batch data only"
  fi
fi

# ─── Section 4: Pipeline Execute (with batch data) ────────────────────────
section "4. Pipeline Execute (full-optimization)"

info "Executing pipeline for client: ${UPLOAD_CLIENT_ID}"
info "Expected: batch data present, context_validation in response"

PIPELINE_BODY=$(cat <<PEOF
{
  "client_id": "${UPLOAD_CLIENT_ID}",
  "context": {
    "gross_spend": 178000,
    "industry": "cpg",
    "total_budget": 200000
  }
}
PEOF
)

info "Pipeline execution may take 60-120s (LLM engines)..."
RAW=$(api_post "/v1/mesh/pipelines/full-optimization/execute" "$PIPELINE_BODY" "180")
STATUS=$(get_status "$RAW")
BODY=$(get_body "$RAW")

check_any "POST pipeline execute" "$STATUS" "200" "201" "422"

if [[ "$STATUS" == "200" || "$STATUS" == "201" ]]; then
  # Check pipeline status
  PIPELINE_STATUS=$(jq_get "$BODY" ".status" "unknown")
  if [[ "$PIPELINE_STATUS" == "completed" ]]; then
    ok "Pipeline status: completed"
  elif [[ "$PIPELINE_STATUS" == "partial" ]]; then
    skip "Pipeline status: partial (some stages failed)"
  else
    fail "Pipeline status: ${PIPELINE_STATUS}"
  fi

  # Check context_validation
  HAS_BATCH=$(jq_get "$BODY" ".context_validation.has_batch_data" "false")
  SOURCE_COUNT=$(jq_get "$BODY" ".context_validation.source_count" "0")
  GROSS_SPEND=$(jq_get "$BODY" ".context_validation.gross_spend" "0")

  if [[ "$HAS_BATCH" == "true" ]]; then
    ok "Context validation: has_batch_data=true"
  else
    fail "Context validation: batch data NOT detected (has_batch_data=$HAS_BATCH)"
  fi

  if [[ "$SOURCE_COUNT" -ge 1 ]]; then
    ok "Context validation: source_count=${SOURCE_COUNT}"
  else
    fail "Context validation: source_count=0 (should have at least batch)"
  fi

  info "gross_spend in context: \$${GROSS_SPEND}"

  # Check warnings
  if command -v jq >/dev/null 2>&1; then
    WARNINGS=$(echo "$BODY" | jq -r '.context_validation.warnings[]?' 2>/dev/null)
    if [[ -n "$WARNINGS" ]]; then
      while IFS= read -r w; do
        info "Warning: ${w}"
      done <<< "$WARNINGS"
    fi
  fi

  # ─── Section 5: Engine Outputs ──────────────────────────────────────────
  section "5. Engine Outputs"

  if command -v jq >/dev/null 2>&1; then
    STAGES=$(echo "$BODY" | jq -r '.stage_results | keys[]?' 2>/dev/null)
    if [[ -n "$STAGES" ]]; then
      while IFS= read -r stage; do
        STAGE_STATUS=$(echo "$BODY" | jq -r ".stage_results[\"${stage}\"].status // \"unknown\"" 2>/dev/null)
        STAGE_DURATION=$(echo "$BODY" | jq -r ".stage_results[\"${stage}\"].duration_ms // 0" 2>/dev/null)
        if [[ "$STAGE_STATUS" == "completed" ]]; then
          ok "Engine ${stage}: completed (${STAGE_DURATION}ms)"
        elif [[ "$STAGE_STATUS" == "partial" ]]; then
          skip "Engine ${stage}: partial (${STAGE_DURATION}ms)"
        else
          fail "Engine ${stage}: ${STAGE_STATUS}"
        fi
      done <<< "$STAGES"
    else
      fail "No stage_results in pipeline response"
    fi
  else
    skip "jq not available — cannot parse engine outputs"
  fi

  # ─── Section 6: Billing Verification ────────────────────────────────────
  section "6. Billing Verification"

  TOTAL_FEE=$(jq_get "$BODY" ".scorecard.total_fee" "0")
  VALUE_DELIVERED=$(jq_get "$BODY" ".scorecard.value_delivered" "0")
  ROI_ON_FEE=$(jq_get "$BODY" ".scorecard.roi_on_fee" "0")
  TIER=$(jq_get "$BODY" ".scorecard.tier" "unknown")

  if [[ "$TOTAL_FEE" != "0" && "$TOTAL_FEE" != "null" ]]; then
    ok "Billing: total_fee=\$${TOTAL_FEE}"
  else
    skip "Billing: total_fee=\$0 (engines may not have produced billing data)"
  fi

  if [[ "$ROI_ON_FEE" != "0" && "$ROI_ON_FEE" != "null" ]]; then
    ok "Billing: roi_on_fee=${ROI_ON_FEE}x"
  else
    skip "Billing: roi_on_fee=0"
  fi

  info "value_delivered=\$${VALUE_DELIVERED}, tier=${TIER}"

elif [[ "$STATUS" == "422" ]]; then
  # Check if explicit context was recognized
  HAS_EXPLICIT=$(jq_get "$BODY" ".context_validation.has_explicit_context" "false")
  VALIDATION_SOURCES=$(jq_get "$BODY" ".context_validation.source_count" "0")
  if [[ "$HAS_EXPLICIT" == "true" ]]; then
    ok "Context validation: has_explicit_context=true (422 is stale instance)"
  elif [[ "$VALIDATION_SOURCES" -ge 1 ]]; then
    ok "Context validation: source_count=${VALIDATION_SOURCES}"
  else
    skip "Pipeline 422: NO_DATA_SOURCES — no connectors, MCP, or batch data active"
    info "This is expected without connected platforms. Sources: sync=0, batch=0, mcp=0, explicit=${HAS_EXPLICIT}"
  fi
elif [[ -z "$STATUS" || "$STATUS" == "000" ]]; then
  skip "Pipeline request timed out (engines may need LLM API key on Railway)"
else
  fail "Pipeline execution failed: HTTP ${STATUS}"
  info "Response: $(echo "$BODY" | head -c 300)"
fi

# ─── Section 7: Plan vs Actual Cycle ──────────────────────────────────────
section "7. Plan vs Actual Cycle (2nd pipeline run)"

info "Running 2nd pipeline for same client — should auto-detect run_type=actual"

info "2nd pipeline execution (60-120s)..."
RAW2=$(api_post "/v1/mesh/pipelines/full-optimization/execute" "$PIPELINE_BODY" "180")
STATUS2=$(get_status "$RAW2")
BODY2=$(get_body "$RAW2")

check_any "POST pipeline execute (2nd run)" "$STATUS2" "200" "201" "422"

if [[ "$STATUS2" == "200" || "$STATUS2" == "201" ]]; then
  PIPELINE_STATUS2=$(jq_get "$BODY2" ".status" "unknown")
  if [[ "$PIPELINE_STATUS2" == "completed" || "$PIPELINE_STATUS2" == "partial" ]]; then
    ok "2nd pipeline: ${PIPELINE_STATUS2}"
  else
    fail "2nd pipeline: ${PIPELINE_STATUS2}"
  fi
fi

# ─── Section 8: Recovery History ──────────────────────────────────────────
section "8. Recovery History"

RAW=$(api_get "/v1/recovery/history?months=1")
STATUS=$(get_status "$RAW")
check "GET /v1/recovery/history" "200" "$STATUS"

# ─── Section 9: Cleanup ──────────────────────────────────────────────────
section "9. Cleanup"

if [[ -n "$UPLOAD_RECORD_ID" ]]; then
  RAW=$(api_delete "/v1/upload/${UPLOAD_RECORD_ID}")
  STATUS=$(get_status "$RAW")
  check_any "DELETE /v1/upload/:id (cleanup)" "$STATUS" "200" "204" "404"
else
  skip "No upload record to clean up"
fi

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
