import { describe, it, expect, beforeEach } from 'vitest';
import { hashPassword, verifyPassword, signToken, verifyToken } from '../../src/utils/crypto';
import { validateEmail, validatePassword } from '../../src/utils/validation';
import { ValidationError } from '../../src/utils/errors';

// Integration tests for auth flows (without live D1 — testing the logic layer)

describe('Auth integration: registration validation', () => {
  it('rejects missing email', () => {
    expect(() => validateEmail('')).toThrow(ValidationError);
  });

  it('rejects email without domain', () => {
    expect(() => validateEmail('user@')).toThrow(ValidationError);
  });

  it('rejects password shorter than 8', () => {
    expect(() => validatePassword('abc123')).toThrow(ValidationError);
  });
});

describe('Auth integration: token lifecycle', () => {
  const secret = 'integration-test-secret-32-chars!';

  it('full register/login token flow', async () => {
    const password = 'secure-password-123';
    const hash = await hashPassword(password);

    // Verify correct password
    expect(await verifyPassword(password, hash)).toBe(true);
    // Verify wrong password
    expect(await verifyPassword('wrong', hash)).toBe(false);

    // Issue token
    const now = Math.floor(Date.now() / 1000);
    const payload = { user_id: 'test123', email: 'test@example.com', iat: now, exp: now + 3600 };
    const token = await signToken(payload, secret);

    // Verify token
    const decoded = await verifyToken<typeof payload>(token, secret);
    expect(decoded.user_id).toBe('test123');
    expect(decoded.email).toBe('test@example.com');
  });

  it('expired token is rejected', async () => {
    const expiredPayload = {
      user_id: 'test',
      email: 'a@b.com',
      iat: 1000,
      exp: Math.floor(Date.now() / 1000) - 1,
    };
    const token = await signToken(expiredPayload, secret);
    await expect(verifyToken(token, secret)).rejects.toThrow();
  });

  it('token with wrong secret is rejected', async () => {
    const payload = { user_id: 'test', exp: Math.floor(Date.now() / 1000) + 3600 };
    const token = await signToken(payload, 'secret-one-that-is-32-chars-long!');
    await expect(verifyToken(token, 'different-secret-32-chars-long!!')).rejects.toThrow();
  });
});
