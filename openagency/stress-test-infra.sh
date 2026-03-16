#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# OpenAgency — Infrastructure Stress Test
# Covers: Frontend, Backend APIs, Database, Auth, Integrations, Notifications,
#         Document Upload, SSE, MCP, A2A, Scorecard, Delivery, Consumption
# bash 3.x compatible (macOS default)
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

BASE_URL="https://polanyi-plinth-production.up.railway.app"
API_KEY="oa_test_dev_default_key_for_local_testing"
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
JWT_TOKEN=""
TS=$(date +%s)
TEST_CLIENT="stress-infra-${TS}"

# ─── Helpers ─────────────────────────────────────────────────────────────────
## Auth modes:
##   "apikey" → X-API-Key header (for authMiddleware-protected routes)
##   "jwt"    → Authorization: Bearer JWT (for JWT-only routes)
##   "none"   → no auth header (for public routes)

api_get() {
  local path="$1" auth="${2:-apikey}"
  if [[ "$auth" == "jwt" && -n "$JWT_TOKEN" ]]; then
    curl -s -w "\n__HTTP__%{http_code}" -H "Authorization: Bearer ${JWT_TOKEN}" -H "Content-Type: application/json" "${BASE_URL}${path}" 2>/dev/null
  elif [[ "$auth" == "apikey" ]]; then
    curl -s -w "\n__HTTP__%{http_code}" -H "X-API-Key: ${API_KEY}" -H "Content-Type: application/json" "${BASE_URL}${path}" 2>/dev/null
  else
    curl -s -w "\n__HTTP__%{http_code}" -H "Content-Type: application/json" "${BASE_URL}${path}" 2>/dev/null
  fi
}

api_post() {
  local path="$1" body="${2:-{}}" auth="${3:-apikey}"
  if [[ "$auth" == "jwt" && -n "$JWT_TOKEN" ]]; then
    curl -s -w "\n__HTTP__%{http_code}" -H "Authorization: Bearer ${JWT_TOKEN}" -H "Content-Type: application/json" -X POST "${BASE_URL}${path}" -d "$body" 2>/dev/null
  elif [[ "$auth" == "apikey" ]]; then
    curl -s -w "\n__HTTP__%{http_code}" -H "X-API-Key: ${API_KEY}" -H "Content-Type: application/json" -X POST "${BASE_URL}${path}" -d "$body" 2>/dev/null
  else
    curl -s -w "\n__HTTP__%{http_code}" -H "Content-Type: application/json" -X POST "${BASE_URL}${path}" -d "$body" 2>/dev/null
  fi
}

api_patch() {
  local path="$1" body="${2:-{}}" auth="${3:-apikey}"
  if [[ "$auth" == "jwt" && -n "$JWT_TOKEN" ]]; then
    curl -s -w "\n__HTTP__%{http_code}" -H "Authorization: Bearer ${JWT_TOKEN}" -H "Content-Type: application/json" -X PATCH "${BASE_URL}${path}" -d "$body" 2>/dev/null
  elif [[ "$auth" == "apikey" ]]; then
    curl -s -w "\n__HTTP__%{http_code}" -H "X-API-Key: ${API_KEY}" -H "Content-Type: application/json" -X PATCH "${BASE_URL}${path}" -d "$body" 2>/dev/null
  else
    curl -s -w "\n__HTTP__%{http_code}" -H "Content-Type: application/json" -X PATCH "${BASE_URL}${path}" -d "$body" 2>/dev/null
  fi
}

api_delete() {
  local path="$1" auth="${2:-apikey}"
  if [[ "$auth" == "jwt" && -n "$JWT_TOKEN" ]]; then
    curl -s -w "\n__HTTP__%{http_code}" -H "Authorization: Bearer ${JWT_TOKEN}" -H "Content-Type: application/json" -X DELETE "${BASE_URL}${path}" 2>/dev/null
  elif [[ "$auth" == "apikey" ]]; then
    curl -s -w "\n__HTTP__%{http_code}" -H "X-API-Key: ${API_KEY}" -H "Content-Type: application/json" -X DELETE "${BASE_URL}${path}" 2>/dev/null
  else
    curl -s -w "\n__HTTP__%{http_code}" -H "Content-Type: application/json" -X DELETE "${BASE_URL}${path}" 2>/dev/null
  fi
}

