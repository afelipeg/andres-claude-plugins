#!/bin/bash
# ─── Plinth E2E Smoke Test Suite ────────────────────────────────────
# API Health, Dependency Health, Synthetic Monitoring, Load/Stress Test
# Usage: ./scripts/e2e-smoke-test.sh [BASE_URL]
#
# Requires: curl, jq (optional for pretty output)

set -euo pipefail

BASE="${1:-https://polanyi-plinth-production.up.railway.app}"
CURL="/opt/anaconda3/bin/curl"
PASS=0
FAIL=0
WARN=0
RESULTS=()

# ─── Helpers ──────────────────────────────────────────────────────────

green() { printf "\033[32m%s\033[0m" "$1"; }
red() { printf "\033[31m%s\033[0m" "$1"; }
yellow() { printf "\033[33m%s\033[0m" "$1"; }
bold() { printf "\033[1m%s\033[0m" "$1"; }

record() {
  local status="$1" name="$2" detail="${3:-}"
  if [ "$status" = "PASS" ]; then
    PASS=$((PASS + 1))
    RESULTS+=("$(green "PASS") $name ${detail:+— $detail}")
  elif [ "$status" = "WARN" ]; then
    WARN=$((WARN + 1))
    RESULTS+=("$(yellow "WARN") $name ${detail:+— $detail}")
  else
    FAIL=$((FAIL + 1))
    RESULTS+=("$(red "FAIL") $name ${detail:+— $detail}")
  fi
}

# Measure response time + status code
request() {
  local method="$1" path="$2" auth="${3:-}" body="${4:-}"
  local args=(-s -o /tmp/plinth_resp -w '%{http_code}:%{time_total}' --max-time 30)
  args+=(-X "$method")
  [ -n "$auth" ] && args+=(-H "Authorization: Bearer $auth")
  args+=(-H "Content-Type: application/json")
  [ -n "$body" ] && args+=(-d "$body")
  local result
  result=$($CURL "${args[@]}" "${BASE}${path}" 2>/dev/null || echo "000:0")
  local code time_s
  code=$(echo "$result" | cut -d: -f1)
  time_s=$(echo "$result" | cut -d: -f2)
  local resp
  resp=$(cat /tmp/plinth_resp 2>/dev/null || echo "")
  echo "${code}|${time_s}|${resp}"
}

echo ""
bold "═══════════════════════════════════════════════════════════════"
echo ""
bold "  PLINTH E2E SMOKE TEST"
echo "  Target: $BASE"
echo "  Date:   $(date '+%Y-%m-%d %H:%M:%S %Z')"
bold "═══════════════════════════════════════════════════════════════"
echo ""

# ═══════════════════════════════════════════════════════════════════════
# SECTION 1: API HEALTH CHECK
# ═══════════════════════════════════════════════════════════════════════

bold "─── 1. API HEALTH CHECK ────────────────────────────────────────"
echo ""

# 1.1 Health endpoint
IFS='|' read -r code time resp <<< "$(request GET /health)"
if [ "$code" = "200" ]; then
  record PASS "GET /health" "${time}s — $resp"
else
  record FAIL "GET /health" "HTTP $code"
fi

# 1.2 Readiness endpoint
IFS='|' read -r code time resp <<< "$(request GET /ready)"
if [ "$code" = "200" ]; then
  record PASS "GET /ready" "${time}s — $resp"
else
  record FAIL "GET /ready" "HTTP $code"
fi

# 1.3 404 handling
IFS='|' read -r code time resp <<< "$(request GET /v1/nonexistent)"
if [ "$code" = "404" ]; then
  record PASS "404 handling" "${time}s"
else
  record FAIL "404 handling" "Expected 404, got $code"
fi

# 1.4 CORS headers
CORS=$($CURL -s -I -X OPTIONS "${BASE}/v1/auth/login" -H "Origin: https://plinth.polanyi.tech" -H "Access-Control-Request-Method: POST" --max-time 10 2>/dev/null | grep -i 'access-control' | head -1 || echo "")
if [ -n "$CORS" ]; then
  record PASS "CORS headers" "present"
