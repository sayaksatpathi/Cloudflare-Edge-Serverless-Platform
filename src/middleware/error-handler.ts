import { ApiError, RateLimitError } from '../utils/errors';
import { logError } from '../observability/logging';
import type { ApiResponse } from '../types';

export function errorResponse(
  error: unknown,
  requestId: string,
  statusOverride?: number,
): Response {
  if (error instanceof RateLimitError) {
    const body: ApiResponse = {
      success: false,
      request_id: requestId,
      error: error.message,
      code: error.code,
    };
    return new Response(JSON.stringify(body), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(Math.ceil((error.resetAt - Date.now() / 1000))),
        'X-RateLimit-Remaining': String(error.remaining),
        'X-RateLimit-Reset': String(error.resetAt),
      },
    });
  }

  if (error instanceof ApiError) {
    const body: ApiResponse = {
      success: false,
      request_id: requestId,
      error: error.message,
      code: error.code,
    };
    return new Response(JSON.stringify(body), {
      status: statusOverride ?? error.statusCode,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Unknown error — log it
  logError(requestId, 'unhandled_error', error);

  const body: ApiResponse = {
    success: false,
    request_id: requestId,
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
  };
  return new Response(JSON.stringify(body), {
    status: statusOverride ?? 500,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function successResponse<T>(data: T, requestId: string, status = 200): Response {
  const body: ApiResponse<T> = {
    success: true,
    request_id: requestId,
    data,
  };
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function notFoundResponse(requestId: string): Response {
  const body: ApiResponse = {
    success: false,
    request_id: requestId,
    error: 'Not found',
    code: 'NOT_FOUND',
  };
  return new Response(JSON.stringify(body), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  });
}
