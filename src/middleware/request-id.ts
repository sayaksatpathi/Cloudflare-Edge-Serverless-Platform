import { generateRequestId } from '../utils/ids';

export function getOrCreateRequestId(request: Request): string {
  // Accept a forwarded request ID from trusted upstream but generate our own
  const forwarded = request.headers.get('X-Request-ID');
  if (forwarded && /^[a-zA-Z0-9_-]{8,64}$/.test(forwarded)) {
    return forwarded;
  }
  return generateRequestId();
}
