import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, signToken, verifyToken } from '../../src/utils/crypto';

describe('Password hashing', () => {
  it('hashes a password and produces salt:hash format', async () => {
    const hash = await hashPassword('mypassword');
    expect(hash).toContain(':');
    const parts = hash.split(':');
    expect(parts).toHaveLength(2);
    expect(parts[0].length).toBeGreaterThan(10);
    expect(parts[1].length).toBeGreaterThan(10);
  });

  it('same password produces different hashes (salt)', async () => {
    const h1 = await hashPassword('mypassword');
    const h2 = await hashPassword('mypassword');
    expect(h1).not.toBe(h2);
  });

  it('verifyPassword returns true for correct password', async () => {
    const hash = await hashPassword('correct-horse-battery');
    const valid = await verifyPassword('correct-horse-battery', hash);
    expect(valid).toBe(true);
  });

  it('verifyPassword returns false for wrong password', async () => {
    const hash = await hashPassword('correct-horse-battery');
    const valid = await verifyPassword('wrong-password', hash);
    expect(valid).toBe(false);
  });

  it('verifyPassword returns false for malformed hash', async () => {
    const valid = await verifyPassword('password', 'notahash');
    expect(valid).toBe(false);
  });
});

describe('JWT-style tokens', () => {
  const secret = 'test-secret-key-32-characters-ok!';

  it('signs and verifies a token', async () => {
    const payload = { user_id: 'abc', email: 'a@b.com', iat: 1000, exp: Math.floor(Date.now() / 1000) + 3600 };
    const token = await signToken(payload, secret);
    expect(token.split('.')).toHaveLength(3);

    const verified = await verifyToken<typeof payload>(token, secret);
    expect(verified.user_id).toBe('abc');
    expect(verified.email).toBe('a@b.com');
  });

  it('throws on tampered token', async () => {
    const payload = { user_id: 'abc', exp: Math.floor(Date.now() / 1000) + 3600 };
    const token = await signToken(payload, secret);
    const parts = token.split('.');
    // Tamper payload
    const tampered = `${parts[0]}.${btoa('{"user_id":"hacker"}')}.${parts[2]}`;
    await expect(verifyToken(tampered, secret)).rejects.toThrow();
  });

  it('throws on expired token', async () => {
    const payload = { user_id: 'abc', exp: Math.floor(Date.now() / 1000) - 10 }; // already expired
    const token = await signToken(payload, secret);
    await expect(verifyToken(token, secret)).rejects.toThrow('expired');
  });

  it('throws on wrong secret', async () => {
    const payload = { user_id: 'abc', exp: Math.floor(Date.now() / 1000) + 3600 };
    const token = await signToken(payload, 'correct-secret-32-characters-ok!');
    await expect(verifyToken(token, 'wrong-secret-32-characters-okk!')).rejects.toThrow();
  });
});
