# EdgeForge Environments

EdgeForge uses three environments defined in `wrangler.jsonc`: default (local dev), staging, and production.

## Environment Matrix

| Property | Local Dev | Staging | Production |
|----------|-----------|---------|------------|
| `APP_ENV` | development | staging | production |
| `VERSION` | 0.0.1-dev | 0.0.1-staging | 0.0.1 |
| D1 database | edgeforge-db (local) | edgeforge-db-staging | edgeforge-db |
| KV namespace | (local emulation) | edgeforge-kv-staging | edgeforge-kv |
| R2 bucket | (local emulation) | edgeforge-assets-staging | edgeforge-assets |
| Queue | (local emulation) | edgeforge-jobs-staging | edgeforge-jobs |
| Deploy trigger | `npm run dev` | push to `main` | manual dispatch |
| Secrets | `.dev.vars` | GitHub Actions secrets | GitHub Actions secrets |

## Isolation

Staging and production environments are completely isolated:
- Separate D1 databases (no shared data)
- Separate R2 buckets (no shared files)
- Separate KV namespaces (no shared flags)
- Separate Cloudflare Worker routes

This means staging can be destroyed and recreated without affecting production.

## Wrangler Environment Config

From `wrangler.jsonc`:
```jsonc
{
  "env": {
    "staging": {
      "name": "edgeforge-staging",
      "vars": { "APP_ENV": "staging", "VERSION": "0.0.1-staging" },
      "d1_databases": [{ "binding": "DB", "database_name": "edgeforge-db-staging", ... }],
      // ... separate bindings for each service
    },
    "production": {
      "name": "edgeforge",
      "vars": { "APP_ENV": "production", "VERSION": "0.0.1" },
      // ... production bindings
    }
  }
}
```

## Secrets Per Environment

Secrets are set separately per environment via Wrangler:

```bash
# Staging
npx wrangler secret put JWT_SECRET --env staging
npx wrangler secret put ADMIN_API_KEY --env staging

# Production
npx wrangler secret put JWT_SECRET
npx wrangler secret put ADMIN_API_KEY
```

Secrets are stored encrypted by Cloudflare and never appear in config files or git.

## Local Development

Local dev uses Miniflare (Wrangler's local emulator) which emulates D1, KV, R2, Queues, and Durable Objects in-process. Wrangler creates a local SQLite database for D1, and stores KV/R2 in `.wrangler/state/`.

These local state directories are gitignored and reset on `wrangler dev` clean starts.