else
  record WARN "CORS headers" "not detected (may be OK)"
fi

echo ""

# ═══════════════════════════════════════════════════════════════════════
# SECTION 2: DEPENDENCY HEALTH CHECK
# ═══════════════════════════════════════════════════════════════════════

bold "─── 2. DEPENDENCY HEALTH CHECK ─────────────────────────────────"
echo ""

# 2.1 Database (via health seed status)
IFS='|' read -r code time resp <<< "$(request GET /health)"
if echo "$resp" | grep -q '"seeded":true'; then
  record PASS "PostgreSQL" "seeded=true, connected"
else
  record FAIL "PostgreSQL" "seed check failed"
fi

# 2.2 Auth system (login)
IFS='|' read -r code time resp <<< "$(request POST /v1/auth/login '' '{"email":"dedalo@polanyi.tech","password":"Morchis1512*"}')"
if [ "$code" = "200" ]; then
  TOKEN=$(echo "$resp" | grep -o '"token":"[^"]*"' | head -1 | cut -d'"' -f4)
  record PASS "Auth login" "${time}s — token issued"
else
  record FAIL "Auth login" "HTTP $code"
  TOKEN=""
fi

# 2.3 Auth /me endpoint
if [ -n "$TOKEN" ]; then
  IFS='|' read -r code time resp <<< "$(request GET /v1/auth/me "$TOKEN")"
  if [ "$code" = "200" ] && echo "$resp" | grep -q 'super_admin'; then
    record PASS "Auth /me" "${time}s — role=super_admin"
  else
    record FAIL "Auth /me" "HTTP $code"
  fi
fi

# 2.4 Engines loaded
IFS='|' read -r code time resp <<< "$(request GET /ready)"
if echo "$resp" | grep -q '"engines":5'; then
  record PASS "5 engines loaded" "${time}s"
else
  record WARN "Engines" "Expected 5, got: $resp"
fi

# 2.5 39 skills loaded
if echo "$resp" | grep -q '"skills":39'; then
  record PASS "39 skills loaded" ""
else
  record WARN "Skills" "Expected 39"
fi

echo ""

# ═══════════════════════════════════════════════════════════════════════
# SECTION 3: SYNTHETIC MONITORING (functional endpoints)
# ═══════════════════════════════════════════════════════════════════════

bold "─── 3. SYNTHETIC MONITORING ─────────────────────────────────────"
echo ""

if [ -z "$TOKEN" ]; then
  record FAIL "SKIP remaining tests" "No auth token"
