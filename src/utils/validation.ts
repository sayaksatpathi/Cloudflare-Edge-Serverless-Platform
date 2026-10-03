import { ValidationError } from './errors';
import { ALLOWED_CONTENT_TYPES } from '../config';

export function validateEmail(email: string): void {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(email)) throw new ValidationError('Invalid email address');
}

export function validatePassword(password: string): void {
  if (password.length < 8) throw new ValidationError('Password must be at least 8 characters');
  if (password.length > 128) throw new ValidationError('Password too long');
}

export function validateFilename(filename: string): string {
  // Strip path components and normalize
  const base = filename.split(/[/\\]/).pop() ?? 'file';
  const sanitized = base.replace(/[^a-zA-Z0-9._\-\s]/g, '_').trim();
  if (!sanitized || sanitized.length === 0) return 'unnamed_file';
  if (sanitized.length > 255) return sanitized.slice(0, 255);
  return sanitized;
}

export function validateContentType(contentType: string): void {
  // Strip parameters (e.g. "; charset=utf-8")
  const mime = contentType.split(';')[0].trim().toLowerCase();
  if (!ALLOWED_CONTENT_TYPES.has(mime)) {
    throw new Error(`Unsupported content type: ${mime}`);
  }
}

export function validateJobType(type: string): 'inspect' | 'thumbnail' | 'transform' {
  const valid = ['inspect', 'thumbnail', 'transform'];
  if (!valid.includes(type)) throw new ValidationError(`Invalid job type: ${type}`);
  return type as 'inspect' | 'thumbnail' | 'transform';
}

export function sanitizeString(s: string, maxLen = 1000): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '').slice(0, maxLen);
}

export async function parseJsonBody<T>(request: Request): Promise<T> {
  const ct = request.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) {
    throw new ValidationError('Content-Type must be application/json');
  }
  let body: T;
  try {
    body = (await request.json()) as T;
  } catch {
    throw new ValidationError('Invalid JSON body');
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ValidationError('Request body must be a JSON object');
  }
  return body;
}
