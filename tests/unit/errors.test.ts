import { describe, it, expect } from 'vitest';
import {
  ApiError,
  AuthError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  RateLimitError,
  ConflictError,
  PayloadTooLargeError,
  UnsupportedMediaTypeError,
} from '../../src/utils/errors';

describe('Error classes', () => {
  it('ApiError has correct properties', () => {
    const e = new ApiError(400, 'bad request', 'BAD_REQ');
    expect(e.statusCode).toBe(400);
    expect(e.message).toBe('bad request');
    expect(e.code).toBe('BAD_REQ');
    expect(e instanceof Error).toBe(true);
  });

  it('AuthError defaults to 401', () => {
    const e = new AuthError();
    expect(e.statusCode).toBe(401);
  });

  it('ForbiddenError defaults to 403', () => {
    expect(new ForbiddenError().statusCode).toBe(403);
  });

  it('NotFoundError defaults to 404', () => {
    const e = new NotFoundError('Asset');
    expect(e.statusCode).toBe(404);
    expect(e.message).toContain('Asset');
  });

  it('ValidationError defaults to 400', () => {
    expect(new ValidationError('bad').statusCode).toBe(400);
  });

  it('RateLimitError has resetAt and remaining', () => {
    const e = new RateLimitError(9999, 0);
    expect(e.statusCode).toBe(429);
    expect(e.resetAt).toBe(9999);
    expect(e.remaining).toBe(0);
  });

  it('ConflictError defaults to 409', () => {
    expect(new ConflictError('dup').statusCode).toBe(409);
  });

  it('PayloadTooLargeError is 413', () => {
    const e = new PayloadTooLargeError(1024);
    expect(e.statusCode).toBe(413);
    expect(e.message).toContain('1024');
  });

  it('UnsupportedMediaTypeError is 415', () => {
    expect(new UnsupportedMediaTypeError('text/html').statusCode).toBe(415);
  });
});