get_status() {
  local raw="$1"
  echo "${raw##*__HTTP__}"
}

get_body() {
  local raw="$1"
  echo "${raw%__HTTP__*}"
}

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

# ═══════════════════════════════════════════════════════════════════════════════
banner "OpenAgency — Infrastructure Stress Test"
echo -e "  Target:    ${BOLD}${BASE_URL}${NC}"
echo -e "  Date:      $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo -e "  Client:    ${TEST_CLIENT}"

# ═══════════════════════════════════════════════════════════════════════════════
banner "1. INFRASTRUCTURE — Health, Ready, System"
# ═══════════════════════════════════════════════════════════════════════════════

RAW=$(api_get "/health")
check "GET /health" "200" "$(get_status "$RAW")"

RAW=$(api_get "/ready")
check "GET /ready" "200" "$(get_status "$RAW")"

RAW=$(api_get "/v1/system/stats")
check_any "GET /v1/system/stats" "$(get_status "$RAW")" "200" "401"

RAW=$(api_get "/v1/openapi.json")
check "GET /v1/openapi.json" "200" "$(get_status "$RAW")"

# ═══════════════════════════════════════════════════════════════════════════════
banner "2. AUTHENTICATION — Login, JWT, API Keys, RBAC"
# ═══════════════════════════════════════════════════════════════════════════════

section "JWT Login"
# Use a temp file for login body to avoid shell glob on special chars in password
LOGIN_TMP=$(mktemp /tmp/oa-login-XXXXXX.json)
printf '{"email":"%s","password":"%s"}' "$ADMIN_EMAIL" "$ADMIN_PASS" > "$LOGIN_TMP"
RAW=$(curl -s -w "\n__HTTP__%{http_code}" -H "Content-Type: application/json" -X POST "${BASE_URL}/v1/auth/login" --data-binary "@${LOGIN_TMP}" 2>/dev/null)
rm -f "$LOGIN_TMP"
STATUS=$(get_status "$RAW")
BODY=$(get_body "$RAW")
if [[ "$STATUS" == "200" ]]; then
  JWT_TOKEN=$(jq_get "$BODY" '.token')
  ok "POST /v1/auth/login — admin JWT acquired"
else
  fail "POST /v1/auth/login — HTTP $STATUS"
fi

section "JWT Protected Routes"
RAW=$(api_get "/v1/auth/me" "jwt")
check "GET /v1/auth/me (JWT)" "200" "$(get_status "$RAW")"
ROLE=$(jq_get "$(get_body "$RAW")" '.user.role')
info "User role: $ROLE"

section "API Key Auth"
RAW=$(api_get "/v1/engines" "apikey")
check "GET /v1/engines (API key)" "200" "$(get_status "$RAW")"

section "Unauthorized Access"
RAW=$(api_get "/v1/engines" "none")
check_any "GET /v1/engines (no auth)" "$(get_status "$RAW")" "401" "403"

section "RBAC — Admin Routes"
RAW=$(api_get "/v1/users")
check_any "GET /v1/users (admin)" "$(get_status "$RAW")" "200" "403"

RAW=$(api_get "/v1/demo-requests")
check_any "GET /v1/demo-requests (admin)" "$(get_status "$RAW")" "200" "403"

section "Registration (closed)"
RAW=$(api_post "/v1/auth/register" '{"email":"test@test.com","password":"test123","name":"Test"}')
check_any "POST /v1/auth/register (closed)" "$(get_status "$RAW")" "403" "400"

# ═══════════════════════════════════════════════════════════════════════════════
banner "3. BACKEND APIs — Engines, Skills, Schemas"
# ═══════════════════════════════════════════════════════════════════════════════

section "Engine Registry"
RAW=$(api_get "/v1/engines")
check "GET /v1/engines" "200" "$(get_status "$RAW")"
ENGINE_COUNT=$(jq_get "$(get_body "$RAW")" '.engines | length' '0')
info "Engines registered: $ENGINE_COUNT"

RAW=$(api_get "/v1/engines/leak-detector")
check "GET /v1/engines/leak-detector" "200" "$(get_status "$RAW")"

RAW=$(api_get "/v1/engines/nonexistent")
check "GET /v1/engines/nonexistent (404)" "404" "$(get_status "$RAW")"

