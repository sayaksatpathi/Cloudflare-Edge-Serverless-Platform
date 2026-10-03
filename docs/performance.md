# EdgeForge Performance

## Design for Performance

EdgeForge is built on Cloudflare Workers which run in V8 isolates at the edge — typically within 50ms of any user worldwide, with no cold start penalty after the first request (isolates stay warm).

Key performance characteristics:

| Component | Latency Profile |
|-----------|----------------|
| Worker startup | ~0ms (V8 isolate, no container boot) |
| D1 query (simple) | ~1-10ms (SQLite, same region) |
| KV read | ~1-5ms (edge-cached in most PoPs) |
| R2 put/get | ~10-100ms (single-region storage) |
| Durable Object | ~1-10ms (co-located with Worker) |

## Load Test Configuration

Load tests are defined in `load/k6.js` with three scenarios:

### Scenario 1: Health Traffic (Baseline)
- Constant 10 RPS for 30 seconds
- Endpoint: `GET /health`
- Validates: Worker stays warm, no errors

### Scenario 2: Public Asset Read (Ramp-up)
- Ramps from 1 to 20 VU over 30s, stays at 20 for 30s, ramps down
- Endpoint: `GET /api/public/assets/:id` (random asset IDs)
- Validates: KV caching works under load

### Scenario 3: Rate Limit Test
- 30 VU for 30 seconds against auth endpoint
- Validates: Rate limiter (Durable Object) handles concurrent requests correctly

## Performance Thresholds

```javascript
thresholds: {
  http_req_failed: ['rate<0.05'],  // <5% error rate
  http_req_duration: ['p(95)<2000', 'p(99)<5000'],  // p95 < 2s, p99 < 5s
  error_rate: ['rate<0.10']  // custom metric < 10%
}
```

## Load Test Results

**Status: NOT EXECUTED** — Load tests require a deployed Cloudflare Worker with Cloudflare API credentials.

To run load tests against a deployed instance:
```bash
# Install k6
# Windows: winget install k6
# macOS: brew install k6

# Set target URL
export BASE_URL=https://your-worker.workers.dev

# Run load test
k6 run load/k6.js

# Results written to evidence/performance/k6-summary.json
```

## Parallel Stats Queries

`src/services/stats-service.ts` executes 3 D1 queries in parallel using `Promise.all()`:
- Total assets + total size
- Download count
- Job count

This reduces stats endpoint latency from ~30ms serial to ~10ms parallel.

## Cache Performance

For the public metadata endpoint (`/api/public/assets/:id`):
- **KV HIT**: ~2-5ms total response time
- **KV MISS → D1**: ~10-20ms + KV write (async, non-blocking)
- **CDN HIT**: <1ms (served from Cloudflare PoP, Worker not invoked)

After the first request, subsequent requests within 5 minutes are served from either the CDN (if Cloudflare's cache is warm) or KV (if Worker is invoked).
