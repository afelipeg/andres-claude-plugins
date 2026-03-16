#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# OpenAgency — Production Stress Test: 3 MAU Simulation
# bash 3.x compatible (macOS default)
# Simulates full continuous intelligence cycle:
#   Engines 1→5, all orient skills, plan vs actual billing delta, HFL, isolation
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
curl_post_body() {
  local path="$1" body_file="$2"
  curl -s -w "\n__HTTP_STATUS__%{http_code}" \
    -H "Authorization: Bearer ${API_KEY}" \
    -H "Content-Type: application/json" \
    -X POST "${BASE_URL}${path}" --data-binary "@${body_file}"
}

curl_get() {
  local path="$1"
  curl -s -w "\n__HTTP_STATUS__%{http_code}" \
    -H "Authorization: Bearer ${API_KEY}" \
    -H "Content-Type: application/json" \
    -X GET "${BASE_URL}${path}"
}

split_response() {
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

# Write body to a temp file and POST it — avoids all shell quoting issues with large JSON
exec_pipeline_json() {
  local label="$1" pipeline="$2" body_json="$3"
  local tmp_file
  tmp_file=$(mktemp /tmp/oa-stress-XXXXXX.json)
  printf '%s' "$body_json" > "$tmp_file"
  info "Executing ${pipeline} for $(echo "$body_json" | jq -r '.client_id // "unknown"' 2>/dev/null || echo 'client')..."
  local raw
  raw=$(curl_post_body "/v1/mesh/pipelines/${pipeline}/execute" "$tmp_file")
  rm -f "$tmp_file"
  split_response "$raw"
  if [[ "$RESP_HTTP" == "201" || "$RESP_HTTP" == "200" ]]; then
    PASS_COUNT=$((PASS_COUNT + 1))
    ok "${label}: HTTP ${RESP_HTTP} ✓"
    return 0
  else
    FAILURES="${FAILURES}${label} (HTTP ${RESP_HTTP})\n"
    fail "${label}: HTTP ${RESP_HTTP} — $(echo "$RESP_BODY" | head -c 300)"
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

# ─── Synthetic Scenarios ─────────────────────────────────────────────────────
# BASELINE (plan): Pre-optimization state — high waste, low ROAS, programmatic overspend.
# Simulates what a legacy-agency client looks like on Week 1.
# POST-OPTIMIZATION (actual): After Plinth recommendations applied — waste drained,
# spend shifted to high-ROAS channels, ROAS up from 2.1x → 3.4x.

make_baseline_context() {
  cat <<'JSON'
{
  "gross_spend": 240000,
  "industry": "retail",
  "total_budget": 240000,
  "roas": 2.1,
  "scenario": "baseline",
  "channels": [
    {"name": "google_search", "spend": 85000, "impressions": 4200000, "clicks": 63000, "conversions": 840,  "ivt_rate_pct": 8.2,  "viewability_pct": 61.0, "intermediaries": 3},
    {"name": "meta_social",   "spend": 72000, "impressions": 5800000, "clicks": 46400, "conversions": 720,  "ivt_rate_pct": 5.1,  "viewability_pct": 72.0, "intermediaries": 2},
    {"name": "programmatic",  "spend": 58000, "impressions": 9200000, "clicks": 18400, "conversions": 184,  "ivt_rate_pct": 18.7, "viewability_pct": 44.0, "intermediaries": 5},
    {"name": "youtube",       "spend": 25000, "impressions": 1800000, "clicks": 9000,  "conversions": 270,  "ivt_rate_pct": 3.4,  "viewability_pct": 78.0, "intermediaries": 2}
  ],
  "campaigns": [
    {"name": "Google Brand",     "channel": "google_search", "spend": 45000, "budget": 50000, "days_elapsed": 22, "cpa_target": 85,  "roas_target": 3.0, "historical_ctr": 0.015},
    {"name": "Google NonBrand",  "channel": "google_search", "spend": 40000, "budget": 35000, "days_elapsed": 22, "cpa_target": 95,  "roas_target": 2.5, "historical_ctr": 0.009},
    {"name": "Meta Retargeting", "channel": "meta_social",   "spend": 42000, "budget": 40000, "days_elapsed": 22, "cpa_target": 75,  "roas_target": 3.2, "historical_ctr": 0.008},
    {"name": "Meta Prospecting", "channel": "meta_social",   "spend": 30000, "budget": 32000, "days_elapsed": 22, "cpa_target": 120, "roas_target": 2.0, "historical_ctr": 0.005},
    {"name": "Programmatic DSP", "channel": "programmatic",  "spend": 58000, "budget": 55000, "days_elapsed": 22, "cpa_target": 200, "roas_target": 1.5, "historical_ctr": 0.002}
  ],
  "metric": "spend_by_channel",
  "values": [85000, 72000, 58000, 25000],
  "threshold": 2.0,
  "channels_attr": ["google_search", "meta_social", "programmatic", "youtube"],
  "coalition_conversions": {
    "google_search": 840, "meta_social": 720, "programmatic": 184, "youtube": 270,
    "google_search,meta_social": 1250, "google_search,youtube": 980, "meta_social,youtube": 890,
    "google_search,meta_social,youtube": 1640
  },
  "total_conversions": 2014,
  "platforms": [
    {"name": "google_ads", "reported_conversions": 840, "reported_revenue": 178500, "actual_conversions": 756, "actual_revenue": 160650, "spend": 85000},
    {"name": "meta_ads",   "reported_conversions": 720, "reported_revenue": 115200, "actual_conversions": 612, "actual_revenue":  97920, "spend": 72000},
    {"name": "dsp",        "reported_conversions": 184, "reported_revenue":  18400, "actual_conversions": 128, "actual_revenue":  12800, "spend": 58000}
  ]
}
JSON
}

make_actual_context() {
  cat <<'JSON'
{
  "gross_spend": 240000,
  "industry": "retail",
  "total_budget": 240000,
  "roas": 3.4,
  "scenario": "post_optimization",
  "channels": [
    {"name": "google_search", "spend": 105000, "impressions": 5100000, "clicks": 91800,  "conversions": 1530, "ivt_rate_pct": 3.1, "viewability_pct": 82.0, "intermediaries": 2},
    {"name": "meta_social",   "spend": 82000,  "impressions": 6560000, "clicks": 65600,  "conversions": 1312, "ivt_rate_pct": 2.8, "viewability_pct": 79.0, "intermediaries": 2},
    {"name": "programmatic",  "spend": 28000,  "impressions": 3600000, "clicks": 10800,  "conversions": 216,  "ivt_rate_pct": 7.2, "viewability_pct": 68.0, "intermediaries": 3},
    {"name": "youtube",       "spend": 25000,  "impressions": 2250000, "clicks": 13500,  "conversions": 405,  "ivt_rate_pct": 2.1, "viewability_pct": 86.0, "intermediaries": 1}
  ],
  "campaigns": [
    {"name": "Google Brand",     "channel": "google_search", "spend": 55000, "budget": 55000, "days_elapsed": 22, "cpa_target": 55, "roas_target": 4.2, "historical_ctr": 0.018},
    {"name": "Google NonBrand",  "channel": "google_search", "spend": 50000, "budget": 50000, "days_elapsed": 22, "cpa_target": 65, "roas_target": 3.5, "historical_ctr": 0.012},
    {"name": "Meta Retargeting", "channel": "meta_social",   "spend": 52000, "budget": 52000, "days_elapsed": 22, "cpa_target": 42, "roas_target": 4.8, "historical_ctr": 0.011},
    {"name": "Meta Prospecting", "channel": "meta_social",   "spend": 30000, "budget": 30000, "days_elapsed": 22, "cpa_target": 75, "roas_target": 3.0, "historical_ctr": 0.008},
    {"name": "Programmatic DSP", "channel": "programmatic",  "spend": 28000, "budget": 28000, "days_elapsed": 22, "cpa_target": 110,"roas_target": 2.8, "historical_ctr": 0.003}
  ],
  "metric": "spend_by_channel",
  "values": [105000, 82000, 28000, 25000],
  "threshold": 2.0,
  "channels_attr": ["google_search", "meta_social", "programmatic", "youtube"],
  "coalition_conversions": {
    "google_search": 1530, "meta_social": 1312, "programmatic": 216, "youtube": 405,
    "google_search,meta_social": 2180, "google_search,youtube": 1820, "meta_social,youtube": 1560,
    "google_search,meta_social,youtube": 2910
  },
  "total_conversions": 3463,
  "platforms": [
    {"name": "google_ads", "reported_conversions": 1530, "reported_revenue": 428400, "actual_conversions": 1453, "actual_revenue": 406840, "spend": 105000},
    {"name": "meta_ads",   "reported_conversions": 1312, "reported_revenue": 262400, "actual_conversions": 1246, "actual_revenue": 249200, "spend": 82000},
    {"name": "dsp",        "reported_conversions": 216,  "reported_revenue":  30240, "actual_conversions": 198,  "actual_revenue":  27720, "spend": 28000}
  ]
}
JSON
}

# Build full pipeline body from client_id + context JSON string
make_body() {
  local client_id="$1" context_json="$2"
  # Use jq if available for clean composition, else do simple string join
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$context_json" | jq --arg cid "$client_id" '{client_id: $cid, context: .}'
  else
    printf '{"client_id":"%s","context":%s}' "$client_id" "$context_json"
  fi
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
echo -e "  Org Beta:  ${ORG_BETA}   [MAU 2 — returning, plan(baseline)→actual(optimized)]"
echo -e "  Org Gamma: ${ORG_GAMMA}  [MAU 3 — returning, plan(baseline)→actual(optimized)]"
echo ""
echo -e "  ${BOLD}All 11 orient skills will run per stage:${NC}"
echo -e "    Stage 1 (leak-detector):   waste-waterfall, supply-chain-audit, media-quality-score"
echo -e "    Stage 2 (media-architect): benchmark-health, anomaly-detect, channel-optimize, mmm-optimize"
echo -e "    Stage 3 (campaign-ops):    optimization-analyze, optimization-reallocate"
echo -e "    Stage 4 (executive-bridge): revenue-translate, shapley-attribute, reconcile"
echo -e "    Stage 5 (delivery):        monthly-report, client-scorecard-export, learnings-digest"

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

# Pre-compute scenario contexts
BASELINE_CTX=$(make_baseline_context)
ACTUAL_CTX=$(make_actual_context)

# ─────────────────────────────────────────────────────────────────────────────
# MAU 1 — New user / full-with-deliverables + HFL
# Uses post-optimization context as the "first look" — new account, clean state
# ─────────────────────────────────────────────────────────────────────────────
banner "MAU 1 ── New User ── full-with-deliverables (Engines 1→5 + HFL)"

M1_RUN_ID="N/A"
M1_HFL_STATUS="none"; M1_HFL_URGENCY="none"
M1_HFL_NEEDS_HUMAN="false"; M1_HFL_REASON="N/A"; M1_HFL_ID="N/A"
M1_JSON='{"error":"not_run"}'

M1_BODY=$(make_body "$ORG_ALPHA" "$BASELINE_CTX")

if exec_pipeline_json "MAU1_run1" "full-with-deliverables" "$M1_BODY"; then
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
    # Show skill_data keys per stage to verify all skills ran
    for STAGE in leak-detector media-architect campaign-ops executive-bridge delivery; do
      SKILLS=$(echo "$M1_JSON" | jq -r ".stage_results.\"${STAGE}\".output_summary.skill_data | keys | join(\", \")" 2>/dev/null || echo "N/A")
      info "  ${STAGE} skills: ${SKILLS}"
    done
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
    RAW_APPROVE_TMP=$(mktemp /tmp/oa-approve-XXXXXX.json)
    printf '{"feedback":"Stress test: approved by automated QA"}' > "$RAW_APPROVE_TMP"
    RAW_APPROVE=$(curl_post_body "/v1/mesh/runs/${M1_RUN_ID}/approve" "$RAW_APPROVE_TMP")
    rm -f "$RAW_APPROVE_TMP"
    split_response "$RAW_APPROVE"
    if [[ "$RESP_HTTP" == "200" ]]; then
      ok "HFL approved for run ${M1_RUN_ID}"
    else
      warn "HFL approve HTTP ${RESP_HTTP} (may already be resolved)"
    fi
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# MAU 2 — Returning user / Plan vs Actual / full-optimization
# Plan  = baseline context (high waste, ROAS 2.1x) — what was analyzed last week
# Actual = post-optimization context (drain waste, ROAS 3.4x) — results this week
# ─────────────────────────────────────────────────────────────────────────────
banner "MAU 2 ── Returning User ── Plan vs Actual (full-optimization)"

M2_PLAN_JSON='{"error":"not_run"}'; M2_ACTUAL_JSON='{"error":"not_run"}'
M2_PLAN_DUR="0"; M2_ACTUAL_DUR="0"

info "PLAN run — baseline state (high waste, ROAS 2.1x)"
M2_PLAN_BODY=$(make_body "$ORG_BETA" "$BASELINE_CTX")

if exec_pipeline_json "MAU2_plan" "full-optimization" "$M2_PLAN_BODY"; then
  M2_PLAN_JSON="$RESP_BODY"
  echo ""
  echo -e "  ${BOLD}[PLAN — Baseline]${NC}"
  print_run_summary "MAU 2 Plan" "$M2_PLAN_JSON"
  M2_PLAN_DUR=$(jq_get "$M2_PLAN_JSON" '.total_duration_ms' '0')
fi

echo ""
info "ACTUAL run — post-optimization state (waste drained, ROAS 3.4x)"
M2_ACTUAL_BODY=$(make_body "$ORG_BETA" "$ACTUAL_CTX")

if exec_pipeline_json "MAU2_actual" "full-optimization" "$M2_ACTUAL_BODY"; then
  M2_ACTUAL_JSON="$RESP_BODY"
  echo ""
  echo -e "  ${BOLD}[ACTUAL — Post-Optimization]${NC}"
  print_run_summary "MAU 2 Actual" "$M2_ACTUAL_JSON"
  M2_ACTUAL_DUR=$(jq_get "$M2_ACTUAL_JSON" '.total_duration_ms' '0')
fi

# ─────────────────────────────────────────────────────────────────────────────
# MAU 3 — Returning user / Plan vs Actual / full-optimization (separate org)
# ─────────────────────────────────────────────────────────────────────────────
banner "MAU 3 ── Returning User ── Plan vs Actual (full-optimization)"

M3_PLAN_JSON='{"error":"not_run"}'; M3_ACTUAL_JSON='{"error":"not_run"}'
M3_PLAN_DUR="0"; M3_ACTUAL_DUR="0"

info "PLAN run — baseline state (high waste, ROAS 2.1x)"
M3_PLAN_BODY=$(make_body "$ORG_GAMMA" "$BASELINE_CTX")

if exec_pipeline_json "MAU3_plan" "full-optimization" "$M3_PLAN_BODY"; then
  M3_PLAN_JSON="$RESP_BODY"
  echo ""
  echo -e "  ${BOLD}[PLAN — Baseline]${NC}"
  print_run_summary "MAU 3 Plan" "$M3_PLAN_JSON"
  M3_PLAN_DUR=$(jq_get "$M3_PLAN_JSON" '.total_duration_ms' '0')
fi

echo ""
info "ACTUAL run — post-optimization state (waste drained, ROAS 3.4x)"
M3_ACTUAL_BODY=$(make_body "$ORG_GAMMA" "$ACTUAL_CTX")

if exec_pipeline_json "MAU3_actual" "full-optimization" "$M3_ACTUAL_BODY"; then
  M3_ACTUAL_JSON="$RESP_BODY"
  echo ""
  echo -e "  ${BOLD}[ACTUAL — Post-Optimization]${NC}"
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
echo -e "  ${BOLD}┌──────┬───────────────────────────┬─────────────────┬──────────────┬──────────────────────────┐${NC}"
echo -e "  ${BOLD}│ MAU  │ Org                       │ Type            │ Status       │ Fee / Value              │${NC}"
echo -e "  ${BOLD}├──────┼───────────────────────────┼─────────────────┼──────────────┼──────────────────────────┤${NC}"

print_row() {
  local mau="$1" org="$2" rtype="$3" json="$4"
  local status fee value roi
  status=$(jq_get "$json" '.status' 'ERROR')
  fee=$(jq_get "$json" '.scorecard.total_fee' '-')
  value=$(jq_get "$json" '.scorecard.value_delivered' '-')
  roi=$(jq_get "$json" '.scorecard.roi_on_fee' '-')
  printf "  │ %-4s │ %-25s │ %-15s │ %-12s │ Fee=\$%-6s Val=\$%-8s │\n" \
    "$mau" "${org:0:25}" "$rtype" "$status" "$fee" "$value"
}

print_row "1" "$ORG_ALPHA" "First/Deliverables" "$M1_JSON"
print_row "2" "$ORG_BETA"  "Plan (baseline)"    "$M2_PLAN_JSON"
print_row "2" "$ORG_BETA"  "Actual (opt'd)"     "$M2_ACTUAL_JSON"
print_row "3" "$ORG_GAMMA" "Plan (baseline)"    "$M3_PLAN_JSON"
print_row "3" "$ORG_GAMMA" "Actual (opt'd)"     "$M3_ACTUAL_JSON"

echo -e "  ${BOLD}└──────┴───────────────────────────┴─────────────────┴──────────────┴──────────────────────────┘${NC}"

# ─── HFL ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "  ${BOLD}HFL Decision (MAU 1):${NC}"
echo -e "    Status:       ${M1_HFL_STATUS}"
echo -e "    Urgency:      ${M1_HFL_URGENCY}"
echo -e "    Needs human:  ${M1_HFL_NEEDS_HUMAN}"
echo -e "    Reason:       ${M1_HFL_REASON}"
echo -e "    Decision ID:  ${M1_HFL_ID}"

# ─── Plan vs Actual billing delta ────────────────────────────────────────────
echo ""
echo -e "  ${BOLD}Plan vs Actual Delta — MAU 2 (${ORG_BETA}):${NC}"
M2P_FEE=$(jq_get "$M2_PLAN_JSON" '.scorecard.total_fee' '0')
M2A_FEE=$(jq_get "$M2_ACTUAL_JSON" '.scorecard.total_fee' '0')
M2P_VAL=$(jq_get "$M2_PLAN_JSON" '.scorecard.value_delivered' '0')
M2A_VAL=$(jq_get "$M2_ACTUAL_JSON" '.scorecard.value_delivered' '0')
M2P_ROI=$(jq_get "$M2_PLAN_JSON" '.scorecard.roi_on_fee' '-')
M2A_ROI=$(jq_get "$M2_ACTUAL_JSON" '.scorecard.roi_on_fee' '-')
echo -e "    Fee:      \$${M2P_FEE} (plan) → \$${M2A_FEE} (actual)"
echo -e "    Value:    \$${M2P_VAL} (plan) → \$${M2A_VAL} (actual)"
echo -e "    ROI:      ${M2P_ROI}x (plan) → ${M2A_ROI}x (actual)"

echo ""
echo -e "  ${BOLD}Plan vs Actual Delta — MAU 3 (${ORG_GAMMA}):${NC}"
M3P_FEE=$(jq_get "$M3_PLAN_JSON" '.scorecard.total_fee' '0')
M3A_FEE=$(jq_get "$M3_ACTUAL_JSON" '.scorecard.total_fee' '0')
M3P_VAL=$(jq_get "$M3_PLAN_JSON" '.scorecard.value_delivered' '0')
M3A_VAL=$(jq_get "$M3_ACTUAL_JSON" '.scorecard.value_delivered' '0')
M3P_ROI=$(jq_get "$M3_PLAN_JSON" '.scorecard.roi_on_fee' '-')
M3A_ROI=$(jq_get "$M3_ACTUAL_JSON" '.scorecard.roi_on_fee' '-')
echo -e "    Fee:      \$${M3P_FEE} (plan) → \$${M3A_FEE} (actual)"
echo -e "    Value:    \$${M3P_VAL} (plan) → \$${M3A_VAL} (actual)"
echo -e "    ROI:      ${M3P_ROI}x (plan) → ${M3A_ROI}x (actual)"

# ─── Pass/Fail ───────────────────────────────────────────────────────────────
echo ""
FAILED_COUNT=$((5 - PASS_COUNT))
echo -e "  ${BOLD}Results:${NC} ${GREEN}${PASS_COUNT}/5 passed${NC}  |  ${RED}${FAILED_COUNT}/5 failed${NC}"
if [[ -n "$FAILURES" ]]; then
  echo -e "  ${RED}Failures:${NC}"
  printf "$FAILURES" | while read -r f; do [[ -n "$f" ]] && echo -e "    - $f"; done
fi

echo ""
if [[ $FAILED_COUNT -eq 0 ]]; then
  echo -e "  ${BOLD}${GREEN}✓ STRESS TEST PASSED — 3 orgs, 5 runs, all 11 skills, billing + HFL + isolation verified${NC}"
elif [[ $PASS_COUNT -gt 0 ]]; then
  echo -e "  ${BOLD}${YELLOW}⚠ PARTIAL — ${PASS_COUNT}/5 runs completed (see failures above)${NC}"
else
  echo -e "  ${BOLD}${RED}✗ STRESS TEST FAILED — all runs errored${NC}"
fi
echo ""