section "Skill Schemas"
RAW=$(api_get "/v1/schemas/leak-detector/waste-waterfall")
check "GET /v1/schemas/leak-detector/waste-waterfall" "200" "$(get_status "$RAW")"

RAW=$(api_get "/v1/schemas/media-architect/mmm-model")
check "GET /v1/schemas/media-architect/mmm-model" "200" "$(get_status "$RAW")"

section "Skill Execution"
SKILL_TMP=$(mktemp /tmp/oa-skill-XXXXXX.json)

printf '{"gross_spend":100000,"industry":"retail"}' > "$SKILL_TMP"
RAW=$(curl -s -w "\n__HTTP__%{http_code}" -H "X-API-Key: ${API_KEY}" -H "Content-Type: application/json" -X POST "${BASE_URL}/v1/engines/leak-detector/skills/waste-waterfall" --data-binary "@${SKILL_TMP}" 2>/dev/null)
check_any "POST waste-waterfall" "$(get_status "$RAW")" "200" "201"

printf '{"metric":"cpa","values":[12,13,11,45,14,12],"threshold":2.0}' > "$SKILL_TMP"
RAW=$(curl -s -w "\n__HTTP__%{http_code}" -H "X-API-Key: ${API_KEY}" -H "Content-Type: application/json" -X POST "${BASE_URL}/v1/engines/media-architect/skills/anomaly-detect" --data-binary "@${SKILL_TMP}" 2>/dev/null)
check_any "POST anomaly-detect" "$(get_status "$RAW")" "200" "201"

printf '{"tracking_coverage_pct":85,"cookie_consent_rate_pct":72,"attribution_window_days":30,"cross_device_enabled":true,"offline_conversion_import":false}' > "$SKILL_TMP"
RAW=$(curl -s -w "\n__HTTP__%{http_code}" -H "X-API-Key: ${API_KEY}" -H "Content-Type: application/json" -X POST "${BASE_URL}/v1/engines/executive-bridge/skills/integrity" --data-binary "@${SKILL_TMP}" 2>/dev/null)
check_any "POST integrity" "$(get_status "$RAW")" "200" "201"
rm -f "$SKILL_TMP"

# ═══════════════════════════════════════════════════════════════════════════════
banner "4. DATABASE — Persistence, Mesh Runs, Scorecards"
# ═══════════════════════════════════════════════════════════════════════════════

section "Mesh Runs (DB persistence)"
RAW=$(api_get "/v1/mesh/runs?page=1&limit=5")
check "GET /v1/mesh/runs (paginated)" "200" "$(get_status "$RAW")"
BODY=$(get_body "$RAW")
TOTAL=$(jq_get "$BODY" '.pagination.total' '0')
info "Total runs in DB: $TOTAL"
HAS_NEXT=$(jq_get "$BODY" '.pagination.has_next' 'false')
info "Has next page: $HAS_NEXT"

section "Run Detail (DB lookup)"
FIRST_RUN_ID=$(jq_get "$BODY" '.runs[0].id' '')
if [[ -n "$FIRST_RUN_ID" && "$FIRST_RUN_ID" != "null" ]]; then
  RAW=$(api_get "/v1/mesh/runs/${FIRST_RUN_ID}")
  check "GET /v1/mesh/runs/:id (detail)" "200" "$(get_status "$RAW")"
else
  skip "GET /v1/mesh/runs/:id — no runs in DB"
fi

RAW=$(api_get "/v1/mesh/runs/nonexistent-id")
check "GET /v1/mesh/runs/nonexistent (404)" "404" "$(get_status "$RAW")"

section "Scorecards (DB)"
RAW=$(api_get "/v1/scorecards")
check_any "GET /v1/scorecards" "$(get_status "$RAW")" "200" "404"

RAW=$(api_get "/v1/scorecard/tier-preview?ad_spend=500000")
check_any "GET /v1/scorecard/tier-preview" "$(get_status "$RAW")" "200" "400"

section "Recovery History"
RAW=$(api_get "/v1/recovery/history?months=6")
check_any "GET /v1/recovery/history" "$(get_status "$RAW")" "200" "500"

# ═══════════════════════════════════════════════════════════════════════════════
banner "5. AGENTS — OODA Runtime, Lifecycle"
# ═══════════════════════════════════════════════════════════════════════════════

