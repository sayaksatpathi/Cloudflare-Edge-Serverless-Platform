// Cache service — manages Cloudflare edge cache and KV-backed metadata cache

import { kvGet, kvPut } from '../bindings/kv';
import type { Env } from '../types';
import { getConfig } from '../config';

export interface CachedAssetMeta {
  filename: string;
  content_type: string;
  size_bytes: number;
  cached_at: string;
}

export async function getCachedMeta(
  env: Env,
  assetId: string,
): Promise<CachedAssetMeta | null> {
  return kvGet<CachedAssetMeta>(env.KV, `asset_meta:${assetId}`);
}

export async function setCachedMeta(
  env: Env,
  assetId: string,
  meta: CachedAssetMeta,
): Promise<void> {
  const config = getConfig(env);
  await kvPut(env.KV, `asset_meta:${assetId}`, meta, {
    expirationTtl: config.cacheTtlSecs,
  });
}

export async function invalidateCachedMeta(env: Env, assetId: string): Promise<void> {
  await env.KV.delete(`asset_meta:${assetId}`);
}

// Build a cache key for public asset endpoint
export function publicCacheKey(assetId: string, baseUrl: string): string {
  return `${baseUrl}/api/public/assets/${assetId}`;
}

// Cache-Control header for public (non-authenticated) responses
export function publicCacheHeaders(ttlSecs: number): Record<string, string> {
  return {
    'Cache-Control': `public, max-age=${ttlSecs}, s-maxage=${ttlSecs}`,
    Vary: 'Accept-Encoding',
  };
}

// Cache-Control header for private (authenticated) responses — NEVER cache
export function privateCacheHeaders(): Record<string, string> {
  return {
    'Cache-Control': 'private, no-store, no-cache',
    Pragma: 'no-cache',
  };
}
