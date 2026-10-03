import { describe, it, expect } from 'vitest';
import { validateJobType } from '../../src/utils/validation';
import { ValidationError } from '../../src/utils/errors';

describe('Job state machine', () => {
  describe('validateJobType', () => {
    it('accepts inspect', () => {
      expect(validateJobType('inspect')).toBe('inspect');
    });

    it('accepts thumbnail', () => {
      expect(validateJobType('thumbnail')).toBe('thumbnail');
    });

    it('accepts transform', () => {
      expect(validateJobType('transform')).toBe('transform');
    });

    it('rejects unknown types', () => {
      expect(() => validateJobType('delete_all')).toThrow(ValidationError);
      expect(() => validateJobType('')).toThrow(ValidationError);
      expect(() => validateJobType('INSPECT')).toThrow(ValidationError);
    });
  });

  describe('Job status transitions', () => {
    const validTransitions: Record<string, string[]> = {
      queued: ['running', 'failed'],
      running: ['success', 'failed', 'retrying'],
      retrying: ['running', 'failed'],
      success: [],
      failed: [],
    };

    it('queued can transition to running', () => {
      expect(validTransitions['queued']).toContain('running');
    });

    it('running can transition to success', () => {
      expect(validTransitions['running']).toContain('success');
    });

    it('success is terminal', () => {
      expect(validTransitions['success']).toHaveLength(0);
    });

    it('failed is terminal', () => {
      expect(validTransitions['failed']).toHaveLength(0);
    });
  });
});
