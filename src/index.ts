/**
 * EdgeForge — Cloudflare Edge & Serverless Platform
 * Main Worker entry point
 */

import { RateLimiter } from './durable-objects/RateLimiter';
import { processQueue } from './queue/consumer';
import { runMaintenance } from './scheduled/maintenance';
import { handlePreflight, addResponseHeaders } from './middleware/security';
import { errorResponse, notFoundResponse } from './middleware/error-handler';
import { getOrCreateRequestId } from './middleware/request-id';
import { logInfo } from './observability/logging';
import { emitMetric } from './observability/telemetry';
import { isMaintenanceMode } from './services/storage-service';

// Route handlers
import { handleRoot, handleHealth, handleVersion } from './routes/health';
import { handleRegister, handleLogin, handleLogout, handleMe } from './routes/auth';
import {
  handleUpload,
  handleListAssets,
  handleGetAsset,
  handleDownload,
  handleDeleteAsset,
  handlePublicAssetMeta,
} from './routes/assets';
import { handleCreateJob, handleGetJob } from './routes/jobs';
import {
  handleStats,
  handleListFlags,
  handleGetFlag,
  handleSetFlag,
  handleDeleteFlag,
} from './routes/stats';

import type { Env, QueueMessage } from './types';

// Export Durable Object class
export { RateLimiter };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const requestId = getOrCreateRequestId(request);
    const startTime = Date.now();

    // Handle CORS preflight
    const preflight = handlePreflight(request);
    if (preflight) return preflight;

    let response: Response;

    try {
      // Check maintenance mode (KV read — eventually consistent)
      const maintenance = await isMaintenanceMode(env);
      if (maintenance) {
        const body = JSON.stringify({
          success: false,
          request_id: requestId,
          error: 'Service temporarily unavailable for maintenance',
          code: 'MAINTENANCE_MODE',
        });
        response = new Response(body, {
          status: 503,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '300',
          },
        });
      } else {
        response = await route(request, env, requestId);
      }
    } catch (err) {
      response = errorResponse(err, requestId);
    }

    const duration = Date.now() - startTime;
    logInfo(requestId, 'request_complete', {
      method: request.method,
      path: new URL(request.url).pathname,
      status: response.status,
      duration_ms: duration,
    });
    emitMetric('request_total', 1, { status: String(response.status) });
    if (response.status >= 500) emitMetric('request_error', 1);

    return addResponseHeaders(response, requestId);
  },

  async queue(batch: MessageBatch<QueueMessage>, env: Env): Promise<void> {
    await processQueue(batch, env);
  },

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runMaintenance(controller, env));
  },
};

async function route(request: Request, env: Env, requestId: string): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // ---- Public routes ----
  if (path === '/' && method === 'GET') return handleRoot(request, env, requestId);
  if (path === '/health' && method === 'GET') return handleHealth(request, env, requestId);
  if (path === '/api/version' && method === 'GET') return handleVersion(request, env, requestId);

  // ---- Auth routes ----
  if (path === '/api/auth/register' && method === 'POST')
    return handleRegister(request, env, requestId);
  if (path === '/api/auth/login' && method === 'POST')
    return handleLogin(request, env, requestId);
  if (path === '/api/auth/logout' && method === 'POST')
    return handleLogout(request, env, requestId);
  if (path === '/api/me' && method === 'GET') return handleMe(request, env, requestId);

  // ---- Asset routes ----
  if (path === '/api/assets' && method === 'POST') return handleUpload(request, env, requestId);
  if (path === '/api/assets' && method === 'GET') return handleListAssets(request, env, requestId);

  // Match /api/assets/:id
  const assetMatch = path.match(/^\/api\/assets\/([0-9a-f]{32})$/);
  if (assetMatch) {
    const assetId = assetMatch[1];
    if (method === 'GET') return handleGetAsset(request, env, requestId, assetId);
    if (method === 'DELETE') return handleDeleteAsset(request, env, requestId, assetId);
  }

  // Match /api/assets/:id/download
  const downloadMatch = path.match(/^\/api\/assets\/([0-9a-f]{32})\/download$/);
  if (downloadMatch && method === 'GET') {
    return handleDownload(request, env, requestId, downloadMatch[1]);
  }

  // ---- Public cacheable asset meta ----
  const publicMatch = path.match(/^\/api\/public\/assets\/([0-9a-f]{32})$/);
  if (publicMatch && method === 'GET') {
    return handlePublicAssetMeta(request, env, requestId, publicMatch[1]);
  }

  // ---- Job routes ----
  if (path === '/api/jobs' && method === 'POST') return handleCreateJob(request, env, requestId);

  const jobMatch = path.match(/^\/api\/jobs\/([0-9a-f]{32})$/);
  if (jobMatch && method === 'GET') return handleGetJob(request, env, requestId, jobMatch[1]);

  // ---- Stats ----
  if (path === '/api/stats' && method === 'GET') return handleStats(request, env, requestId);

  // ---- Admin / Feature flags ----
  if (path === '/api/admin/flags' && method === 'GET')
    return handleListFlags(request, env, requestId);

  const flagMatch = path.match(/^\/api\/admin\/flags\/([a-z0-9_]+)$/);
  if (flagMatch) {
    const flagName = flagMatch[1];
    if (method === 'GET') return handleGetFlag(request, env, requestId, flagName);
    if (method === 'PUT') return handleSetFlag(request, env, requestId, flagName);
    if (method === 'DELETE') return handleDeleteFlag(request, env, requestId, flagName);
  }

  return notFoundResponse(requestId);
}
