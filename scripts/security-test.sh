#!/usr/bin/env bash
# Security test script for EdgeForge
# Tests that security controls are active
# Usage: ./scripts/security-test.sh https://your-worker.workers.dev

BASE_URL="${1:-http://localhost:8787}"
FAIL=0

echo "Security testing: $BASE_URL"

check_header() {
  local name="$1"
  local url="$2"
  local header="$3"
  local value="$4"
  local got
  got=$(curl -s -I "$url" | grep -i "$header:" | head -1 | tr -d '\r\n')
  if echo "$got" | grep -qi "$value"; then
    echo "  ✓ $name: $header contains $value"
  else
    echo "  ✗ $name: $header missing/wrong (got: $got)"
    FAIL=$((FAIL + 1))
  fi
}

check_status() {
  local name="$1"
  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" "${@:2}")
  if [ "$status" = "401" ] || [ "$status" = "403" ] || [ "$status" = "400" ]; then
    echo "  ✓ $name ($status)"
  else
    echo "  ✗ $name (unexpected $status)"
    FAIL=$((FAIL + 1))
  fi
}

echo ""
echo "→ Security headers"
check_header "X-Content-Type-Options" "$BASE_URL/health" "X-Content-Type-Options" "nosniff"
check_header "X-Frame-Options" "$BASE_URL/health" "X-Frame-Options" "DENY"
check_header "Strict-Transport-Security" "$BASE_URL/health" "Strict-Transport-Security" "max-age"

echo ""
echo "→ Auth bypass attempts"
check_status "Assets without auth" -X GET "$BASE_URL/api/assets"
check_status "Stats without auth" -X GET "$BASE_URL/api/stats"
check_status "Me without auth" -X GET "$BASE_URL/api/me"
check_status "Admin flags without key" -X GET "$BASE_URL/api/admin/flags"

echo ""
echo "→ Input validation"
check_status "Register with no body" -X POST -H "Content-Type: application/json" -d '{}' "$BASE_URL/api/auth/register"
check_status "Login with empty" -X POST -H "Content-Type: application/json" -d '{"email":"","password":""}' "$BASE_URL/api/auth/login"

echo ""
if [ $FAIL -gt 0 ]; then
  echo "SECURITY TEST FAILED ($FAIL failures)"
  exit 1
else
  echo "SECURITY TEST PASSED"
fi
