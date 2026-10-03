# EdgeForge API Reference

Base URL: `https://your-worker.workers.dev`

All responses include `request_id` and follow this schema:
```json
{ "success": true, "request_id": "req_...", "data": {...} }
{ "success": false, "request_id": "req_...", "error": "...", "code": "..." }
```

## Authentication

### POST /api/auth/register
```json
{ "email": "user@example.com", "password": "min8chars" }
→ 201: { "token": "...", "user": { "id": "...", "email": "...", "created_at": "..." } }
```

### POST /api/auth/login
```json
{ "email": "user@example.com", "password": "..." }
→ 200: { "token": "...", "user": { ... } }
```

### POST /api/auth/logout
```
Authorization: Bearer <token>
→ 200: { "message": "Logged out successfully" }
```

### GET /api/me
```
Authorization: Bearer <token>
→ 200: { "id": "...", "email": "...", "created_at": "..." }
```

## Assets

All asset endpoints require: `Authorization: Bearer <token>`

### POST /api/assets (upload)
```
Content-Type: image/png (or any allowed type)
Content-Length: <bytes>
X-Filename: myfile.png
Body: <binary>
→ 201: { "id": "...", "filename": "...", "size_bytes": 12345, ... }
```

### GET /api/assets
```
→ 200: [{ "id": "...", "filename": "...", ... }, ...]
```

### GET /api/assets/:id
```
→ 200: { "id": "...", "filename": "...", "size_bytes": ... }
→ 404: if not found
→ 403: if not owner
```

### GET /api/assets/:id/download
```
→ 200: binary content with Content-Disposition header
```

### DELETE /api/assets/:id
```
→ 200: { "deleted": true, "id": "..." }
```

## Public (cacheable) Endpoint

### GET /api/public/assets/:id
No authentication. Returns public metadata only. Cached at the edge (KV + CDN).
```
→ 200: { "filename": "...", "content_type": "...", "size_bytes": ... }
    X-Cache: HIT | MISS
→ 404: if not found
```

## Jobs

### POST /api/jobs
```json
{ "asset_id": "...", "type": "inspect" }
→ 201: { "id": "...", "status": "queued", ... }
```

### GET /api/jobs/:id
```
→ 200: { "id": "...", "status": "success|failed|queued|running|retrying", ... }
```

## Stats

### GET /api/stats
```
Authorization: Bearer <token>
→ 200: { "total_assets": 5, "total_size_bytes": 1024000, ... }
```

## Admin (Feature Flags)

All admin endpoints require: `X-Admin-Key: <admin-key>`

### GET /api/admin/flags
### GET /api/admin/flags/:name
### PUT /api/admin/flags/:name
```json
{ "enabled": true, "description": "optional" }
```
### DELETE /api/admin/flags/:name

## Infrastructure Endpoints

### GET /
### GET /health
### GET /api/version

## Error Codes

| Code | HTTP | Meaning |
|------|------|---------|
| AUTH_REQUIRED | 401 | Missing token |
| AUTH_INVALID | 401 | Bad token |
| AUTH_EXPIRED | 401 | Expired token |
| FORBIDDEN | 403 | Wrong user |
| NOT_FOUND | 404 | Resource missing |
| VALIDATION_ERROR | 400 | Bad request data |
| CONFLICT | 409 | Duplicate resource |
| PAYLOAD_TOO_LARGE | 413 | File too large (>50MB) |
| UNSUPPORTED_MEDIA_TYPE | 415 | Bad content type |
| RATE_LIMIT_EXCEEDED | 429 | Too many requests |
| MAINTENANCE_MODE | 503 | Planned maintenance |
