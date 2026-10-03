import { d1First, d1Query, d1Run } from '../bindings/d1';
import { r2Put, r2Get, r2Delete } from '../bindings/r2';
import { generateId, generateObjectKey, validateObjectKey } from '../utils/ids';
import { validateFilename, validateContentType } from '../utils/validation';
import {
  NotFoundError,
  ForbiddenError,
  PayloadTooLargeError,
  UnsupportedMediaTypeError,
} from '../utils/errors';
import type { Asset, AssetListItem, Env } from '../types';
import { getConfig } from '../config';

export async function uploadAsset(
  env: Env,
  userId: string,
  request: Request,
): Promise<Asset> {
  const config = getConfig(env);

  // Validate content type
  const contentType = request.headers.get('content-type') ?? 'application/octet-stream';
  try {
    validateContentType(contentType);
  } catch {
    throw new UnsupportedMediaTypeError(contentType);
  }

  // Validate content length
  const contentLength = parseInt(request.headers.get('content-length') ?? '0', 10);
  if (contentLength > config.maxUploadBytes) {
    throw new PayloadTooLargeError(config.maxUploadBytes);
  }

  // Validate filename from header
  const rawFilename = request.headers.get('X-Filename') ?? 'unnamed';
  const filename = validateFilename(rawFilename);

  const id = generateId();
  const objectKey = generateObjectKey(userId, id);
  const now = new Date().toISOString();
  const expiresAt = null; // No expiry by default

  // Read body (bounded)
  const body = await request.arrayBuffer();
  const sizeBytes = body.byteLength;

  if (sizeBytes > config.maxUploadBytes) {
    throw new PayloadTooLargeError(config.maxUploadBytes);
  }
  if (sizeBytes === 0) {
    throw new Error('Empty file not allowed');
  }

  // Store in R2
  await r2Put(env.BUCKET, objectKey, body, {
    httpMetadata: {
      contentType: contentType.split(';')[0].trim(),
      contentDisposition: `attachment; filename="${filename}"`,
    },
    customMetadata: {
      userId,
      assetId: id,
      filename,
    },
  });

  // Record metadata in D1
  await d1Run(
    env.DB,
    `INSERT INTO assets (id, user_id, object_key, filename, content_type, size_bytes, status, created_at, updated_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
    [id, userId, objectKey, filename, contentType.split(';')[0].trim(), sizeBytes, now, now, expiresAt],
  );

  return {
    id,
    user_id: userId,
    object_key: objectKey,
    filename,
    content_type: contentType.split(';')[0].trim(),
    size_bytes: sizeBytes,
    status: 'active',
    created_at: now,
    updated_at: now,
    expires_at: expiresAt,
  };
}

export async function listAssets(env: Env, userId: string): Promise<AssetListItem[]> {
  return d1Query<AssetListItem>(
    env.DB,
    `SELECT id, filename, content_type, size_bytes, status, created_at, expires_at
     FROM assets WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 100`,
    [userId],
  );
}

export async function getAsset(env: Env, userId: string, assetId: string): Promise<Asset> {
  const asset = await d1First<Asset>(
    env.DB,
    'SELECT * FROM assets WHERE id = ? AND status = ?',
    [assetId, 'active'],
  );
  if (!asset) throw new NotFoundError('Asset');
  // IDOR protection — only owner can access
  if (asset.user_id !== userId) throw new ForbiddenError('Access denied');
  return asset;
}

export async function downloadAsset(
  env: Env,
  userId: string,
  assetId: string,
  requestId: string,
): Promise<Response> {
  const asset = await getAsset(env, userId, assetId);

  // Validate object key to prevent injection
  if (!validateObjectKey(asset.object_key, userId)) {
    throw new ForbiddenError('Invalid object key');
  }

  const object = await r2Get(env.BUCKET, asset.object_key);
  if (!object) throw new NotFoundError('Asset file');

  // Record download
  await d1Run(
    env.DB,
    'INSERT INTO downloads (id, asset_id, user_id, timestamp, request_id) VALUES (?, ?, ?, ?, ?)',
    [generateId(), assetId, userId, new Date().toISOString(), requestId],
  );

  const headers = new Headers();
  headers.set('Content-Type', asset.content_type);
  headers.set('Content-Length', String(asset.size_bytes));
  headers.set(
    'Content-Disposition',
    `attachment; filename="${asset.filename}"`,
  );
  headers.set('Cache-Control', 'private, no-store');

  return new Response(object.body, { status: 200, headers });
}

export async function deleteAsset(env: Env, userId: string, assetId: string): Promise<void> {
  const asset = await getAsset(env, userId, assetId);

  // Soft delete in D1
  const now = new Date().toISOString();
  await d1Run(
    env.DB,
    "UPDATE assets SET status = 'deleted', updated_at = ? WHERE id = ?",
    [now, assetId],
  );

  // Delete from R2
  try {
    await r2Delete(env.BUCKET, asset.object_key);
  } catch {
    // Log but don't fail if R2 delete fails — D1 soft-delete already committed
    console.warn(`R2 delete failed for key: ${asset.object_key}`);
  }
}