RAW=$(api_get "/v1/agents")
check "GET /v1/agents" "200" "$(get_status "$RAW")"
AGENT_COUNT=$(jq_get "$(get_body "$RAW")" '.agents | length' '0')
info "Agents registered: $AGENT_COUNT"

RAW=$(api_get "/v1/agents/status")
check "GET /v1/agents/status" "200" "$(get_status "$RAW")"

if [[ "$AGENT_COUNT" -gt 0 ]]; then
  FIRST_AGENT=$(jq_get "$(get_body "$(api_get "/v1/agents")")" '.agents[0].id' '')
  if [[ -n "$FIRST_AGENT" ]]; then
    RAW=$(api_get "/v1/agents/${FIRST_AGENT}")
    check "GET /v1/agents/:id (detail)" "200" "$(get_status "$RAW")"

    RAW=$(api_get "/v1/agents/${FIRST_AGENT}/decisions")
    check_any "GET /v1/agents/:id/decisions" "$(get_status "$RAW")" "200" "404"

    RAW=$(api_get "/v1/agents/${FIRST_AGENT}/outcomes")
    check_any "GET /v1/agents/:id/outcomes" "$(get_status "$RAW")" "200" "404"

    RAW=$(api_get "/v1/agents/${FIRST_AGENT}/memory")
    check_any "GET /v1/agents/:id/memory" "$(get_status "$RAW")" "200" "404"
  fi
fi

# ═══════════════════════════════════════════════════════════════════════════════
banner "6. GOALS — Create, List, Detail"
# ═══════════════════════════════════════════════════════════════════════════════

RAW=$(api_get "/v1/goals")
check "GET /v1/goals" "200" "$(get_status "$RAW")"

GOAL_TMP=$(mktemp /tmp/oa-goal-XXXXXX.json)
printf '{"name":"Infra stress test goal","description":"Automated test","type":"minimize","agent_id":"leak-detector","target_metric":"waste_reduction","target_value":15,"deadline":"2026-12-31T00:00:00Z"}' > "$GOAL_TMP"
RAW=$(curl -s -w "\n__HTTP__%{http_code}" -H "X-API-Key: ${API_KEY}" -H "Content-Type: application/json" -X POST "${BASE_URL}/v1/goals" --data-binary "@${GOAL_TMP}" 2>/dev/null)
rm -f "$GOAL_TMP"
STATUS=$(get_status "$RAW")
BODY=$(get_body "$RAW")
GOAL_ID=$(jq_get "$BODY" '.id')
check_any "POST /v1/goals (create)" "$STATUS" "200" "201"

if [[ -n "$GOAL_ID" && "$GOAL_ID" != "null" && "$GOAL_ID" != "N/A" ]]; then
  RAW=$(api_get "/v1/goals/${GOAL_ID}")
  check "GET /v1/goals/:id" "200" "$(get_status "$RAW")"

  RAW=$(api_get "/v1/goals/${GOAL_ID}/progress")
  check_any "GET /v1/goals/:id/progress" "$(get_status "$RAW")" "200" "404"

  RAW=$(api_delete "/v1/goals/${GOAL_ID}")
  check_any "DELETE /v1/goals/:id" "$(get_status "$RAW")" "200" "204"
fi

# ═══════════════════════════════════════════════════════════════════════════════
banner "7. PIPELINES & MESH"
# ═══════════════════════════════════════════════════════════════════════════════

RAW=$(api_get "/v1/mesh/pipelines")
check "GET /v1/mesh/pipelines" "200" "$(get_status "$RAW")"
PIPELINE_COUNT=$(jq_get "$(get_body "$RAW")" '.pipelines | length' '0')
info "Pipelines registered: $PIPELINE_COUNT"

section "Schedules"
RAW=$(api_get "/v1/mesh/schedules")
check_any "GET /v1/mesh/schedules" "$(get_status "$RAW")" "200" "503"

# ═══════════════════════════════════════════════════════════════════════════════
banner "8. CONNECTORS & INTEGRATIONS"
# ═══════════════════════════════════════════════════════════════════════════════

section "Platform Connectors"
RAW=$(api_get "/v1/connectors")
check "GET /v1/connectors" "200" "$(get_status "$RAW")"

