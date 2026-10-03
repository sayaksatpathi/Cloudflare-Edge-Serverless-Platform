import { describe, it, expect } from 'vitest';
import { validateFilename, validateContentType, validateJobType } from '../../src/utils/validation';
import { generateObjectKey, validateObjectKey, validateHexId } from '../../src/utils/ids';
import { ValidationError } from '../../src/utils/errors';

describe('Security: Path traversal', () => {
  it('generateObjectKey is safe for all inputs', () => {
    const userId = 'a'.repeat(32);
    const assetId = 'b'.repeat(32);
    const key = generateObjectKey(userId, assetId);
    expect(key).not.toContain('..');
    expect(key).not.toContain('//');
    expect(key).toMatch(/^users\/[0-9a-f]+\/assets\/[0-9a-f]+$/);
  });

  it('validateObjectKey rejects all traversal attempts', () => {
    const userId = 'a'.repeat(32);
    const malicious = [
      `../../../etc/passwd`,
      `users/${userId}/../../etc/passwd`,
      `users/${userId}/assets/../secret`,
      `users/other/assets/${'b'.repeat(32)}`,
    ];
    for (const key of malicious) {
      expect(validateObjectKey(key, userId)).toBe(false);
    }
  });

  it('validateFilename strips all path separators', () => {
    const attempts = [
      '../../../etc/passwd',
      '..\\..\\windows\\system32',
      '/etc/shadow',
      'C:\\windows',
    ];
    for (const name of attempts) {
      const safe = validateFilename(name);
      expect(safe).not.toContain('/');
      expect(safe).not.toContain('\\');
      expect(safe).not.toContain('..');
    }
  });
});

describe('Security: Content type validation', () => {
  it('rejects executable content types', () => {
    const dangerous = [
      'application/x-executable',
      'application/x-shellscript',
      'application/x-sh',
      'text/x-php',
      'application/x-httpd-php',
    ];
    for (const ct of dangerous) {
      expect(() => validateContentType(ct)).toThrow();
    }
  });

  it('accepts safe content types', () => {
    const safe = [
      'image/png',
      'image/jpeg',
      'application/pdf',
      'text/plain',
    ];
    for (const ct of safe) {
      expect(() => validateContentType(ct)).not.toThrow();
    }
  });
});

describe('Security: ID injection', () => {
  it('validateHexId rejects SQL injection attempts', () => {
    const attempts = [
      "' OR '1'='1",
      '1; DROP TABLE users',
      '../admin',
      '<script>alert(1)</script>',
    ];
    for (const attempt of attempts) {
      expect(validateHexId(attempt)).toBe(false);
    }
  });
});

describe('Security: Job type injection', () => {
  it('rejects code injection in job type', () => {
    const attempts = [
      'inspect; rm -rf /',
      '__proto__',
      'constructor',
      'eval',
    ];
    for (const attempt of attempts) {
      expect(() => validateJobType(attempt)).toThrow(ValidationError);
    }
  });
});

describe('Security: IDOR protection', () => {
  it('validateObjectKey enforces user ownership', () => {
    const userId1 = 'a'.repeat(32);
    const userId2 = 'b'.repeat(32);
    const assetId = 'c'.repeat(32);

    const key1 = generateObjectKey(userId1, assetId);
    // User 2 cannot access user 1's key
    expect(validateObjectKey(key1, userId2)).toBe(false);
    // User 1 can access their own key
    expect(validateObjectKey(key1, userId1)).toBe(true);
  });
});
