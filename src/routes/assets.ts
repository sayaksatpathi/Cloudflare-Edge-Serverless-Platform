import {
  uploadAsset,
  listAssets,
  getAsset,
  downloadAsset,
  deleteAsset,
} from '../services/asset-service';
import { requireAuth } from '../middleware/auth';
import { checkRateLimit, getRateLimitKey } from '../middleware/rate-limit';
import { successResponse, errorResponse } from '../middleware/error-handler';
import { logInfo } from '../observability/logging';
import { emitMetric } from '../observability/telemetry';
import { getCachedMeta, setCachedMeta, publicCacheHeaders, privateCacheHeaders, invalidateCachedMeta } from '../services/cache-service';
import { d1First, d1Run } from '../bindings/d1';
import { generateId } from '../utils/ids';
import type { Env, Asset } from '../types';
import { getConfig } from '../config';

export async function handleUpload(
  request: Request,
  env: Env,
  requestId: string,
): Promise<Response> {
  const token = await requireAuth(request, env);
  await checkRateLimit(getRateLimitKey(request, token.user_id), env, requestId);

  const asset = await uploadAsset(env, token.user_id, request);

  // Record audit event
  await d1Run(
    env.DB,
    'INSERT INTO audit_events (id, user_id, event_type, resource_type, resource_id, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [generateId(), token.user_id, 'asset_upload', 'asset', asset.id, JSON.stringify({ filename: asset.filename, size: asset.size_bytes }), new Date().toISOString()],
  );

  logInfo(requestId, 'asset_upload', {
    user_id: token.user_id,
    asset_id: asset.id,
  });
  emitMetric('asset_upload', 1, { user_id: token.user_id });

  return successResponse(asset, requestId, 201);
}

export async function handleListAssets(
  request: Request,
  env: Env,
  requestId: string,
): Promise<Response> {
  const token = await requireAuth(request, env);
  const assets = await listAssets(env, token.user_id);
  return successResponse(assets, requestId);
}

export async function handleGetAsset(
  request: Request,
  env: Env,
  requestId: string,
  assetId: string,
): Promise<Response> {
  const token = await requireAuth(request, env);
  const asset = await getAsset(env, token.user_id, assetId);
  return successResponse(asset, requestId);
}

export async function handleDownload(
  request: Request,
  env: Env,
  requestId: string,
  assetId: string,
): Promise<Response> {
  const token = await requireAuth(request, env);
  await checkRateLimit(getRateLimitKey(request, token.user_id), env, requestId);

  const response = await downloadAsset(env, token.user_id, assetId, requestId);

  logInfo(requestId, 'asset_download', {
    user_id: token.user_id,
    asset_id: assetId,
  });
  emitMetric('asset_download', 1, { user_id: token.user_id });

  return response;
}

export async function handleDeleteAsset(
  request: Request,
  env: Env,
  requestId: string,
  assetId: string,
): Promise<Response> {
  const token = await requireAuth(request, env);
  await deleteAsset(env, token.user_id, assetId);
  await invalidateCachedMeta(env, assetId);

  await d1Run(
    env.DB,
    'INSERT INTO audit_events (id, user_id, event_type, resource_type, resource_id, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [generateId(), token.user_id, 'asset_delete', 'asset', assetId, '{}', new Date().toISOString()],
  );

  logInfo(requestId, 'asset_delete', {
    user_id: token.user_id,
    asset_id: assetId,
  });
  emitMetric('asset_delete', 1);

  return successResponse({ deleted: true, id: assetId }, requestId);
}

// Public (cacheable) asset metadata endpoint — no auth required
export async function handlePublicAssetMeta(
  request: Request,
  env: Env,
  requestId: string,
  assetId: string,
): Promise<Response> {
  const config = getConfig(env);

  // Check KV cache first
  const cached = await getCachedMeta(env, assetId);
  if (cached) {
    emitMetric('cache_hit', 1, { endpoint: 'public_asset_meta' });
    const headers = new Headers({
      'Content-Type': 'application/json',
      'X-Cache': 'HIT',
      ...publicCacheHeaders(config.cacheTtlSecs),
    });
    return new Response(
      JSON.stringify({ success: true, request_id: requestId, data: cached }),
      { status: 200, headers },
    );
  }

  emitMetric('cache_miss', 1, { endpoint: 'public_asset_meta' });

  // Fetch from D1 — only expose public (non-deleted) assets
  const asset = await d1First<Asset>(
    env.DB,
    "SELECT id, filename, content_type, size_bytes, created_at FROM assets WHERE id = ? AND status = 'active'",
    [assetId],
  );

  if (!asset) {
    return new Response(
      JSON.stringify({ success: false, request_id: requestId, error: 'Not found', code: 'NOT_FOUND' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const meta = {
    filename: asset.filename,
    content_type: asset.content_type,
    size_bytes: asset.size_bytes,
    cached_at: new Date().toISOString(),
  };

  // Cache in KV
  await setCachedMeta(env, assetId, meta);

  const headers = new Headers({
    'Content-Type': 'application/json',
    'X-Cache': 'MISS',
    ...publicCacheHeaders(config.cacheTtlSecs),
  });

  return new Response(
    JSON.stringify({ success: true, request_id: requestId, data: meta }),
    { status: 200, headers },
  );
}
