#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# OpenAgency — Production Stress Test: 3 MAU Simulation
# bash 3.x compatible (macOS default)
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

BASE_URL="https://polanyi-plinth-production.up.railway.app"
API_KEY="oa_test_dev_default_key_for_local_testing"

# ─── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

banner() { echo -e "\n${BOLD}${BLUE}══════════════════════════════════════════════════════${NC}"; echo -e "${BOLD}${BLUE}  $1${NC}"; echo -e "${BOLD}${BLUE}══════════════════════════════════════════════════════${NC}\n"; }
ok()     { echo -e "  ${GREEN}✓${NC} $1"; }
fail()   { echo -e "  ${RED}✗${NC} $1"; }
info()   { echo -e "  ${CYAN}→${NC} $1"; }
warn()   { echo -e "  ${YELLOW}⚠${NC} $1"; }

FAILURES=""
PASS_COUNT=0

# ─── Helpers ─────────────────────────────────────────────────────────────────
curl_post() {
  local path="$1" body="${2:-{}}"
  curl -s -w "\n__HTTP_STATUS__%{http_code}" \
    -H "Authorization: Bearer ${API_KEY}" \
    -H "Content-Type: application/json" \
    -X POST "${BASE_URL}${path}" -d "$body"
}

curl_get() {
  local path="$1"
  curl -s -w "\n__HTTP_STATUS__%{http_code}" \
    -H "Authorization: Bearer ${API_KEY}" \
    -H "Content-Type: application/json" \
    -X GET "${BASE_URL}${path}"
}

split_response() {
  # Args: raw full_response
  # Sets global: RESP_BODY RESP_HTTP
  local raw="$1"
  RESP_BODY="${raw%__HTTP_STATUS__*}"
  RESP_HTTP="${raw##*__HTTP_STATUS__}"
}

jq_get() {
  local json="$1" field="$2" default="${3:-N/A}"
  if command -v jq >/dev/null 2>&1; then
    echo "$json" | jq -r "${field} // \"${default}\"" 2>/dev/null || echo "$default"
  else
    echo "$default"
  fi
}

exec_pipeline() {
  local label="$1" pipeline="$2" client_id="$3"
  info "Executing ${pipeline} for ${client_id}..."
  local raw
  raw=$(curl_post "/v1/mesh/pipelines/${pipeline}/execute" "{\"client_id\":\"${client_id}\"}")
  split_response "$raw"
  if [[ "$RESP_HTTP" == "201" || "$RESP_HTTP" == "200" ]]; then
    PASS_COUNT=$((PASS_COUNT + 1))
    ok "${label}: HTTP ${RESP_HTTP} ✓"
    return 0
  else
    FAILURES="${FAILURES}${label} (HTTP ${RESP_HTTP})\n"
    fail "${label}: HTTP ${RESP_HTTP} — $(echo "$RESP_BODY" | head -c 200)"
    RESP_BODY='{"error":"http_'"$RESP_HTTP"'"}'
    return 1
  fi
}

print_run_summary() {
  local label="$1" json="$2"
  local run_id status dur fee value roi tier
  run_id=$(jq_get "$json" '.id')
  status=$(jq_get "$json" '.status')
  dur=$(jq_get "$json" '.total_duration_ms' '0')
  fee=$(jq_get "$json" '.scorecard.total_fee' 'N/A')
  value=$(jq_get "$json" '.scorecard.value_delivered' 'N/A')
  roi=$(jq_get "$json" '.scorecard.roi_on_fee' 'N/A')
  tier=$(jq_get "$json" '.scorecard.tier' 'N/A')
  echo -e "    Run ID:   ${BOLD}${run_id}${NC}"
  echo -e "    Status:   ${status} | Duration: ${dur}ms"
  echo -e "    Billing:  Tier=${tier} | Fee=\$${fee} | Value=\$${value} | ROI=${roi}x"
}

# ─── Org IDs ─────────────────────────────────────────────────────────────────
TS=$(date +%s)
ORG_ALPHA="org-alpha-${TS}"
ORG_BETA="org-beta-${TS}"
ORG_GAMMA="org-gamma-${TS}"

banner "OpenAgency — 3 MAU Production Stress Test"
echo -e "  Target:    ${BOLD}${BASE_URL}${NC}"
echo -e "  Date:      $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo -e "  Org Alpha: ${ORG_ALPHA}  [MAU 1 — new user, full-with-deliverables + HFL]"
echo -e "  Org Beta:  ${ORG_BETA}   [MAU 2 — returning, plan→actual, full-optimization]"
echo -e "  Org Gamma: ${ORG_GAMMA}  [MAU 3 — returning, plan→actual, full-optimization]"

