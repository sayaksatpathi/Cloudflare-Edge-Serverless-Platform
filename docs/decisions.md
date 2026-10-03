# EdgeForge Architecture Decision Records

## ADR-001: Durable Objects for Rate Limiting (not KV)

**Decision**: Use Durable Objects for per-user rate limiting, not Workers KV.

**Alternatives considered**:
- KV: Simple, low-latency reads. But KV is eventually consistent — two concurrent requests from the same user could read the same stale count and both pass, defeating the rate limit.
- External Redis: Would require a non-Cloudflare dependency and add latency.

**Rationale**: Durable Objects provide a single-threaded JavaScript execution context with strongly-consistent storage. Each `RateLimiter` DO instance owns one user's counter. Requests from the same user always hit the same DO instance (via `idFromName(userId)`), ensuring atomicity without distributed locking.

**Tradeoff**: DO cold starts add ~1ms on first use. Negligible at this scale.

---

## ADR-002: HMAC-SHA256 Tokens (not JWT library)

**Decision**: Implement token signing with Web Crypto API directly, no external JWT library.

**Alternatives considered**:
- `jsonwebtoken` npm package: Not available in Workers runtime (Node.js-specific).
- `jose` library (Web Crypto-based): Would work, but adds a dependency for a function that's ~30 lines of code.

**Rationale**: Workers run in a V8 isolate with the Web Crypto API available. Implementing PBKDF2 and HMAC-SHA256 directly keeps dependencies minimal and makes the security model explicit and auditable. The custom implementation is functionally equivalent to standard HMAC-signed JWTs.

---

## ADR-003: Soft Deletes for Assets

**Decision**: Asset deletion sets `status='deleted'` in D1 and deletes from R2; it does not remove the D1 row.

**Alternatives considered**:
- Hard delete: Remove the D1 row entirely. Simpler, but loses audit trail.
- Soft delete in D1 only: Keep D1 row, keep R2 object. Wastes storage; deleted assets would still be accessible if someone had the object key.

**Rationale**: Keeping the D1 row preserves the audit trail and prevents ID reuse. Deleting from R2 immediately prevents unauthorized access to the file content. The `status='active'` filter in list/get queries ensures deleted assets are invisible to users.

---

## ADR-004: D1 for Metadata, R2 for Blobs

**Decision**: Never store binary data in D1. All file content goes in R2.

**Rationale**: D1 is SQLite — storing large blobs would inflate database size, slow queries, and hit row size limits. R2 is purpose-built for object storage (S3-compatible, zero egress fees). Metadata (filename, content_type, size, owner) stays in D1 for relational queries; the blob lives in R2 keyed by a structured path.

---

## ADR-005: No Gradual Deployment in CI (Capability Exists)

**Decision**: Production CI deploys 100% of traffic directly. The wrangler commands for gradual rollout are documented but not wired into the workflow.

**Rationale**: Gradual rollout (`wrangler versions upload` + `deployments create --percentage`) requires the Cloudflare account to have Workers paid plan enabled. This is a portfolio project without live credentials. The CI workflow uses `wrangler deploy` for simplicity; the commands for gradual rollout are in `docs/deployment.md` for reference.

**If wiring this up**: Use `wrangler versions upload`, observe error rate for 10 minutes at 10%, then promote to 100%.

---

## ADR-006: Append-Only Migrations

**Decision**: Database migrations are forward-only. No rollback migrations.

**Rationale**: D1 doesn't have a migration rollback primitive. In production, rolling back schema changes (especially adding NOT NULL columns) is risky and error-prone. Instead: add columns with defaults or as nullable, never drop columns in migrations, and handle schema evolution in application code. If a migration goes wrong, fix it with a new migration.

---

## ADR-007: Feature Flags in KV (not D1)

**Decision**: Feature flags are stored in KV, not D1.

**Rationale**: Feature flags are read on every request (maintenance mode check). KV provides sub-millisecond reads at the edge with no D1 query cost. Flags are low-frequency writes (manual operator actions), so KV's eventual consistency is acceptable — a maintenance mode flag might take a few seconds to propagate globally, which is fine.