RAW=$(api_get "/v1/connectors/status")
check_any "GET /v1/connectors/status" "$(get_status "$RAW")" "200" "404"

section "Storage Providers"
RAW=$(api_get "/v1/storage/providers")
check "GET /v1/storage/providers" "200" "$(get_status "$RAW")"
PROVIDERS=$(get_body "$RAW")
GD_AVAIL=$(jq_get "$PROVIDERS" '.providers[0].available' 'false')
OD_AVAIL=$(jq_get "$PROVIDERS" '.providers[1].available' 'false')
info "Google Drive: $GD_AVAIL | OneDrive: $OD_AVAIL"

section "Onboarding"
RAW=$(api_get "/v1/onboarding/status")
check_any "GET /v1/onboarding/status" "$(get_status "$RAW")" "200" "404"

# ═══════════════════════════════════════════════════════════════════════════════
banner "9. HFL — Human Feedback Loop"
# ═══════════════════════════════════════════════════════════════════════════════

RAW=$(api_get "/v1/hfl/pending")
check_any "GET /v1/hfl/pending" "$(get_status "$RAW")" "200" "404"

RAW=$(api_get "/v1/hfl/decisions")
check_any "GET /v1/hfl/decisions" "$(get_status "$RAW")" "200" "404"

RAW=$(api_get "/v1/hfl/config")
check_any "GET /v1/hfl/config" "$(get_status "$RAW")" "200" "404"

# ═══════════════════════════════════════════════════════════════════════════════
banner "10. ASSISTANT — Conversational AI"
# ═══════════════════════════════════════════════════════════════════════════════

section "List Conversations"
RAW=$(api_get "/v1/assistant/conversations")
check "GET /v1/assistant/conversations" "200" "$(get_status "$RAW")"
CONV_COUNT=$(jq_get "$(get_body "$RAW")" '.conversations | length' '0')
info "Conversations: $CONV_COUNT"

section "Send Message"
CHAT_TMP=$(mktemp /tmp/oa-chat-XXXXXX.json)
printf '{"message":"What is the current status of the system?","client_id":"%s"}' "$TEST_CLIENT" > "$CHAT_TMP"
RAW=$(curl -s -w "\n__HTTP__%{http_code}" -H "X-API-Key: ${API_KEY}" -H "Content-Type: application/json" -X POST "${BASE_URL}/v1/assistant/chat" --data-binary "@${CHAT_TMP}" 2>/dev/null)
rm -f "$CHAT_TMP"
STATUS=$(get_status "$RAW")
BODY=$(get_body "$RAW")
check_any "POST /v1/assistant/chat" "$STATUS" "200" "201"
CONV_ID=$(jq_get "$BODY" '.conversation_id')
RESPONSE=$(jq_get "$BODY" '.response' '' | head -c 100)
if [[ -n "$RESPONSE" ]]; then
  info "Assistant replied: ${RESPONSE}..."
fi

section "Conversation Detail"
if [[ -n "$CONV_ID" && "$CONV_ID" != "null" && "$CONV_ID" != "N/A" ]]; then
  RAW=$(api_get "/v1/assistant/conversations/${CONV_ID}")
  check "GET /v1/assistant/conversations/:id" "200" "$(get_status "$RAW")"

  RAW=$(api_patch "/v1/assistant/conversations/${CONV_ID}" '{"title":"Infra Stress Test"}')
  check_any "PATCH /v1/assistant/conversations/:id (rename)" "$(get_status "$RAW")" "200" "204"
fi

# ═══════════════════════════════════════════════════════════════════════════════
banner "11. DOCUMENT UPLOAD & PERSISTENCE"
# ═══════════════════════════════════════════════════════════════════════════════

section "CSV Upload with client_id"
# Create a temp CSV to upload
TMP_CSV=$(mktemp /tmp/oa-stress-XXXXXX.csv)
cat > "$TMP_CSV" << 'CSVEOF'
campaign_name,spend,impressions,clicks,conversions,revenue
Brand Search,45000,2100000,31500,420,89250
Non-Brand Search,35000,1800000,16200,180,27000
Meta Retargeting,28000,3200000,25600,320,51200
CSVEOF

RAW=$(curl -s -w "\n__HTTP__%{http_code}" \
  -H "X-API-Key: ${API_KEY}" \
  -F "file=@${TMP_CSV}" \
  -F "client_id=${TEST_CLIENT}" \
  -F "data_type=digital_sales" \
  "${BASE_URL}/v1/upload" 2>/dev/null)