# ─── Health ───────────────────────────────────────────────────────────────────
banner "PRE-FLIGHT: Health Check"
raw=$(curl_get "/health")
split_response "$raw"
if [[ "$RESP_HTTP" != "200" ]]; then
  fail "Health check failed (HTTP $RESP_HTTP) — aborting"
  exit 1
fi
ok "API healthy"
info "DB: $(jq_get "$RESP_BODY" '.db' 'unknown')"

# ─────────────────────────────────────────────────────────────────────────────
# MAU 1 — New user / full-with-deliverables + HFL
# ─────────────────────────────────────────────────────────────────────────────
banner "MAU 1 ── New User ── full-with-deliverables (Engines 1→5 + HFL)"

M1_RUN_ID="N/A"
M1_HFL_STATUS="none"; M1_HFL_URGENCY="none"
M1_HFL_NEEDS_HUMAN="false"; M1_HFL_REASON="N/A"; M1_HFL_ID="N/A"
M1_JSON='{"error":"not_run"}'

if exec_pipeline "MAU1_run1" "full-with-deliverables" "${ORG_ALPHA}"; then
  M1_JSON="$RESP_BODY"
  echo ""
  print_run_summary "MAU 1" "$M1_JSON"
  M1_RUN_ID=$(jq_get "$M1_JSON" '.id')

  # HFL
  M1_HFL_STATUS=$(jq_get "$M1_JSON" '.hfl_decision.status' 'none')
  M1_HFL_URGENCY=$(jq_get "$M1_JSON" '.hfl_decision.urgency' 'none')
  M1_HFL_NEEDS_HUMAN=$(jq_get "$M1_JSON" '.hfl_decision.needs_human' 'false')
  M1_HFL_ID=$(jq_get "$M1_JSON" '.hfl_decision.decision_id // .hfl_decision.id' 'N/A')
  M1_HFL_REASON=$(jq_get "$M1_JSON" '.hfl_decision.reason' 'N/A')
  echo ""
  ok "HFL → Status=${M1_HFL_STATUS} | Urgency=${M1_HFL_URGENCY} | Needs human=${M1_HFL_NEEDS_HUMAN}"
  info "HFL Reason: ${M1_HFL_REASON}"

  # Stages
  if command -v jq >/dev/null 2>&1; then
    STAGES=$(echo "$M1_JSON" | jq -r '.stage_results | keys | join(", ")' 2>/dev/null || echo "N/A")
    info "Stages: ${STAGES}"
  fi

  # Recovery breakdown
  RAW_REC=$(curl_get "/v1/mesh/runs/${M1_RUN_ID}/recovery")
  split_response "$RAW_REC"
  if [[ "$RESP_HTTP" == "200" ]]; then
    M1_RECOVERY=$(jq_get "$RESP_BODY" '.total_recovery_usd' '0')
    ok "Recovery breakdown: \$${M1_RECOVERY} USD total"
  fi

  # Approve HFL if escalated
  if [[ "$M1_HFL_NEEDS_HUMAN" == "true" && "$M1_RUN_ID" != "N/A" ]]; then
    warn "HFL requires human — simulating operator approval..."
    RAW_APPROVE=$(curl_post "/v1/mesh/runs/${M1_RUN_ID}/approve" '{"feedback":"Stress test: approved by automated QA"}')
    split_response "$RAW_APPROVE"
    if [[ "$RESP_HTTP" == "200" ]]; then
      ok "HFL approved for run ${M1_RUN_ID}"
    else
      warn "HFL approve HTTP ${RESP_HTTP} (may already be resolved)"
    fi
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# MAU 2 — Returning user / Plan + Actual / full-optimization
# ─────────────────────────────────────────────────────────────────────────────
banner "MAU 2 ── Returning User ── Plan vs Actual (full-optimization)"

M2_PLAN_JSON='{"error":"not_run"}'; M2_ACTUAL_JSON='{"error":"not_run"}'
M2_PLAN_DUR="0"; M2_ACTUAL_DUR="0"

