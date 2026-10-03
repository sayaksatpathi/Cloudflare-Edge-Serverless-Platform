// D1 binding helpers — thin wrappers that add error handling

import type { D1Database } from '@cloudflare/workers-types';

export async function d1Query<T = unknown>(
  db: D1Database,
  sql: string,
  params: (string | number | null | boolean)[],
): Promise<T[]> {
  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.all<T>();
  if (result.error) throw new Error(`D1 query error: ${result.error}`);
  return result.results ?? [];
}

export async function d1Run(
  db: D1Database,
  sql: string,
  params: (string | number | null | boolean)[],
): Promise<D1Result> {
  const stmt = db.prepare(sql).bind(...params);
  return stmt.run();
}

export async function d1First<T = unknown>(
  db: D1Database,
  sql: string,
  params: (string | number | null | boolean)[],
): Promise<T | null> {
  const stmt = db.prepare(sql).bind(...params);
  return stmt.first<T>();
}
