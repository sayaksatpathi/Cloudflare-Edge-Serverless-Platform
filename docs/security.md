# EdgeForge Security Model

## Authentication

- Password hashing: PBKDF2-SHA256, 100,000 iterations, 16-byte random salt
- Tokens: HMAC-SHA256 signed JWTs (no external dependency)
- Token expiry: 24 hours (configurable via `TOKEN_EXPIRY_SECS`)
- No plaintext passwords stored or logged

## Authorization

- Every authenticated endpoint verifies `user_id` from token against resource owner
- IDOR protection: `validateObjectKey(key, userId)` enforces ownership on every R2 access
- Admin endpoints require separate `X-Admin-Key` header (secret-stored)

## Rate Limiting

- Implemented via Durable Objects (per-user atomic state, not KV polling)
- Default: 60 requests / 60 seconds per user
- Returns 429 with `Retry-After` and `X-RateLimit-*` headers

## Input Validation

- Email: RFC 5322-compatible regex
- Password: 8-128 characters
- Filenames: Path separators stripped, control characters removed, max 255 chars
- Content types: Allowlist of safe MIME types (no executable types)
- File size: Configurable max (default 50MB), validated on both Content-Length and actual body
- Asset IDs: Must match `/^[0-9a-f]{32}$/` — no injection possible
- Job types: Explicit allowlist (`inspect`, `thumbnail`, `transform`)

## Security Headers

Applied to every response:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`
- `Referrer-Policy: strict-origin-when-cross-origin`

## Cache Privacy

- Authenticated responses: `Cache-Control: private, no-store, no-cache`
- Public metadata endpoint: `Cache-Control: public, max-age=300, s-maxage=300`
- Downloads always: `Cache-Control: private, no-store`

## Object Storage Security

- Object keys follow `users/<userId>/assets/<assetId>` pattern
- Both `userId` and `assetId` are 32-char hex strings — no path traversal possible
- Key validated on every operation with `validateObjectKey()`
- Content-Disposition set to `attachment` to prevent browser execution

## Secrets

- `JWT_SECRET`: Required for token signing (min 32 chars)
- `ADMIN_API_KEY`: Required for admin endpoints
- Set via `wrangler secret put` — never in `wrangler.jsonc` or committed to git
- Local dev uses `.dev.vars` (gitignored)

## Audit Logging

Every sensitive operation writes an audit event to D1:
- user_register, user_login, user_logout
- asset_upload, asset_download, asset_delete
- job_create, admin_action

## Timing Attack Mitigation

Login always performs a full PBKDF2 derivation even when the user doesn't exist, preventing user enumeration via timing differences.