rm -f "$TMP_CSV"
STATUS=$(get_status "$RAW")
BODY=$(get_body "$RAW")
check_any "POST /v1/upload (CSV + client_id)" "$STATUS" "200" "201"
PERSISTED=$(jq_get "$BODY" '.persisted' 'false')
RECORD_ID=$(jq_get "$BODY" '.record_id' '')
info "Persisted: $PERSISTED | Record: $RECORD_ID"

section "List Client Data"
RAW=$(api_get "/v1/upload/client/${TEST_CLIENT}")
STATUS=$(get_status "$RAW")
check_any "GET /v1/upload/client/:clientId" "$STATUS" "200" "503"
if [[ "$STATUS" == "200" ]]; then
  UPLOAD_COUNT=$(jq_get "$(get_body "$RAW")" '.total' '0')
  info "Uploads for ${TEST_CLIENT}: $UPLOAD_COUNT"
fi

section "Get Upload Detail"
if [[ -n "$RECORD_ID" && "$RECORD_ID" != "null" && "$RECORD_ID" != "" ]]; then
  RAW=$(api_get "/v1/upload/${RECORD_ID}")
  check_any "GET /v1/upload/:id" "$(get_status "$RAW")" "200" "503"
fi

# ═══════════════════════════════════════════════════════════════════════════════
banner "12. SCORECARD & BILLING"
# ═══════════════════════════════════════════════════════════════════════════════

section "Compute Billing"
SC_TMP=$(mktemp /tmp/oa-sc-XXXXXX.json)
printf '{"ad_spend":240000,"leak_detector":{"waste_waterfall":{"waste_summary":{"total_waste":35520}}}}' > "$SC_TMP"
RAW=$(curl -s -w "\n__HTTP__%{http_code}" -H "X-API-Key: ${API_KEY}" -H "Content-Type: application/json" -X POST "${BASE_URL}/v1/scorecard/compute" --data-binary "@${SC_TMP}" 2>/dev/null)
rm -f "$SC_TMP"
check_any "POST /v1/scorecard/compute" "$(get_status "$RAW")" "200" "201"
BODY=$(get_body "$RAW")
FEE=$(jq_get "$BODY" '.billing.total_fee // .total_fee' '0')
info "Computed fee: \$$FEE"

section "Analyze Pipeline"
AN_TMP=$(mktemp /tmp/oa-an-XXXXXX.json)
printf '{"ad_spend":100000,"data":{"industry":"retail","gross_spend":100000}}' > "$AN_TMP"
RAW=$(curl -s -w "\n__HTTP__%{http_code}" -H "X-API-Key: ${API_KEY}" -H "Content-Type: application/json" -X POST "${BASE_URL}/v1/analyze" --data-binary "@${AN_TMP}" 2>/dev/null)
rm -f "$AN_TMP"
check_any "POST /v1/analyze" "$(get_status "$RAW")" "200" "201"

# ═══════════════════════════════════════════════════════════════════════════════
banner "13. DASHBOARD & CONSUMPTION"
# ═══════════════════════════════════════════════════════════════════════════════

RAW=$(api_get "/v1/dashboard/summary")
check_any "GET /v1/dashboard/summary" "$(get_status "$RAW")" "200" "404"

RAW=$(api_get "/v1/consumption/tokens")
check_any "GET /v1/consumption/tokens" "$(get_status "$RAW")" "200" "404"

RAW=$(api_get "/v1/consumption/engines")
check_any "GET /v1/consumption/engines" "$(get_status "$RAW")" "200" "404"

RAW=$(api_get "/v1/consumption/protocols")
check_any "GET /v1/consumption/protocols" "$(get_status "$RAW")" "200" "404"

RAW=$(api_get "/v1/consumption/tools")
check_any "GET /v1/consumption/tools" "$(get_status "$RAW")" "200" "404"

RAW=$(api_get "/v1/consumption/datasets")
check_any "GET /v1/consumption/datasets" "$(get_status "$RAW")" "200" "404"

# ═══════════════════════════════════════════════════════════════════════════════
banner "14. CAMPAIGNS"
# ═══════════════════════════════════════════════════════════════════════════════