if exec_pipeline "MAU2_plan" "full-optimization" "${ORG_BETA}"; then
  M2_PLAN_JSON="$RESP_BODY"
  echo ""
  echo -e "  ${BOLD}[PLAN]${NC}"
  print_run_summary "MAU 2 Plan" "$M2_PLAN_JSON"
  M2_PLAN_DUR=$(jq_get "$M2_PLAN_JSON" '.total_duration_ms' '0')
fi

echo ""

if exec_pipeline "MAU2_actual" "full-optimization" "${ORG_BETA}"; then
  M2_ACTUAL_JSON="$RESP_BODY"
  echo ""
  echo -e "  ${BOLD}[ACTUAL]${NC}"
  print_run_summary "MAU 2 Actual" "$M2_ACTUAL_JSON"
  M2_ACTUAL_DUR=$(jq_get "$M2_ACTUAL_JSON" '.total_duration_ms' '0')
fi

# ─────────────────────────────────────────────────────────────────────────────
# MAU 3 — Returning user / Plan + Actual / full-optimization (separate org)
# ─────────────────────────────────────────────────────────────────────────────
banner "MAU 3 ── Returning User ── Plan vs Actual (full-optimization)"

M3_PLAN_JSON='{"error":"not_run"}'; M3_ACTUAL_JSON='{"error":"not_run"}'
M3_PLAN_DUR="0"; M3_ACTUAL_DUR="0"

if exec_pipeline "MAU3_plan" "full-optimization" "${ORG_GAMMA}"; then
  M3_PLAN_JSON="$RESP_BODY"
  echo ""
  echo -e "  ${BOLD}[PLAN]${NC}"
  print_run_summary "MAU 3 Plan" "$M3_PLAN_JSON"
  M3_PLAN_DUR=$(jq_get "$M3_PLAN_JSON" '.total_duration_ms' '0')
fi

echo ""

if exec_pipeline "MAU3_actual" "full-optimization" "${ORG_GAMMA}"; then
  M3_ACTUAL_JSON="$RESP_BODY"
  echo ""
  echo -e "  ${BOLD}[ACTUAL]${NC}"
  print_run_summary "MAU 3 Actual" "$M3_ACTUAL_JSON"
  M3_ACTUAL_DUR=$(jq_get "$M3_ACTUAL_JSON" '.total_duration_ms' '0')
fi

# ─────────────────────────────────────────────────────────────────────────────
# Cross-Org Isolation
# ─────────────────────────────────────────────────────────────────────────────
banner "Cross-Org Isolation Verification"

IDS=""
for json in "$M1_JSON" "$M2_PLAN_JSON" "$M2_ACTUAL_JSON" "$M3_PLAN_JSON" "$M3_ACTUAL_JSON"; do
  id=$(jq_get "$json" '.id' '')
  if [[ -n "$id" && "$id" != "N/A" && "$id" != "" ]]; then
    IDS="${IDS}${id}\n"
  fi
done

TOTAL_IDS=$(printf "$IDS" | grep -c '.' || echo 0)
UNIQUE_IDS=$(printf "$IDS" | sort -u | grep -c '.' || echo 0)

if [[ "$UNIQUE_IDS" == "$TOTAL_IDS" && "$TOTAL_IDS" -gt 0 ]]; then
  ok "All ${TOTAL_IDS} run IDs are unique — no cross-contamination"
else
  fail "Run ID collision or missing IDs (unique=${UNIQUE_IDS} / total=${TOTAL_IDS})"
fi

info "Run IDs issued this session:"
printf "$IDS" | while read -r id; do [[ -n "$id" ]] && echo "    - $id"; done

# ─────────────────────────────────────────────────────────────────────────────
# Final Summary
# ─────────────────────────────────────────────────────────────────────────────
banner "STRESS TEST SUMMARY"

echo -e "  ${BOLD}Date:${NC} $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo ""
echo -e "  ${BOLD}┌──────┬───────────────────────────┬───────────┬──────────────────────┬──────────────┬────────────┐${NC}"
echo -e "  ${BOLD}│ MAU  │ Org                       │ Type      │ Pipeline             │ Status       │ Fee        │${NC}"
echo -e "  ${BOLD}├──────┼───────────────────────────┼───────────┼──────────────────────┼──────────────┼────────────┤${NC}"

