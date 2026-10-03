# EdgeForge Threat Model

## Assets

- **Platform**: Cloudflare Workers at the edge
- **Data**: User credentials (hashed), asset metadata (D1), binary files (R2), feature flags (KV)
- **Users**: Authenticated API clients
- **Admins**: Operators with `X-Admin-Key`

---

## Threat Analysis

### 1. Malicious File Uploads

**Threat**: Attacker uploads executable, malicious, or oversized files.
**Impact**: Storage abuse, XSS via Content-Type sniffing, resource exhaustion.
**Mitigations**:
- MIME type allowlist (`ALLOWED_CONTENT_TYPES` in `config.ts`)
- `Content-Disposition: attachment` forces download, prevents browser execution
- `X-Content-Type-Options: nosniff` prevents MIME-type sniffing
- 50MB file size limit enforced on `Content-Length` AND actual body
- Empty files rejected
**Residual risk**: Malicious content inside allowed MIME types (e.g., PDF with embedded JS)

### 2. IDOR (Insecure Direct Object Reference)

**Threat**: User A accesses User B's assets by guessing asset IDs.
**Impact**: Data exfiltration, unauthorized deletion.
**Mitigations**:
- All asset/job endpoints verify `resource.user_id === token.user_id`
- Object keys include user ID: `users/<userId>/assets/<assetId>`
- `validateObjectKey()` called on every R2 operation
- Asset IDs are 128-bit random hex — not guessable
**Residual risk**: Low. Randomness provides ~2^128 space; ownership check is double protection.

### 3. Path Traversal

**Threat**: Attacker injects `../` into filenames or asset IDs to access other objects.
**Impact**: Reading or deleting arbitrary R2 objects.
**Mitigations**:
- `validateFilename()` strips all path separators before storage
- Object keys constructed from `generateObjectKey()` only — never from user input
- `validateHexId()` ensures IDs contain only `[0-9a-f]`
**Residual risk**: Negligible. Keys never interpolated from raw user input.

### 4. Cache Poisoning

**Threat**: Attacker tricks edge cache into serving their payload to other users.
**Impact**: Serving wrong data; potential information leakage.
**Mitigations**:
- Authenticated endpoints: `Cache-Control: private, no-store` — never cached by CDN
- Public endpoint only returns metadata (filename, content_type, size) — no sensitive data
- Cache key is the exact request path — no header-based cache key manipulation
- No `Vary: Cookie` or user-specific cache entries on public paths
**Residual risk**: Low. Only non-sensitive public metadata is cacheable.

### 5. Token Theft and Replay

**Threat**: Attacker steals a JWT and reuses it.
**Impact**: Full account takeover for token lifetime.
**Mitigations**:
- Tokens expire in 24 hours
- HTTPS enforced (HSTS header)
- Tokens never logged
- `verifyToken()` validates signature and expiry on every request
**Residual risk**: 24-hour window if token is stolen. Mitigated by short expiry.

### 6. Rate Limit Bypass

**Threat**: Attacker spoofs IP or distributes requests to bypass rate limits.
**Impact**: Brute-force attacks, abuse of expensive endpoints.
**Mitigations**:
- Rate limiting keyed on authenticated `user_id` when logged in
- Anonymous requests keyed on `CF-Connecting-IP` (Cloudflare ensures accuracy)
- Durable Object provides atomic state — no race conditions
**Residual risk**: Distributed attacks from many IPs/accounts.

### 7. Secret Leakage

**Threat**: JWT_SECRET or ADMIN_API_KEY exposed in code, logs, or responses.
**Impact**: Full token forgery capability.
**Mitigations**:
- Secrets set via `wrangler secret` — stored encrypted by Cloudflare
- `.dev.vars` gitignored
- Secrets never appear in responses or logs
- `.dev.vars.example` contains only placeholder values
**Residual risk**: Insider threat; GitHub Actions secret exposure.

### 8. Queue Abuse

**Threat**: Attacker floods the job queue to consume compute resources.
**Impact**: Queue backlog, processing delays, cost amplification.
**Mitigations**:
- Job creation requires authentication
- Rate limiting applies to job creation
- Asset ownership verified before job creation
**Residual risk**: Authenticated users creating excessive jobs (billing impact).

### 9. Oversized Uploads

**Threat**: 10GB upload to cause resource exhaustion.
**Impact**: Worker CPU/memory pressure, R2 storage abuse.
**Mitigations**:
- `Content-Length` validated against `MAX_UPLOAD_BYTES` before reading body
- Actual body size validated after reading
**Residual risk**: Requests without `Content-Length` may read up to limit.

### 10. Broken Authorization

**Threat**: Logic error allows cross-user data access.
**Impact**: Data exfiltration.
**Mitigations**:
- Defense-in-depth: ownership check at service layer AND object key validation
- `getAsset()` always filters by both `id` AND verifies `user_id`
- Security test suite covers IDOR scenarios
**Residual risk**: Logic bugs in future features.

### 11. CORS Mistakes

**Threat**: `Access-Control-Allow-Origin: *` enables cross-origin requests with credentials.
**Impact**: CSRF-like attacks from malicious sites.
**Current config**: `Access-Control-Allow-Origin: *` (appropriate for a public API)
**Note**: Tokens are in `Authorization` header (not cookies) — CORS wildcard is safe here.
**Residual risk**: Low. Browser won't send `Authorization` header cross-origin without explicit allow.
