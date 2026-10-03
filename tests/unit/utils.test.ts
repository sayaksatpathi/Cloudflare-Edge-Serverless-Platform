import { describe, it, expect } from 'vitest';
import { generateId, generateRequestId, generateObjectKey, validateHexId, validateObjectKey } from '../../src/utils/ids';
import { validateEmail, validatePassword, validateFilename, validateContentType, validateJobType, sanitizeString } from '../../src/utils/validation';
import { ValidationError } from '../../src/utils/errors';

describe('ID utilities', () => {
  it('generateId produces 32-char hex string', () => {
    const id = generateId();
    expect(id).toMatch(/^[0-9a-f]{32}$/);
  });

  it('generateId is unique', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });

  it('generateRequestId starts with req_', () => {
    const id = generateRequestId();
    expect(id).toMatch(/^req_[0-9a-f]{24}$/);
  });

  it('generateObjectKey produces correct path', () => {
    const key = generateObjectKey('abc123', 'def456');
    expect(key).toBe('users/abc123/assets/def456');
  });

  it('validateHexId accepts valid 32-char hex', () => {
    expect(validateHexId('a'.repeat(32))).toBe(true);
    expect(validateHexId('0123456789abcdef0123456789abcdef')).toBe(true);
  });

  it('validateHexId rejects invalid strings', () => {
    expect(validateHexId('')).toBe(false);
    expect(validateHexId('../etc/passwd')).toBe(false);
    expect(validateHexId('a'.repeat(31))).toBe(false);
  });

  it('validateObjectKey accepts valid key for user', () => {
    const userId = 'a'.repeat(32);
    const assetId = 'b'.repeat(32);
    const key = `users/${userId}/assets/${assetId}`;
    expect(validateObjectKey(key, userId)).toBe(true);
  });

  it('validateObjectKey rejects path traversal', () => {
    const userId = 'a'.repeat(32);
    expect(validateObjectKey(`users/${userId}/assets/../other`, userId)).toBe(false);
  });

  it('validateObjectKey rejects wrong user', () => {
    const userId = 'a'.repeat(32);
    const otherId = 'b'.repeat(32);
    const assetId = 'c'.repeat(32);
    const key = `users/${userId}/assets/${assetId}`;
    expect(validateObjectKey(key, otherId)).toBe(false);
  });
});

describe('Validation utilities', () => {
  it('validateEmail accepts valid emails', () => {
    expect(() => validateEmail('user@example.com')).not.toThrow();
    expect(() => validateEmail('a+b@c.io')).not.toThrow();
  });

  it('validateEmail rejects invalid emails', () => {
    expect(() => validateEmail('notanemail')).toThrow(ValidationError);
    expect(() => validateEmail('@nope.com')).toThrow(ValidationError);
  });

  it('validatePassword accepts strong passwords', () => {
    expect(() => validatePassword('password123')).not.toThrow();
  });

  it('validatePassword rejects short passwords', () => {
    expect(() => validatePassword('short')).toThrow(ValidationError);
  });

  it('validatePassword rejects too-long passwords', () => {
    expect(() => validatePassword('x'.repeat(129))).toThrow(ValidationError);
  });

  it('validateFilename strips path components', () => {
    expect(validateFilename('../../../etc/passwd')).not.toContain('/');
    expect(validateFilename('normal.txt')).toBe('normal.txt');
  });

  it('validateFilename handles empty', () => {
    const result = validateFilename('');
    expect(result).toBeTruthy();
  });

  it('validateContentType accepts allowed types', () => {
    expect(() => validateContentType('image/png')).not.toThrow();
    expect(() => validateContentType('application/pdf')).not.toThrow();
  });

  it('validateContentType rejects unknown types', () => {
    expect(() => validateContentType('application/x-evil-script')).toThrow();
  });

  it('validateJobType accepts valid types', () => {
    expect(validateJobType('inspect')).toBe('inspect');
    expect(validateJobType('thumbnail')).toBe('thumbnail');
  });

  it('validateJobType rejects invalid types', () => {
    expect(() => validateJobType('hack')).toThrow(ValidationError);
  });

  it('sanitizeString removes control characters', () => {
    // eslint-disable-next-line no-control-regex
    const dirty = 'hello\x00world\x1f!';
    const clean = sanitizeString(dirty);
    // eslint-disable-next-line no-control-regex
    expect(clean).not.toMatch(/[\x00-\x1f]/);
    expect(clean).toContain('hello');
  });

  it('sanitizeString truncates to maxLen', () => {
    const long = 'a'.repeat(2000);
    expect(sanitizeString(long, 100)).toHaveLength(100);
  });
});
