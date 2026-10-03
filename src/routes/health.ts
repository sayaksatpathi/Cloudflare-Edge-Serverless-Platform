import { successResponse } from '../middleware/error-handler';
import type { Env } from '../types';

export async function handleHealth(request: Request, env: Env, requestId: string): Promise<Response> {
  const checks = {
    status: 'ok',
    version: env.VERSION ?? '1.0.0',
    environment: env.APP_ENV ?? 'development',
    timestamp: new Date().toISOString(),
    request_id: requestId,
    services: {
      worker: 'ok',
    },
  };
  return successResponse(checks, requestId);
}

export async function handleRoot(request: Request, env: Env, requestId: string): Promise<Response> {
  return successResponse(
    {
      name: 'EdgeForge',
      description: 'Production-Style Cloudflare Edge & Serverless Platform',
      version: env.VERSION ?? '1.0.0',
      docs: '/api/version',
    },
    requestId,
  );
}

export async function handleVersion(request: Request, env: Env, requestId: string): Promise<Response> {
  return successResponse(
    {
      version: env.VERSION ?? '1.0.0',
      environment: env.APP_ENV ?? 'development',
      runtime: 'Cloudflare Workers',
      compatibility_date: '2024-12-01',
    },
    requestId,
  );
}
