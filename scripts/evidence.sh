#!/usr/bin/env bash
# Evidence collection script
# Runs tests and captures results to evidence/

set -e

mkdir -p evidence/test-results evidence/deployment evidence/security evidence/performance evidence/screenshots

echo "Collecting evidence..."

# Unit test results
echo "→ Unit tests"
npm run test:unit 2>&1 | tee evidence/test-results/unit.txt && echo "PASS" >> evidence/test-results/unit.txt || echo "FAIL" >> evidence/test-results/unit.txt

# Integration test results
echo "→ Integration tests"
npm run test:integration 2>&1 | tee evidence/test-results/integration.txt && echo "PASS" >> evidence/test-results/integration.txt || echo "FAIL" >> evidence/test-results/integration.txt

# Security test results
echo "→ Security tests"
npm run test:security 2>&1 | tee evidence/test-results/security.txt && echo "PASS" >> evidence/test-results/security.txt || echo "FAIL" >> evidence/test-results/security.txt

echo ""
echo "Evidence collected in evidence/"
ls -la evidence/test-results/
