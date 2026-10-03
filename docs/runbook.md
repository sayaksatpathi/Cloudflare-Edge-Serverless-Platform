# EdgeForge Runbook

## On-Call Contacts

This is a solo project. See `docs/deployment.md` for rollback procedures.

---

## Common Alerts and Responses

### 1. High Error Rate (>5% 5xx)

**Symptoms**: `npm audit` failures, smoke test returning non-2xx, Cloudflare dashboard error spike.

**Response**:
1. Check Cloudflare Workers dashboard → Real-time Logs for error patterns
2. Check for recent deployment: `npx wrangler deployments list`
3. If new deployment caused issue: `npx wrangler rollback --env production`
4. Check D1 metrics — is the database rate-limiting?
5. Check if maintenance mode was accidentally enabled: `curl .../api/admin/flags/maintenance_mode`

---

### 2. Rate Limit Errors Spiking (429s)

**Symptoms**: Users reporting 429 errors; legitimate traffic being blocked.

**Response**:
1. Check if it's brute force: look for repeated failed logins from same IP
2. If legitimate traffic: temporarily raise `RATE_LIMIT_REQUESTS` via deployment or secret
3. If attack: use Cloudflare firewall rules to block at the edge (before Worker invocation)

---

### 3. Queue Processing Stuck

**Symptoms**: Jobs stay in `queued` state for > 5 minutes.

**Response**:
1. Check Cloudflare Queues dashboard for backlog depth
2. Check Worker logs for queue consumer errors
3. Stuck jobs (running > 10 min) are auto-detected by cron at `*/30 * * * *` and marked failed
4. Manually mark stuck jobs:
   ```sql
   UPDATE jobs SET status='failed', error_message='Manual recovery', updated_at=datetime('now')
   WHERE status='running' AND updated_at < datetime('now', '-15 minutes');
   ```

---

### 4. Maintenance Mode On / Off

**Enable maintenance mode** (blocks all API requests with 503):
```bash
curl -X PUT https://your-worker.workers.dev/api/admin/flags/maintenance_mode \
  -H "X-Admin-Key: $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"enabled": true, "description": "Emergency maintenance"}'
```

**Disable maintenance mode**:
```bash
curl -X DELETE https://your-worker.workers.dev/api/admin/flags/maintenance_mode \
  -H "X-Admin-Key: $ADMIN_API_KEY"
```

---

### 5. D1 Database Query Slow

**Symptoms**: API latency spike; Cloudflare metrics show high D1 query time.

**Response**:
1. Check which queries are slow via structured logs (grep for `d1_query_ms > 100`)
2. Verify indexes exist: `migrations/0002_indexes.sql` and `migrations/0003_audit.sql`
3. If audit_events table growing large: it's append-only; queries filter by `created_at` range

---

### 6. R2 Upload Failures

**Symptoms**: 500 errors on `POST /api/assets`; logs show R2 errors.

**Response**:
1. Check R2 bucket status in Cloudflare dashboard
2. Verify `BUCKET` binding in `wrangler.jsonc` matches actual bucket name
3. Check file size: must be < 50MB (`MAX_UPLOAD_BYTES`)
4. R2 is strongly consistent for writes; check if it's a rate limit (rare at this scale)

---

### 7. Token Issues (401 / AUTH_INVALID)

**Symptoms**: Legitimate users getting 401 after deployment.

**Possible causes**:
- `JWT_SECRET` was rotated — all existing tokens are invalidated (by design)
- Token expired (24h TTL)
- Clock skew between client and server (edge Workers use system time)

**Response**: Instruct users to log out and log in again to get a new token.

---

## Deployment Checklist

- [ ] All tests pass locally: `./scripts/verify.sh`
- [ ] Migrations reviewed for backwards compatibility
- [ ] Secrets up to date in both environments
- [ ] Staging smoke test passing
- [ ] Rollback plan confirmed: `npx wrangler rollback --env production`

---

## Logs

Workers logs are available in:
- Cloudflare dashboard → Workers → edgeforge → Logs (real-time tail)
- Structured JSON via `console.log` — parseable with `jq`

All log entries include `request_id` for end-to-end tracing across a single request.
