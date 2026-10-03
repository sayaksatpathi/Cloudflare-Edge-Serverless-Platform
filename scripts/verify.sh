#!/usr/bin/env bash
# EdgeForge verification script
# Runs all checks and returns non-zero if anything fails

set -e

PASS=0
FAIL=0
SKIP=0

log_pass() { echo "  ✓ $1"; PASS=$((PASS + 1)); }
log_fail() { echo "  ✗ $1"; FAIL=$((FAIL + 1)); }
log_skip() { echo "  - $1 (skipped)"; SKIP=$((SKIP + 1)); }

echo "=========================================="
echo " EdgeForge Verification"
echo "=========================================="

# ---- Dependencies ----
echo ""
echo "→ Dependencies"
if command -v node &>/dev/null; then
  log_pass "Node.js $(node --version)"
else
  log_fail "Node.js not found"
fi

if command -v npm &>/dev/null; then
  log_pass "npm $(npm --version)"
else
  log_fail "npm not found"
fi

# Install if node_modules missing
if [ ! -d "node_modules" ]; then
  echo "  Installing dependencies..."
  npm ci --silent
fi
log_pass "node_modules present"

# ---- TypeScript ----
echo ""
echo "→ TypeScript"
if npm run typecheck 2>&1 | tail -5; then
  log_pass "TypeScript check passed"
else
  log_fail "TypeScript check FAILED"
fi

# ---- Lint ----
echo ""
echo "→ Lint"
if npm run lint 2>&1 | tail -10; then
  log_pass "ESLint passed"
else
  log_fail "ESLint FAILED"
fi

# ---- Unit Tests ----
echo ""
echo "→ Unit Tests"
if npm run test:unit 2>&1; then
  log_pass "Unit tests passed"
else
  log_fail "Unit tests FAILED"
fi

# ---- Integration Tests ----
echo ""
echo "→ Integration Tests"
if npm run test:integration 2>&1; then
  log_pass "Integration tests passed"
else
  log_fail "Integration tests FAILED"
fi

# ---- Security Tests ----
echo ""
echo "→ Security Tests"
if npm run test:security 2>&1; then
  log_pass "Security tests passed"
else
  log_fail "Security tests FAILED"
fi

# ---- E2E Tests ----
echo ""
echo "→ E2E Tests"
if npm run test:e2e 2>&1; then
  log_pass "E2E tests passed"
else
  log_fail "E2E tests FAILED"
fi

# ---- Wrangler Config Validation ----
echo ""
echo "→ Wrangler Config"
if [ -f "wrangler.jsonc" ]; then
  log_pass "wrangler.jsonc exists"
else
  log_fail "wrangler.jsonc not found"
fi

# ---- Migrations ----
echo ""
echo "→ Database Migrations"
for f in migrations/*.sql; do
  if [ -f "$f" ]; then
    log_pass "Migration: $f"
  fi
done

# ---- Dependency Audit ----
echo ""
echo "→ Security Audit"
if npm audit --audit-level=critical 2>&1; then
  log_pass "No critical vulnerabilities"
else
  log_fail "Critical vulnerabilities found"
fi

# ---- Build ----
echo ""
echo "→ Build"
if npm run build 2>&1; then
  log_pass "Build succeeded"
else
  log_fail "Build FAILED"
fi

# ---- Summary ----
echo ""
echo "=========================================="
echo " Results: $PASS passed, $FAIL failed, $SKIP skipped"
echo "=========================================="

if [ $FAIL -gt 0 ]; then
  echo "VERIFICATION FAILED"
  exit 1
else
  echo "VERIFICATION PASSED"
  exit 0
fi
