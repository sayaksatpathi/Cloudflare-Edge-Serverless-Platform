import type { Env } from './types';

export interface Config {
  appEnv: string;
  version: string;
  maxUploadBytes: number;
  rateLimitRequests: number;
  rateLimitWindowSecs: number;
  tokenExpirySecs: number;
  cacheTtlSecs: number;
  jwtSecret: string;
  adminApiKey: string;
}

export function getConfig(env: Env): Config {
  return {
    appEnv: env.APP_ENV ?? 'development',
    version: env.VERSION ?? '1.0.0',
    maxUploadBytes: parseInt(env.MAX_UPLOAD_BYTES ?? '52428800', 10),
    rateLimitRequests: parseInt(env.RATE_LIMIT_REQUESTS ?? '60', 10),
    rateLimitWindowSecs: parseInt(env.RATE_LIMIT_WINDOW_SECS ?? '60', 10),
    tokenExpirySecs: parseInt(env.TOKEN_EXPIRY_SECS ?? '86400', 10),
    cacheTtlSecs: parseInt(env.CACHE_TTL_SECS ?? '300', 10),
    jwtSecret: env.JWT_SECRET ?? 'dev-secret-not-for-production-use-32c',
    adminApiKey: env.ADMIN_API_KEY ?? 'dev-admin-key',
  };
}

export const ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/json',
  'application/zip',
  'application/octet-stream',
  'video/mp4',
  'audio/mpeg',
]);

export const KV_KEYS = {
  featureFlag: (name: string) => `feature_flags:${name}`,
  sessionToken: (tokenId: string) => `sessions:${tokenId}`,
  statsCache: (userId: string) => `stats:${userId}`,
  dailyStats: (date: string) => `daily_stats:${date}`,
};

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Request-ID',
  'Access-Control-Max-Age': '86400',
};

export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
};
