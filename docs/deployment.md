# EdgeForge Deployment Guide

## Prerequisites

- Node.js 20+
- Wrangler CLI (`npx wrangler` or `npm install -g wrangler`)
- Cloudflare account with Workers, D1, KV, R2, Queues enabled
- GitHub repository with Actions enabled
- Secrets: `JWT_SECRET` (min 32 chars), `ADMIN_API_KEY`

---

## Local Development

```bash
# Install dependencies
npm install

# Copy example vars and fill in secrets
cp .dev.vars.example .dev.vars
# Edit .dev.vars with your local secrets (never commit this file)

# Run local dev server (bindings emulated by Miniflare)
npm run dev

# Run migrations against local D1
npm run migrate:local
```

The dev server runs at `http://localhost:8787` by default.

---

## First-Time Production Setup

### 1. Create Cloudflare Resources

```bash
# Create D1 database
npx wrangler d1 create edgeforge-db
npx wrangler d1 create edgeforge-db-staging

# Create KV namespace
npx wrangler kv:namespace create KV
npx wrangler kv:namespace create KV --env staging

# Create R2 bucket
npx wrangler r2 bucket create edgeforge-assets
npx wrangler r2 bucket create edgeforge-assets-staging

# Create Queue
npx wrangler queues create edgeforge-jobs
npx wrangler queues create edgeforge-jobs-staging
```

Update the IDs returned by these commands into `wrangler.jsonc`.

### 2. Set Secrets

```bash
# Production
npx wrangler secret put JWT_SECRET
npx wrangler secret put ADMIN_API_KEY

# Staging
npx wrangler secret put JWT_SECRET --env staging
npx wrangler secret put ADMIN_API_KEY --env staging
```

### 3. Run Migrations

```bash
npm run migrate:production
npm run migrate:staging
```

### 4. Set GitHub Secrets

In your repository settings → Secrets:
- `CLOUDFLARE_API_TOKEN` — API token with Workers:Edit, D1:Edit, KV:Edit, R2:Edit
- `CLOUDFLARE_ACCOUNT_ID`

---

## Deployment Environments

| Environment | Trigger | Command |
|-------------|---------|---------|
| Local dev | `npm run dev` | Miniflare |
| Staging | Push to `main` | `npm run deploy:staging` |
| Production | Manual workflow dispatch | `npm run deploy:production` |

---

## Staging Deployment

Automated on every push to `main`:

1. Full test suite (unit + integration + security + e2e)
2. `wrangler deploy --env staging`
3. D1 migrations for staging
4. Smoke test: `curl https://edgeforge-staging.workers.dev/health`

**Status: CONFIG VALIDATED — NOT EXECUTED** (no Cloudflare account configured locally)

---

## Production Deployment

Manual only. Requires `confirm: DEPLOY` workflow input to prevent accidental deploys.

Steps:
1. Full test suite
2. `wrangler versions upload` (uploads new version without routing traffic)
3. `wrangler deploy --env production` (routes 100% traffic to new version)
4. D1 migrations for production
5. Smoke test

For gradual rollout (not yet wired in CI — see `docs/decisions.md`):
```bash
# Upload version without deploying
npx wrangler versions upload --env production

# Route 10% traffic to new version
npx wrangler deployments create --percentage 10 --env production

# Promote to 100% after validation
npx wrangler deployments create --percentage 100 --env production
```

**Status: CONFIG VALIDATED — NOT EXECUTED**

---

## Rollback

```bash
# List recent deployments
npx wrangler deployments list --env production

# Rollback to previous version
npx wrangler rollback --env production
```

D1 schema changes require manual SQL reversal (migrations are append-only by convention).

---

## Verification After Deploy

```bash
# Run smoke test against deployed URL
BASE_URL=https://edgeforge.workers.dev ./scripts/smoke-test.sh

# Run security checks
BASE_URL=https://edgeforge.workers.dev ./scripts/security-test.sh
```
