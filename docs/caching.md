# EdgeForge Caching Strategy

## Overview

EdgeForge uses a two-layer caching approach: KV at the application layer for metadata, and Cloudflare's CDN layer for public endpoints.

---

## Layer 1: Workers KV (Application Cache)

KV is used for:
- **Feature flags**: Read on every request. KV's low-latency reads are ideal for this pattern.
- **Asset metadata cache**: Public endpoint caches `filename`, `content_type`, `size_bytes` under key `asset_meta:<assetId>`.

KV key patterns (from `src/config.ts`):
```
feature:maintenance_mode       → FeatureFlag
feature:<name>                 → FeatureFlag
asset_meta:<assetId>           → { filename, content_type, size_bytes, created_at }
```

TTL for metadata cache: 5 minutes (300 seconds, configurable via `CACHE_TTL_SECS`).

Cache invalidation: `invalidateCachedMeta(assetId, env)` is called on asset delete.

**KV consistency**: KV is eventually consistent. A recently uploaded asset may not appear in cache immediately — the public metadata endpoint will fall through to D1 on a miss and then populate the cache.

---

## Layer 2: CDN (HTTP Cache-Control)

### Private Endpoints (all authenticated routes)

```
Cache-Control: private, no-store, no-cache
```

This prevents Cloudflare's edge cache, proxies, and browsers from storing authenticated responses. Applies to: `/api/me`, `/api/assets/*`, `/api/jobs/*`, `/api/stats`.

### Public Metadata Endpoint

```
Cache-Control: public, max-age=300, s-maxage=300
```

`GET /api/public/assets/:id` is the only CDN-cacheable endpoint. It returns:
- `filename`, `content_type`, `size_bytes`, `created_at`
- No user identity, no auth tokens

Responses also include:
- `X-Cache: HIT` when served from KV
- `X-Cache: MISS` when fetched from D1

### Downloads

Downloads always set `private, no-store` regardless of asset visibility. Binary blobs stream directly from R2 and must never be cached by intermediaries.

---

## Cache Correctness Guarantees

| Scenario | Behavior |
|----------|----------|
| Asset deleted | KV cache invalidated immediately |
| Asset uploaded | No cache entry created; first public read populates KV |
| Maintenance mode on | KV read; no cache for 503 responses |
| Auth token expired | 401 returned; no cached body involved |

---

## Why Not Cache More?

- **Asset content**: Files may be large (up to 50MB), user-specific, and require auth — caching would be complex and risky.
- **Asset lists**: User-specific, frequently changing; caching would return stale counts.
- **Job status**: Changes rapidly (queued → running → success); cache would mislead clients.
