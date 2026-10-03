import { getUserStats } from '../services/stats-service';
import {
  getFeatureFlag,
  setFeatureFlag,
  listFeatureFlags,
  deleteFeatureFlag,
} from '../services/storage-service';
import { requireAuth } from '../middleware/auth';
import { requireAdmin } from '../middleware/auth';
import { successResponse } from '../middleware/error-handler';
import { parseJsonBody } from '../utils/validation';
import { ValidationError } from '../utils/errors';
import type { FeatureFlag, Env } from '../types';

export async function handleStats(
  request: Request,
  env: Env,
  requestId: string,
): Promise<Response> {
  const token = await requireAuth(request, env);
  const stats = await getUserStats(env, token.user_id);
  return successResponse(stats, requestId);
}

// Admin: list all feature flags
export async function handleListFlags(
  request: Request,
  env: Env,
  requestId: string,
): Promise<Response> {
  requireAdmin(request, env);
  const flags = await listFeatureFlags(env);
  return successResponse(flags, requestId);
}

// Admin: get specific flag
export async function handleGetFlag(
  request: Request,
  env: Env,
  requestId: string,
  flagName: string,
): Promise<Response> {
  requireAdmin(request, env);
  const flag = await getFeatureFlag(env, flagName);
  return successResponse(flag, requestId);
}

// Admin: set flag
export async function handleSetFlag(
  request: Request,
  env: Env,
  requestId: string,
  flagName: string,
): Promise<Response> {
  requireAdmin(request, env);
  const body = await parseJsonBody<Partial<FeatureFlag>>(request);
  if (typeof body.enabled !== 'boolean') {
    throw new ValidationError('"enabled" must be a boolean');
  }
  const flag: FeatureFlag = {
    name: flagName,
    enabled: body.enabled,
    description: typeof body.description === 'string' ? body.description : undefined,
  };
  await setFeatureFlag(env, flag);
  return successResponse(flag, requestId);
}

// Admin: delete flag
export async function handleDeleteFlag(
  request: Request,
  env: Env,
  requestId: string,
  flagName: string,
): Promise<Response> {
  requireAdmin(request, env);
  await deleteFeatureFlag(env, flagName);
  return successResponse({ deleted: true, name: flagName }, requestId);
}