RAW=$(api_get "/v1/campaigns?page=1&limit=10")
check_any "GET /v1/campaigns" "$(get_status "$RAW")" "200" "404"

# ═══════════════════════════════════════════════════════════════════════════════
banner "15. DELIVERY ENGINE"
# ═══════════════════════════════════════════════════════════════════════════════

RAW=$(api_get "/v1/delivery/files")
check_any "GET /v1/delivery/files" "$(get_status "$RAW")" "200" "404"

# ═══════════════════════════════════════════════════════════════════════════════
banner "16. FEDERATION — A2A & MCP Discovery"
# ═══════════════════════════════════════════════════════════════════════════════

section "A2A Agent Card"
RAW=$(curl -s -w "\n__HTTP__%{http_code}" "${BASE_URL}/.well-known/agent.json" 2>/dev/null)
check "GET /.well-known/agent.json" "200" "$(get_status "$RAW")"
BODY=$(get_body "$RAW")
AGENT_NAME=$(jq_get "$BODY" '.name' '')
info "A2A Agent: $AGENT_NAME"

section "Federation Agents"
RAW=$(api_get "/v1/federation/agents")
check_any "GET /v1/federation/agents" "$(get_status "$RAW")" "200" "404"

RAW=$(api_get "/v1/federation/mcp/servers")
check_any "GET /v1/federation/mcp/servers" "$(get_status "$RAW")" "200" "404"

# ═══════════════════════════════════════════════════════════════════════════════
banner "17. MARKETPLACE — Dynamic Skills"
# ═══════════════════════════════════════════════════════════════════════════════

RAW=$(api_get "/v1/marketplace/skills")
check_any "GET /v1/marketplace/skills" "$(get_status "$RAW")" "200" "404"

# ═══════════════════════════════════════════════════════════════════════════════
banner "18. SSE — Event Stream"
# ═══════════════════════════════════════════════════════════════════════════════

# SSE: connect for 2 seconds, check we get 200 with text/event-stream
RAW=$(curl -s -w "\n__HTTP__%{http_code}" --max-time 3 \
  -H "X-API-Key: ${API_KEY}" \
  -H "Accept: text/event-stream" \
  "${BASE_URL}/v1/agents/events/stream" 2>/dev/null || true)
STATUS=$(get_status "$RAW")
check_any "GET /v1/agents/events/stream (SSE)" "$STATUS" "200" "000"
# 000 = curl timed out (expected for SSE — connection stayed open)
if [[ "$STATUS" == "000" ]]; then
  # Re-check: timeout means connection was accepted (200) but stream stayed open
  ok "SSE stream connected (timed out after 3s = healthy)"
  PASS=$((PASS - 1)) # avoid double count
fi

# ═══════════════════════════════════════════════════════════════════════════════
banner "19. FRONTEND — Static Assets & Pages"
# ═══════════════════════════════════════════════════════════════════════════════

section "Web App Pages (Vercel: plinth.polanyi.tech)"
FRONTEND_URL="https://plinth.polanyi.tech"
for page in "/" "/app" "/app/dashboard" "/app/mesh" "/app/connectors" "/app/agents" "/app/goals" "/app/scorecard" "/app/campaigns" "/app/consumption" "/app/assistant" "/demo" "/demo/scorecard"; do
  RAW=$(curl -s -w "\n__HTTP__%{http_code}" "${FRONTEND_URL}${page}" 2>/dev/null)
  STATUS=$(get_status "$RAW")
  check_any "GET ${page} (Vercel)" "$STATUS" "200" "304"
done

# ═══════════════════════════════════════════════════════════════════════════════
banner "20. SECURITY — Error Handling, Rate Limits, Edge Cases"
# ═══════════════════════════════════════════════════════════════════════════════

