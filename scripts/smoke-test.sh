#!/usr/bin/env bash
# Smoke test script for EdgeForge
# Usage: ./scripts/smoke-test.sh https://your-worker.workers.dev

set -e

BASE_URL="${1:-http://localhost:8787}"
FAIL=0

echo "Smoke testing: $BASE_URL"

check() {
  local name="$1"
  local url="$2"
  local expected="$3"
  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" "$url")
  if [ "$status" = "$expected" ]; then
    echo "  ✓ $name ($status)"
  else
    echo "  ✗ $name (got $status, expected $expected)"
    FAIL=$((FAIL + 1))
  fi
}

echo ""
echo "→ Core endpoints"
check "GET /" "$BASE_URL/" "200"
check "GET /health" "$BASE_URL/health" "200"
check "GET /api/version" "$BASE_URL/api/version" "200"
check "404 on unknown" "$BASE_URL/nonexistent" "404"

echo ""
echo "→ Auth endpoints"
check "Register (missing body)" "$BASE_URL/api/auth/register" "400"
check "Login (missing body)" "$BASE_URL/api/auth/login" "400"

echo ""
echo "→ Protected endpoints (no auth)"
check "GET /api/assets (no auth)" "$BASE_URL/api/assets" "401"
check "GET /api/stats (no auth)" "$BASE_URL/api/stats" "401"
check "GET /api/me (no auth)" "$BASE_URL/api/me" "401"

echo ""
if [ $FAIL -gt 0 ]; then
  echo "SMOKE TEST FAILED ($FAIL failures)"
  exit 1
else
  echo "SMOKE TEST PASSED"
fi
