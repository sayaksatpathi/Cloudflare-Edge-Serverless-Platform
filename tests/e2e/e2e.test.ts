/**
 * E2E test: validates full user journey logic
 * Uses crypto/validation/ID utilities to simulate the complete flow
 * Does NOT require a live Worker — validates all pure logic end-to-end
 */

import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, signToken, verifyToken } from '../../src/utils/crypto';
import { generateId, generateObjectKey, validateObjectKey } from '../../src/utils/ids';
import { validateEmail, validatePassword, validateFilename, validateJobType } from '../../src/utils/validation';
import { AuthToken } from '../../src/types';

describe('E2E: Complete user journey (pure logic)', () => {
  const secret = 'e2e-test-secret-32-characters-ok!';
  let userId: string;
  let assetId: string;
  let jobId: string;
  let token: string;

  it('Step 1: Register — validates email and hashes password', async () => {
    const email = 'testuser@example.com';
    const password = 'SecurePass123!';

    expect(() => validateEmail(email)).not.toThrow();
    expect(() => validatePassword(password)).not.toThrow();

    userId = generateId();
    expect(userId).toMatch(/^[0-9a-f]{32}$/);

    const hash = await hashPassword(password);
    expect(hash).toContain(':');
    expect(await verifyPassword(password, hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });

  it('Step 2: Login — issues valid JWT', async () => {
    const now = Math.floor(Date.now() / 1000);
    const payload: AuthToken = {
      user_id: userId,
      email: 'testuser@example.com',
      iat: now,
      exp: now + 86400,
    };
    token = await signToken(payload, secret);
    expect(token.split('.')).toHaveLength(3);
  });

  it('Step 3: Token verification — validates auth', async () => {
    const decoded = await verifyToken<AuthToken>(token, secret);
    expect(decoded.user_id).toBe(userId);
    expect(decoded.email).toBe('testuser@example.com');
  });

  it('Step 4: Upload asset — generates safe object key', () => {
    assetId = generateId();
    const filename = validateFilename('my document.pdf');
    expect(filename).toBeTruthy();

    const objectKey = generateObjectKey(userId, assetId);
    expect(objectKey).toBe(`users/${userId}/assets/${assetId}`);
    expect(validateObjectKey(objectKey, userId)).toBe(true);
  });

  it('Step 5: IDOR check — different user cannot access asset', () => {
    const otherUserId = generateId();
    const objectKey = generateObjectKey(userId, assetId);
    expect(validateObjectKey(objectKey, otherUserId)).toBe(false);
  });

  it('Step 6: Create job — validates type', () => {
    jobId = generateId();
    const jobType = validateJobType('inspect');
    expect(jobType).toBe('inspect');
  });

  it('Step 7: Invalid job type is rejected', () => {
    expect(() => validateJobType('malicious')).toThrow();
  });

  it('Step 8: Expired token is rejected', async () => {
    const expiredPayload: AuthToken = {
      user_id: userId,
      email: 'test@example.com',
      iat: 1000,
      exp: Math.floor(Date.now() / 1000) - 60,
    };
    const expiredToken = await signToken(expiredPayload, secret);
    await expect(verifyToken(expiredToken, secret)).rejects.toThrow();
  });

  it('Step 9: All IDs are unique', () => {
    const ids = new Set([userId, assetId, jobId]);
    expect(ids.size).toBe(3);
  });
});
