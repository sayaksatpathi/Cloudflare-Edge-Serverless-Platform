import { verifyToken } from '../utils/crypto';
import { AuthError } from '../utils/errors';
import type { AuthToken, Env } from '../types';
import { getConfig } from '../config';

export async function requireAuth(request: Request, env: Env): Promise<AuthToken> {
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    throw new AuthError('Missing or invalid Authorization header', 'AUTH_REQUIRED');
  }
  const token = auth.slice(7).trim();
  const config = getConfig(env);
  try {
    const payload = await verifyToken<AuthToken>(token, config.jwtSecret);
    if (!payload.user_id || !payload.email) {
      throw new AuthError('Invalid token payload', 'AUTH_INVALID');
    }
    return payload;
  } catch (err) {
    if (err instanceof AuthError) throw err;
    const msg = err instanceof Error ? err.message : 'Invalid token';
    if (msg.includes('expired')) {
      throw new AuthError('Token expired', 'AUTH_EXPIRED');
    }
    throw new AuthError('Invalid token', 'AUTH_INVALID');
  }
}

export function requireAdmin(request: Request, env: Env): void {
  const config = getConfig(env);
  const key = request.headers.get('X-Admin-Key');
  if (!key || key !== config.adminApiKey) {
    throw new AuthError('Admin access required', 'ADMIN_REQUIRED');
  }
}
