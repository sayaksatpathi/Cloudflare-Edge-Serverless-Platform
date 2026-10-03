import { SECURITY_HEADERS, CORS_HEADERS } from '../config';

export function applySecurityHeaders(headers: Headers): void {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    headers.set(k, v);
  }
}

export function applyCorsHeaders(headers: Headers): void {
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    headers.set(k, v);
  }
}

export function handlePreflight(request: Request): Response | null {
  if (request.method === 'OPTIONS') {
    const headers = new Headers();
    applyCorsHeaders(headers);
    applySecurityHeaders(headers);
    return new Response(null, { status: 204, headers });
  }
  return null;
}

export function addResponseHeaders(response: Response, requestId: string): Response {
  const headers = new Headers(response.headers);
  applySecurityHeaders(headers);
  applyCorsHeaders(headers);
  headers.set('X-Request-ID', requestId);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
