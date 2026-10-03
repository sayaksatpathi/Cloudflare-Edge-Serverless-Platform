import type { RequestLog } from '../types';

export function log(entry: RequestLog): void {
  // Workers console.log is captured by Cloudflare observability
  console.log(JSON.stringify(entry));
}

export function logInfo(request_id: string, event: string, extras?: Partial<RequestLog>): void {
  log({
    timestamp: new Date().toISOString(),
    level: 'info',
    request_id,
    event,
    ...extras,
  });
}

export function logError(
  request_id: string,
  event: string,
  error: unknown,
  extras?: Partial<RequestLog>,
): void {
  const errorMsg = error instanceof Error ? error.message : String(error);
  log({
    timestamp: new Date().toISOString(),
    level: 'error',
    request_id,
    event,
    error: errorMsg,
    ...extras,
  });
}

export function logWarn(request_id: string, event: string, extras?: Partial<RequestLog>): void {
  log({
    timestamp: new Date().toISOString(),
    level: 'warn',
    request_id,
    event,
    ...extras,
  });
}
