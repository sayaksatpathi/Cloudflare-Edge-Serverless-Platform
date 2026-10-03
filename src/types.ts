// Core type definitions for EdgeForge

export interface Env {
  // D1 Database
  DB: D1Database;
  // Workers KV
  KV: KVNamespace;
  // R2 Bucket
  BUCKET: R2Bucket;
  // Queue
  JOB_QUEUE: Queue;
  // Durable Object
  RATE_LIMITER: DurableObjectNamespace;
  // Environment variables
  APP_ENV: string;
  VERSION: string;
  MAX_UPLOAD_BYTES: string;
  RATE_LIMIT_REQUESTS: string;
  RATE_LIMIT_WINDOW_SECS: string;
  TOKEN_EXPIRY_SECS: string;
  CACHE_TTL_SECS: string;
  // Secrets (set via wrangler secret or .dev.vars)
  JWT_SECRET: string;
  ADMIN_API_KEY: string;
}

// ---- Auth ----

export interface User {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
}

export interface AuthToken {
  user_id: string;
  email: string;
  iat: number;
  exp: number;
}

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    created_at: string;
  };
}

// ---- Assets ----

export type AssetStatus = 'active' | 'deleted' | 'expired';

export interface Asset {
  id: string;
  user_id: string;
  object_key: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  status: AssetStatus;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
}

export interface AssetListItem {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  status: AssetStatus;
  created_at: string;
  expires_at: string | null;
}

// ---- Jobs ----

export type JobType = 'inspect' | 'thumbnail' | 'transform';
export type JobStatus = 'queued' | 'running' | 'success' | 'failed' | 'retrying';

export interface Job {
  id: string;
  user_id: string;
  asset_id: string;
  type: JobType;
  status: JobStatus;
  attempts: number;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
}

export interface CreateJobRequest {
  asset_id: string;
  type: JobType;
}

export interface QueueMessage {
  job_id: string;
  asset_id: string;
  user_id: string;
  type: JobType;
  attempt: number;
}

// ---- Downloads ----

export interface Download {
  id: string;
  asset_id: string;
  user_id: string;
  timestamp: string;
  request_id: string;
}

// ---- Audit ----

export type AuditEventType =
  | 'user_register'
  | 'user_login'
  | 'user_logout'
  | 'asset_upload'
  | 'asset_download'
  | 'asset_delete'
  | 'job_create'
  | 'admin_action';

export interface AuditEvent {
  id: string;
  user_id: string | null;
  event_type: AuditEventType;
  resource_type: string;
  resource_id: string | null;
  metadata: string; // JSON string
  created_at: string;
}

// ---- Stats ----

export interface UsageStats {
  total_assets: number;
  total_size_bytes: number;
  total_downloads: number;
  total_jobs: number;
  jobs_succeeded: number;
  jobs_failed: number;
}

// ---- Rate Limiting ----

export interface RateLimitRequest {
  key: string;
  limit: number;
  window_secs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset_at: number;
}

// ---- API Responses ----

export interface ApiResponse<T = unknown> {
  success: boolean;
  request_id: string;
  data?: T;
  error?: string;
  code?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
}

// ---- Request Context ----

export interface RequestContext {
  request_id: string;
  user?: AuthToken;
  start_time: number;
}

// ---- Feature Flags ----

export interface FeatureFlag {
  name: string;
  enabled: boolean;
  description?: string;
  updated_at?: string;
}

// ---- Telemetry ----

export interface RequestLog {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  request_id: string;
  event: string;
  user_id?: string;
  asset_id?: string;
  job_id?: string;
  method?: string;
  path?: string;
  status?: number;
  duration_ms?: number;
  error?: string;
  [key: string]: unknown;
}
