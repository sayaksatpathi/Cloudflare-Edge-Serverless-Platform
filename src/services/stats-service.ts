import { d1First } from '../bindings/d1';
import type { UsageStats, Env } from '../types';

export async function getUserStats(env: Env, userId: string): Promise<UsageStats> {
  const [assetStats, downloadStats, jobStats] = await Promise.all([
    d1First<{ total_assets: number; total_size: number }>(
      env.DB,
      "SELECT COUNT(*) as total_assets, COALESCE(SUM(size_bytes), 0) as total_size FROM assets WHERE user_id = ? AND status = 'active'",
      [userId],
    ),
    d1First<{ total_downloads: number }>(
      env.DB,
      'SELECT COUNT(*) as total_downloads FROM downloads WHERE user_id = ?',
      [userId],
    ),
    d1First<{ total_jobs: number; jobs_succeeded: number; jobs_failed: number }>(
      env.DB,
      `SELECT COUNT(*) as total_jobs,
              SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as jobs_succeeded,
              SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as jobs_failed
       FROM jobs WHERE user_id = ?`,
      [userId],
    ),
  ]);

  return {
    total_assets: assetStats?.total_assets ?? 0,
    total_size_bytes: assetStats?.total_size ?? 0,
    total_downloads: downloadStats?.total_downloads ?? 0,
    total_jobs: jobStats?.total_jobs ?? 0,
    jobs_succeeded: jobStats?.jobs_succeeded ?? 0,
    jobs_failed: jobStats?.jobs_failed ?? 0,
  };
}