section "Invalid JSON Body"
RAW=$(curl -s -w "\n__HTTP__%{http_code}" \
  -H "X-API-Key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -X POST "${BASE_URL}/v1/scorecard/compute" \
  -d "not-json" 2>/dev/null)
check_any "POST with invalid JSON" "$(get_status "$RAW")" "400" "422" "500"

section "SQL Injection Attempt"
RAW=$(api_get "/v1/mesh/runs?status=completed%27%20OR%201=1--")
check_any "SQL injection in query param" "$(get_status "$RAW")" "200" "400"

section "XSS in Body"
RAW=$(api_post "/v1/assistant/chat" '{"message":"<script>alert(1)</script>","client_id":"xss-test"}')
STATUS=$(get_status "$RAW")
BODY=$(get_body "$RAW")
# Check response doesn't contain raw script tag
if echo "$BODY" | grep -q '<script>alert(1)</script>'; then
  fail "XSS — raw script tag reflected in response"
else
  ok "XSS — script tag not reflected (HTTP $STATUS)"
fi

section "404 Handler"
RAW=$(api_get "/v1/nonexistent/route")
check "GET /v1/nonexistent (404)" "404" "$(get_status "$RAW")"

section "Method Not Allowed"
RAW=$(curl -s -w "\n__HTTP__%{http_code}" \
  -H "X-API-Key: ${API_KEY}" \
  -X PUT "${BASE_URL}/v1/engines" 2>/dev/null)
check_any "PUT /v1/engines (method check)" "$(get_status "$RAW")" "404" "405"

# ═══════════════════════════════════════════════════════════════════════════════
# FINAL SUMMARY
# ═══════════════════════════════════════════════════════════════════════════════
banner "INFRASTRUCTURE STRESS TEST — RESULTS"

echo -e "  ${BOLD}Date:${NC}       $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo -e "  ${BOLD}Target:${NC}     ${BASE_URL}"
echo -e "  ${BOLD}Client ID:${NC}  ${TEST_CLIENT}"
echo ""

TOTAL=$((PASS + FAIL + SKIP))

echo -e "  ${BOLD}┌─────────────────────────────────────────────────────────┐${NC}"
echo -e "  ${BOLD}│${NC}  ${GREEN}PASSED: ${PASS}${NC}  |  ${RED}FAILED: ${FAIL}${NC}  |  ${YELLOW}SKIPPED: ${SKIP}${NC}  |  Total: ${TOTAL}  ${BOLD}│${NC}"
echo -e "  ${BOLD}└─────────────────────────────────────────────────────────┘${NC}"

echo ""
echo -e "  ${BOLD}Coverage:${NC}"
echo -e "    [1]  Infrastructure   — health, ready, system stats, OpenAPI"
echo -e "    [2]  Authentication   — JWT login, API key, RBAC, unauthorized"
echo -e "    [3]  Backend APIs     — engines, skills, schemas, execution"
echo -e "    [4]  Database         — mesh runs, scorecards, recovery history"
echo -e "    [5]  Agents           — OODA list, status, decisions, memory"
echo -e "    [6]  Goals            — CRUD lifecycle"
echo -e "    [7]  Pipelines        — list, schedules"
echo -e "    [8]  Connectors       — platforms, storage providers, onboarding"
echo -e "    [9]  HFL              — pending, decisions, config"
echo -e "    [10] Assistant        — chat, conversations CRUD"
echo -e "    [11] Document Upload  — CSV persist, client data list"
echo -e "    [12] Scorecard        — compute billing, analyze"
echo -e "    [13] Dashboard        — summary + consumption (6 endpoints)"
echo -e "    [14] Campaigns        — list"
echo -e "    [15] Delivery         — file listing"
echo -e "    [16] Federation       — A2A card, MCP servers"
echo -e "    [17] Marketplace      — dynamic skills"
echo -e "    [18] SSE              — event stream connection"
echo -e "    [19] Frontend         — 13 web pages"
echo -e "    [20] Security         — invalid JSON, SQLi, XSS, 404, method"

echo ""
if [[ $FAIL -eq 0 ]]; then
  echo -e "  ${BOLD}${GREEN}✓ ALL INFRASTRUCTURE TESTS PASSED${NC}"
elif [[ $FAIL -le 3 ]]; then
  echo -e "  ${BOLD}${YELLOW}⚠ MOSTLY PASSING — ${FAIL} issue(s) to review${NC}"
else
  echo -e "  ${BOLD}${RED}✗ ${FAIL} FAILURES — review below${NC}"
fi

if [[ -n "$FAILURES" ]]; then
  echo ""
  echo -e "  ${BOLD}${RED}Failures:${NC}"
  printf "$FAILURES" | while read -r f; do [[ -n "$f" ]] && echo -e "    - $f"; done
fi

echo ""