else

  # 3.1 Super Admin — Overview
  IFS='|' read -r code time resp <<< "$(request GET /v1/admin/overview "$TOKEN")"
  if [ "$code" = "200" ]; then
    record PASS "Admin overview" "${time}s"
  else
    record FAIL "Admin overview" "HTTP $code"
  fi

  # 3.2 Admin — Users
  IFS='|' read -r code time resp <<< "$(request GET /v1/admin/users "$TOKEN")"
  if [ "$code" = "200" ]; then
    record PASS "Admin users" "${time}s"
  else
    record FAIL "Admin users" "HTTP $code"
  fi

  # 3.3 Admin — Runs
  IFS='|' read -r code time resp <<< "$(request GET /v1/admin/runs "$TOKEN")"
  if [ "$code" = "200" ]; then
    record PASS "Admin runs" "${time}s"
  else
    record FAIL "Admin runs" "HTTP $code"
  fi

  # 3.4 Admin — Tokens
  IFS='|' read -r code time resp <<< "$(request GET /v1/admin/tokens "$TOKEN")"
  if [ "$code" = "200" ]; then
    record PASS "Admin tokens" "${time}s"
  else
    record FAIL "Admin tokens" "HTTP $code"
  fi

  # 3.5 Admin — Connectors
  IFS='|' read -r code time resp <<< "$(request GET /v1/admin/connectors "$TOKEN")"
  if [ "$code" = "200" ]; then
    record PASS "Admin connectors" "${time}s"
  else
    record FAIL "Admin connectors" "HTTP $code"
  fi

  # 3.6 Admin — Federation
  IFS='|' read -r code time resp <<< "$(request GET /v1/admin/federation "$TOKEN")"
  if [ "$code" = "200" ]; then
    record PASS "Admin federation" "${time}s"
  else
    record FAIL "Admin federation" "HTTP $code"
  fi

  # 3.7 Admin — Agencies
  IFS='|' read -r code time resp <<< "$(request GET /v1/admin/agencies "$TOKEN")"
  if [ "$code" = "200" ]; then
    record PASS "Admin agencies" "${time}s"
  else
    record FAIL "Admin agencies" "HTTP $code"
  fi

  # 3.8 Admin — Quota requests
  IFS='|' read -r code time resp <<< "$(request GET /v1/admin/quota/requests "$TOKEN")"
  if [ "$code" = "200" ]; then
    record PASS "Admin quota requests" "${time}s"
  else
    record FAIL "Admin quota requests" "HTTP $code"
  fi

  # 3.9 Quota status
  IFS='|' read -r code time resp <<< "$(request GET /v1/quota/status "$TOKEN")"
  if [ "$code" = "200" ]; then
    record PASS "Quota status" "${time}s"
  else
    record FAIL "Quota status" "HTTP $code — $resp"
  fi

  # 3.10 Agency dashboard overview
  IFS='|' read -r code time resp <<< "$(request GET /v1/agency/dashboard/overview "$TOKEN")"
  if [ "$code" = "200" ]; then
    record PASS "Agency dashboard overview" "${time}s"
  else
    record FAIL "Agency dashboard overview" "HTTP $code — $resp"
  fi

  # 3.11 Agency dashboard runs
  IFS='|' read -r code time resp <<< "$(request GET /v1/agency/dashboard/runs "$TOKEN")"
  if [ "$code" = "200" ]; then
    record PASS "Agency dashboard runs" "${time}s"
  else
    record FAIL "Agency dashboard runs" "HTTP $code"
  fi

  # 3.12 Agency dashboard scorecards
  IFS='|' read -r code time resp <<< "$(request GET /v1/agency/dashboard/scorecards "$TOKEN")"
  if [ "$code" = "200" ]; then
    record PASS "Agency dashboard scorecards" "${time}s"
  else
    record FAIL "Agency dashboard scorecards" "HTTP $code"
  fi

  # 3.13 Agency dashboard connectors
  IFS='|' read -r code time resp <<< "$(request GET /v1/agency/dashboard/connectors "$TOKEN")"
  if [ "$code" = "200" ]; then
    record PASS "Agency dashboard connectors" "${time}s"
  else
    record FAIL "Agency dashboard connectors" "HTTP $code"
  fi

  # 3.14 Mesh pipelines list
  IFS='|' read -r code time resp <<< "$(request GET /v1/mesh/pipelines "$TOKEN")"
  if [ "$code" = "200" ]; then
    record PASS "Mesh pipelines" "${time}s"
  else
    record FAIL "Mesh pipelines" "HTTP $code"
  fi

  # 3.15 Mesh runs list
  IFS='|' read -r code time resp <<< "$(request GET /v1/mesh/runs "$TOKEN")"
  if [ "$code" = "200" ]; then
    record PASS "Mesh runs" "${time}s"
  else
    record FAIL "Mesh runs" "HTTP $code"
  fi

  # 3.16 Scorecard latest (404 = no data yet, expected on fresh deploy)
  IFS='|' read -r code time resp <<< "$(request GET /v1/scorecard "$TOKEN")"
  if [ "$code" = "200" ]; then
    record PASS "Scorecard" "${time}s"
  elif [ "$code" = "404" ]; then
    record PASS "Scorecard" "${time}s — no data yet (expected)"
  else
    record FAIL "Scorecard" "HTTP $code"
  fi

  # 3.17 Dashboard summary
  IFS='|' read -r code time resp <<< "$(request GET /v1/dashboard/summary "$TOKEN")"
  if [ "$code" = "200" ]; then
    record PASS "Dashboard summary" "${time}s"
  else
    record FAIL "Dashboard summary" "HTTP $code"
  fi

  # 3.18 Consumption tokens
  IFS='|' read -r code time resp <<< "$(request GET /v1/consumption/tokens "$TOKEN")"
  if [ "$code" = "200" ]; then
    record PASS "Consumption tokens" "${time}s"
  else
    record FAIL "Consumption tokens" "HTTP $code"
  fi

  # 3.19 HFL pending
  IFS='|' read -r code time resp <<< "$(request GET /v1/hfl/pending "$TOKEN")"
  if [ "$code" = "200" ]; then
    record PASS "HFL pending" "${time}s"
  else
    record FAIL "HFL pending" "HTTP $code"
  fi

  # 3.20 Schema endpoint (requires engine/skill params)
  IFS='|' read -r code time resp <<< "$(request GET /v1/schemas/leak-detector/waste-waterfall)"
  if [ "$code" = "200" ]; then
    record PASS "Schema endpoint" "${time}s"
  else
    record FAIL "Schema endpoint" "HTTP $code"
  fi

  # 3.21 A2A discovery
  IFS='|' read -r code time resp <<< "$(request GET /.well-known/agent.json)"
  if [ "$code" = "200" ]; then
    record PASS "A2A agent.json" "${time}s"
  else
    record FAIL "A2A agent.json" "HTTP $code"
  fi

  # 3.22 Auth — unauthorized access
  IFS='|' read -r code time resp <<< "$(request GET /v1/admin/overview)"
  if [ "$code" = "401" ]; then
    record PASS "Unauthorized blocked" "${time}s — 401"
  else
    record FAIL "Unauthorized blocked" "Expected 401, got $code"
  fi

  # 3.23 RBAC — non-admin role blocked
  # (skip — would need a non-admin token)

  # 3.24 Frontend
  FRONTEND_CODE=$($CURL -s -o /dev/null -w '%{http_code}' https://plinth.polanyi.tech/app/admin --max-time 10 2>/dev/null || echo "000")
  if [ "$FRONTEND_CODE" = "200" ]; then
    record PASS "Frontend (Vercel)" "200 OK"
  else
    record FAIL "Frontend (Vercel)" "HTTP $FRONTEND_CODE"
  fi

fi

echo ""

# ═══════════════════════════════════════════════════════════════════════
# SECTION 4: LOAD / STRESS TEST
# ═══════════════════════════════════════════════════════════════════════

bold "─── 4. LOAD / STRESS TEST ────────────────────────────────────────"
echo ""

# 4.1 Sequential burst — 20 requests to /health
echo "  Running 20-request burst to /health..."
TOTAL_TIME=0
BURST_FAIL=0
for i in $(seq 1 20); do
  IFS='|' read -r code time resp <<< "$(request GET /health)"
  if [ "$code" != "200" ]; then
    BURST_FAIL=$((BURST_FAIL + 1))
  fi
  TOTAL_TIME=$(echo "$TOTAL_TIME + $time" | bc 2>/dev/null || echo "$TOTAL_TIME")
done
AVG_TIME=$(echo "scale=3; $TOTAL_TIME / 20" | bc 2>/dev/null || echo "?")
if [ "$BURST_FAIL" -eq 0 ]; then
  record PASS "Sequential burst (20x /health)" "avg ${AVG_TIME}s, 0 failures"
else
  record FAIL "Sequential burst (20x /health)" "$BURST_FAIL failures"
fi

# 4.2 Concurrent burst — 10 parallel requests to /health
echo "  Running 10-concurrent burst to /health..."
CONCURRENT_FAIL=0
for i in $(seq 1 10); do
  $CURL -s -o /dev/null -w '%{http_code}\n' --max-time 15 "${BASE}/health" &
done > /tmp/plinth_concurrent 2>/dev/null
wait
while IFS= read -r line; do
  if [ "$line" != "200" ]; then
    CONCURRENT_FAIL=$((CONCURRENT_FAIL + 1))
  fi
done < /tmp/plinth_concurrent
if [ "$CONCURRENT_FAIL" -eq 0 ]; then
  record PASS "Concurrent burst (10x /health)" "0 failures"
else
  record WARN "Concurrent burst (10x /health)" "$CONCURRENT_FAIL failures"
fi

# 4.3 Auth endpoint under load — 10 sequential logins
echo "  Running 10-request burst to /v1/auth/login..."
LOGIN_FAIL=0
LOGIN_TIME=0
for i in $(seq 1 10); do
  IFS='|' read -r code time resp <<< "$(request POST /v1/auth/login '' '{"email":"dedalo@polanyi.tech","password":"Morchis1512*"}')"
  if [ "$code" != "200" ]; then
    LOGIN_FAIL=$((LOGIN_FAIL + 1))
  fi
  LOGIN_TIME=$(echo "$LOGIN_TIME + $time" | bc 2>/dev/null || echo "$LOGIN_TIME")
done
AVG_LOGIN=$(echo "scale=3; $LOGIN_TIME / 10" | bc 2>/dev/null || echo "?")
if [ "$LOGIN_FAIL" -eq 0 ]; then
  record PASS "Auth burst (10x login)" "avg ${AVG_LOGIN}s, 0 failures"
else
  record FAIL "Auth burst (10x login)" "$LOGIN_FAIL failures, avg ${AVG_LOGIN}s"
fi

# 4.4 Admin endpoint under load — 10 sequential requests
if [ -n "$TOKEN" ]; then
  echo "  Running 10-request burst to /v1/admin/overview..."
  ADMIN_FAIL=0
  ADMIN_TIME=0
  for i in $(seq 1 10); do
    IFS='|' read -r code time resp <<< "$(request GET /v1/admin/overview "$TOKEN")"
    if [ "$code" != "200" ]; then
      ADMIN_FAIL=$((ADMIN_FAIL + 1))
    fi
    ADMIN_TIME=$(echo "$ADMIN_TIME + $time" | bc 2>/dev/null || echo "$ADMIN_TIME")
  done
  AVG_ADMIN=$(echo "scale=3; $ADMIN_TIME / 10" | bc 2>/dev/null || echo "?")
  if [ "$ADMIN_FAIL" -eq 0 ]; then
    record PASS "Admin burst (10x overview)" "avg ${AVG_ADMIN}s, 0 failures"
  else
    record FAIL "Admin burst (10x overview)" "$ADMIN_FAIL failures"
  fi
fi

# 4.5 Quota endpoint under load
if [ -n "$TOKEN" ]; then
  echo "  Running 10-request burst to /v1/quota/status..."
  QUOTA_FAIL=0
  QUOTA_TIME=0
  for i in $(seq 1 10); do
    IFS='|' read -r code time resp <<< "$(request GET /v1/quota/status "$TOKEN")"
    if [ "$code" != "200" ]; then
      QUOTA_FAIL=$((QUOTA_FAIL + 1))
    fi
    QUOTA_TIME=$(echo "$QUOTA_TIME + $time" | bc 2>/dev/null || echo "$QUOTA_TIME")
  done
  AVG_QUOTA=$(echo "scale=3; $QUOTA_TIME / 10" | bc 2>/dev/null || echo "?")
  if [ "$QUOTA_FAIL" -eq 0 ]; then
    record PASS "Quota burst (10x status)" "avg ${AVG_QUOTA}s, 0 failures"
  else
    record FAIL "Quota burst (10x status)" "$QUOTA_FAIL failures"
  fi
fi

echo ""

# ═══════════════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════════════

bold "═══════════════════════════════════════════════════════════════"
echo ""
bold "  RESULTS"
echo ""

for r in "${RESULTS[@]}"; do
  echo "  $r"
done

echo ""
bold "═══════════════════════════════════════════════════════════════"
TOTAL=$((PASS + FAIL + WARN))
echo ""
echo "  $(green "PASS: $PASS")  $(red "FAIL: $FAIL")  $(yellow "WARN: $WARN")  Total: $TOTAL"
echo ""

if [ "$FAIL" -eq 0 ]; then
  green "  ✓ ALL TESTS PASSED"
  echo ""
else
  red "  ✗ $FAIL TEST(S) FAILED"
  echo ""
fi

echo ""
# Cleanup
rm -f /tmp/plinth_resp /tmp/plinth_concurrent

exit $FAIL