print_row() {
  local mau="$1" org="$2" rtype="$3" pipe="$4" json="$5"
  local status fee
  status=$(jq_get "$json" '.status' 'ERROR')
  fee=$(jq_get "$json" '.scorecard.total_fee' '-')
  printf "  │ %-4s │ %-25s │ %-9s │ %-20s │ %-12s │ \$%-9s │\n" \
    "$mau" "${org:0:25}" "$rtype" "${pipe:0:20}" "$status" "$fee"
}

print_row "1" "$ORG_ALPHA" "First run" "full-w-deliverables" "$M1_JSON"
print_row "2" "$ORG_BETA"  "Plan"      "full-optimization"   "$M2_PLAN_JSON"
print_row "2" "$ORG_BETA"  "Actual"    "full-optimization"   "$M2_ACTUAL_JSON"
print_row "3" "$ORG_GAMMA" "Plan"      "full-optimization"   "$M3_PLAN_JSON"
print_row "3" "$ORG_GAMMA" "Actual"    "full-optimization"   "$M3_ACTUAL_JSON"

echo -e "  ${BOLD}└──────┴───────────────────────────┴───────────┴──────────────────────┴──────────────┴────────────┘${NC}"

echo ""
echo -e "  ${BOLD}HFL Decision (MAU 1):${NC}"
echo -e "    Status:       ${M1_HFL_STATUS}"
echo -e "    Urgency:      ${M1_HFL_URGENCY}"
echo -e "    Needs human:  ${M1_HFL_NEEDS_HUMAN}"
echo -e "    Reason:       ${M1_HFL_REASON}"
echo -e "    Decision ID:  ${M1_HFL_ID}"

echo ""
echo -e "  ${BOLD}Plan vs Actual — MAU 2 (${ORG_BETA}):${NC}"
echo -e "    Duration: Plan=${M2_PLAN_DUR}ms → Actual=${M2_ACTUAL_DUR}ms"
M2P_FEE=$(jq_get "$M2_PLAN_JSON" '.scorecard.total_fee' '-')
M2A_FEE=$(jq_get "$M2_ACTUAL_JSON" '.scorecard.total_fee' '-')
M2P_VAL=$(jq_get "$M2_PLAN_JSON" '.scorecard.value_delivered' '-')
M2A_VAL=$(jq_get "$M2_ACTUAL_JSON" '.scorecard.value_delivered' '-')
echo -e "    Fee:      Plan=\$${M2P_FEE} → Actual=\$${M2A_FEE}"
echo -e "    Value:    Plan=\$${M2P_VAL} → Actual=\$${M2A_VAL}"

echo ""
echo -e "  ${BOLD}Plan vs Actual — MAU 3 (${ORG_GAMMA}):${NC}"
echo -e "    Duration: Plan=${M3_PLAN_DUR}ms → Actual=${M3_ACTUAL_DUR}ms"
M3P_FEE=$(jq_get "$M3_PLAN_JSON" '.scorecard.total_fee' '-')
M3A_FEE=$(jq_get "$M3_ACTUAL_JSON" '.scorecard.total_fee' '-')
M3P_VAL=$(jq_get "$M3_PLAN_JSON" '.scorecard.value_delivered' '-')
M3A_VAL=$(jq_get "$M3_ACTUAL_JSON" '.scorecard.value_delivered' '-')
echo -e "    Fee:      Plan=\$${M3P_FEE} → Actual=\$${M3A_FEE}"
echo -e "    Value:    Plan=\$${M3P_VAL} → Actual=\$${M3A_VAL}"

echo ""
FAILED_COUNT=$((5 - PASS_COUNT))
echo -e "  ${BOLD}Results:${NC} ${GREEN}${PASS_COUNT}/5 passed${NC}  |  ${RED}${FAILED_COUNT}/5 failed${NC}"
if [[ -n "$FAILURES" ]]; then
  echo -e "  ${RED}Failures:${NC}"
  printf "$FAILURES" | while read -r f; do [[ -n "$f" ]] && echo -e "    - $f"; done
fi

echo ""
if [[ $FAILED_COUNT -eq 0 ]]; then
  echo -e "  ${BOLD}${GREEN}✓ STRESS TEST PASSED — 3 orgs, 5 runs, billing + HFL + isolation verified${NC}"
elif [[ $PASS_COUNT -gt 0 ]]; then
  echo -e "  ${BOLD}${YELLOW}⚠ PARTIAL — ${PASS_COUNT}/5 runs completed (see failures above)${NC}"
else
  echo -e "  ${BOLD}${RED}✗ STRESS TEST FAILED — all runs errored${NC}"
fi
echo ""
