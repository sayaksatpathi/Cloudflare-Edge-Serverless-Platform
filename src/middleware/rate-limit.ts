import type { Env } from '../types';
import { getConfig } from '../config';
import { RateLimitError } from '../utils/errors';

export async function checkRateLimit(
  identifier: string,
  env: Env,
  requestId: string,
): Promise<void> {
  const config = getConfig(env);
  // Get a Durable Object instance keyed by the identifier
  const id = env.RATE_LIMITER.idFromName(identifier);
  const stub = env.RATE_LIMITER.get(id);

  const response = await stub.fetch(
    new Request('https://rate-limiter/check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId,
      },
      body: JSON.stringify({
        limit: config.rateLimitRequests,
        window_secs: config.rateLimitWindowSecs,
      }),
    }),
  );

  const result = (await response.json()) as {
    allowed: boolean;
    remaining: number;
    reset_at: number;
  };

  if (!result.allowed) {
    throw new RateLimitError(result.reset_at, result.remaining);
  }
}

export function getRateLimitKey(request: Request, userId?: string): string {
  if (userId) return `user:${userId}`;
  // Fall back to CF-Connecting-IP for anonymous requests
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  return `ip:${ip}`;
}
