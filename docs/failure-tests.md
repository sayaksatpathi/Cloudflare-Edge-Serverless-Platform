# EdgeForge Failure Tests

This document describes failure scenarios covered by the test suite and those that require a live Cloudflare environment to test.

---

## Failure Scenarios Covered by Unit/Integration Tests

### Auth Failures

| Scenario | Test | Expected Behavior |
|----------|------|-------------------|
| Missing token | `tests/integration/auth.test.ts` | 401 `AUTH_REQUIRED` |
| Tampered token | `tests/unit/crypto.test.ts` | 401 `AUTH_INVALID` |
| Expired token | `tests/integration/auth.test.ts` | 401 `AUTH_EXPIRED` |
| Wrong JWT secret | `tests/unit/crypto.test.ts` | 401 `AUTH_INVALID` |
| Non-existent user login | `tests/integration/auth.test.ts` | Same timing as real user (timing-safe) |

### Authorization Failures

| Scenario | Test | Expected Behavior |
|----------|------|-------------------|
| IDOR: User A reads User B's asset | `tests/security/security.test.ts` | 403 `FORBIDDEN` |
| IDOR: User A deletes User B's asset | `tests/e2e/e2e.test.ts` | 403 `FORBIDDEN` |
| Admin endpoint without key | Implied by middleware tests | 401/403 |

### Input Validation Failures

| Scenario | Test | Expected Behavior |
|----------|------|-------------------|
| Path traversal in filename | `tests/security/security.test.ts` | Sanitized or 400 |
| Invalid content type | `tests/unit/utils.test.ts` | 415 `UNSUPPORTED_MEDIA_TYPE` |
| File too large | `tests/unit/utils.test.ts` | 413 `PAYLOAD_TOO_LARGE` |
| Invalid email format | `tests/unit/utils.test.ts` | 400 `VALIDATION_ERROR` |
| Invalid job type | `tests/unit/job-state.test.ts` | 400 `VALIDATION_ERROR` |

### Rate Limit Failures

| Scenario | Test | Expected Behavior |
|----------|------|-------------------|
| Exceed 60 req/60s | `tests/unit/rate-limiter.test.ts` | 429 with `Retry-After` |
| Window reset after expiry | `tests/unit/rate-limiter.test.ts` | Requests allowed again |
| GET to rate limiter DO | `tests/unit/rate-limiter.test.ts` | 405 Method Not Allowed |

### Error Handler Failures

| Scenario | Test | Expected Behavior |
|----------|------|-------------------|
| Unknown error thrown | `tests/integration/middleware.test.ts` | 500 with sanitized message |
| ApiError thrown | `tests/integration/middleware.test.ts` | Correct HTTP status |
| RateLimitError thrown | `tests/integration/middleware.test.ts` | 429 with headers |

---

## Failure Scenarios Requiring Live Environment

**Status: NOT EXECUTED** — These require a deployed Cloudflare environment.

### Queue Consumer Failures

- Job processing fails on attempt 1: should retry (status → `retrying`)
- Job processing fails 3 times: should dead-letter (status → `failed`, acked)
- R2 object missing when consumer processes job: should fail job gracefully

### Durable Object Failures

- DO evicted mid-window: should reset counter (acceptable behavior)
- DO storage write failure: returns 500 (atomicity guaranteed by DO)

### Maintenance Mode

- `maintenance_mode` flag set in KV: all API endpoints return 503
- Flag unset: normal operation resumes

### Cron Trigger Failures

- `cleanExpiredAssets` with no expired assets: no-op, no errors
- `detectStuckJobs` with no stuck jobs: no-op

### Infrastructure Failures

- D1 unavailable: 500 with `INTERNAL_ERROR` code
- R2 unavailable: 500 on upload/download
- KV unavailable: feature flags default to disabled (fail-open for most, fail-safe for maintenance mode)

---

## How to Run Locally Available Tests

```bash
# All tests
npm test

# Just security tests
npm run test:security

# Just unit tests (includes rate limiter DO tests)
npm run test:unit

# E2E (simulated, no live deployment)
npm run test:e2e
```
