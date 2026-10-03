import { registerUser, loginUser, getMe } from '../services/auth-service';
import { requireAuth } from '../middleware/auth';
import { successResponse, errorResponse } from '../middleware/error-handler';
import { parseJsonBody } from '../utils/validation';
import { logInfo } from '../observability/logging';
import { emitMetric } from '../observability/telemetry';
import type { RegisterRequest, LoginRequest, Env } from '../types';

export async function handleRegister(
  request: Request,
  env: Env,
  requestId: string,
): Promise<Response> {
  const body = await parseJsonBody<RegisterRequest>(request);
  const result = await registerUser(env, body);
  logInfo(requestId, 'user_register', { user_id: result.user.id });
  emitMetric('request_total', 1, { event: 'register' });
  return successResponse(result, requestId, 201);
}

export async function handleLogin(
  request: Request,
  env: Env,
  requestId: string,
): Promise<Response> {
  const body = await parseJsonBody<LoginRequest>(request);
  const result = await loginUser(env, body);
  logInfo(requestId, 'user_login', { user_id: result.user.id });
  return successResponse(result, requestId);
}

export async function handleLogout(
  request: Request,
  env: Env,
  requestId: string,
): Promise<Response> {
  // Token is stateless (JWT); logout is client-side token discard
  // For token revocation, store invalidated tokens in KV (future enhancement)
  const token = await requireAuth(request, env);
  logInfo(requestId, 'user_logout', { user_id: token.user_id });
  return successResponse({ message: 'Logged out successfully' }, requestId);
}

export async function handleMe(
  request: Request,
  env: Env,
  requestId: string,
): Promise<Response> {
  const token = await requireAuth(request, env);
  const user = await getMe(env, token.user_id);
  return successResponse(user, requestId);
}
