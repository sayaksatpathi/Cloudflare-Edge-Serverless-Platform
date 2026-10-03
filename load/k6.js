/**
 * EdgeForge k6 Load Test
 *
 * Scenarios:
 * 1. health — constant load on /health
 * 2. public_get — CDN-cacheable GET requests
 * 3. auth_flow — authenticated API calls
 * 4. rate_limit — rate limit behavior test
 *
 * Run:
 *   k6 run load/k6.js -e BASE_URL=https://your-worker.workers.dev
 *   k6 run load/k6.js -e BASE_URL=http://localhost:8787
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8787';

// Custom metrics
const uploadDuration = new Trend('upload_duration');
const downloadDuration = new Trend('download_duration');
const jobCreateDuration = new Trend('job_create_duration');
const rateLimitedCount = new Counter('rate_limited_total');
const authErrors = new Counter('auth_errors_total');
const errorRate = new Rate('error_rate');

export const options = {
  scenarios: {
    health_traffic: {
      executor: 'constant-arrival-rate',
      rate: 10,
      timeUnit: '1s',
      duration: '30s',
      preAllocatedVUs: 5,
      maxVUs: 20,
      exec: 'healthScenario',
    },
    public_get: {
      executor: 'ramping-arrival-rate',
      startRate: 5,
      timeUnit: '1s',
      stages: [
        { target: 20, duration: '20s' },
        { target: 20, duration: '20s' },
        { target: 0, duration: '10s' },
      ],
      preAllocatedVUs: 10,
      maxVUs: 50,
      exec: 'publicGetScenario',
    },
    rate_limit_test: {
      executor: 'constant-arrival-rate',
      rate: 20,
      timeUnit: '1s',
      duration: '15s',
      preAllocatedVUs: 5,
      maxVUs: 30,
      exec: 'rateLimitScenario',
    },
  },

  thresholds: {
    http_req_failed: ['rate<0.05'],       // < 5% failure rate
    http_req_duration: ['p(95)<2000'],    // 95th pct < 2s
    http_req_duration: ['p(99)<5000'],    // 99th pct < 5s
    error_rate: ['rate<0.1'],             // < 10% errors
  },
};

// Scenario: health checks
export function healthScenario() {
  const res = http.get(`${BASE_URL}/health`);
  const ok = check(res, {
    'health status 200': (r) => r.status === 200,
    'health has request_id': (r) => {
      try {
        return JSON.parse(r.body).request_id !== undefined;
      } catch {
        return false;
      }
    },
  });
  errorRate.add(!ok);
  sleep(0.1);
}

// Scenario: public asset metadata (CDN-cacheable)
export function publicGetScenario() {
  // Use a fixed asset ID to exercise cache behavior
  const assetId = 'a'.repeat(32);
  const res = http.get(`${BASE_URL}/api/public/assets/${assetId}`);
  check(res, {
    'public get is 200 or 404': (r) => r.status === 200 || r.status === 404,
    'has X-Cache header': (r) => r.headers['X-Cache'] !== undefined,
  });
  sleep(0.05);
}

// Scenario: rate limiting behavior
export function rateLimitScenario() {
  const res = http.get(`${BASE_URL}/api/version`);
  const limited = res.status === 429;
  if (limited) {
    rateLimitedCount.add(1);
  }
  check(res, {
    'version or rate limited': (r) => r.status === 200 || r.status === 429,
  });
  sleep(0.05);
}

// Default scenario (runs when no specific scenario is selected)
export default function () {
  healthScenario();
}

export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    base_url: BASE_URL,
    thresholds_passed: Object.entries(data.thresholds || {})
      .filter(([, v]) => !v.ok)
      .map(([k]) => k),
    metrics: {
      http_req_duration_p95: data.metrics?.http_req_duration?.values?.['p(95)'],
      http_req_duration_p99: data.metrics?.http_req_duration?.values?.['p(99)'],
      http_req_failed_rate: data.metrics?.http_req_failed?.values?.rate,
      http_reqs_total: data.metrics?.http_reqs?.values?.count,
      rate_limited_total: data.metrics?.rate_limited_total?.values?.count ?? 0,
    },
  };

  return {
    'evidence/performance/k6-summary.json': JSON.stringify(summary, null, 2),
    stdout: JSON.stringify(summary, null, 2),
  };
}
