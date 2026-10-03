import { describe, it, expect } from 'vitest';
import { successResponse, errorResponse, notFoundResponse } from '../../src/middleware/error-handler';
import { applySecurityHeaders, applyCorsHeaders } from '../../src/middleware/security';
import { ApiError, AuthError, ValidationError, RateLimitError } from '../../src/utils/errors';
import { getOrCreateRequestId } from '../../src/middleware/request-id';

describe('Response helpers', () => {
  it('successResponse includes success:true and data', async () => {
    const res = successResponse({ foo: 'bar' }, 'req_test');
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: { foo: string } };
    expect(body.success).toBe(true);
    expect(body.data.foo).toBe('bar');
    expect(res.headers.get('content-type')).toContain('application/json');
  });

  it('successResponse uses custom status', () => {
    const res = successResponse({}, 'req_test', 201);
    expect(res.status).toBe(201);
  });

  it('errorResponse handles ApiError', async () => {
    const res = errorResponse(new ApiError(400, 'bad input', 'BAD'), 'req_test');
    expect(res.status).toBe(400);
    const body = await res.json() as { success: boolean; code: string };
    expect(body.success).toBe(false);
    expect(body.code).toBe('BAD');
  });

  it('errorResponse handles AuthError with 401', async () => {
    const res = errorResponse(new AuthError(), 'req_test');
    expect(res.status).toBe(401);
  });

  it('errorResponse handles unknown error as 500', async () => {
    const res = errorResponse(new Error('unexpected'), 'req_test');
    expect(res.status).toBe(500);
  });

  it('errorResponse handles RateLimitError with 429 and headers', async () => {
    const resetAt = Math.floor(Date.now() / 1000) + 60;
    const res = errorResponse(new RateLimitError(resetAt, 0), 'req_test');
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBeTruthy();
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
  });

  it('notFoundResponse returns 404', async () => {
    const res = notFoundResponse('req_test');
    expect(res.status).toBe(404);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('NOT_FOUND');
  });
});

describe('Security headers', () => {
  it('applySecurityHeaders sets all required headers', () => {
    const headers = new Headers();
    applySecurityHeaders(headers);
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(headers.get('X-Frame-Options')).toBe('DENY');
    expect(headers.get('Strict-Transport-Security')).toBeTruthy();
  });

  it('applyCorsHeaders sets CORS headers', () => {
    const headers = new Headers();
    applyCorsHeaders(headers);
    expect(headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(headers.get('Access-Control-Allow-Methods')).toBeTruthy();
  });
});

describe('Request ID', () => {
  it('generates a request ID when none provided', () => {
    const req = new Request('https://example.com/');
    const id = getOrCreateRequestId(req);
    expect(id).toMatch(/^req_[0-9a-f]{24}$/);
  });

  it('accepts forwarded request ID', () => {
    const req = new Request('https://example.com/', {
      headers: { 'X-Request-ID': 'custom-id-12345' },
    });
    const id = getOrCreateRequestId(req);
    expect(id).toBe('custom-id-12345');
  });

  it('rejects malicious forwarded ID', () => {
    const req = new Request('https://example.com/', {
      headers: { 'X-Request-ID': '../../../etc/passwd' },
    });
    const id = getOrCreateRequestId(req);
    expect(id).toMatch(/^req_/);
  });
});
