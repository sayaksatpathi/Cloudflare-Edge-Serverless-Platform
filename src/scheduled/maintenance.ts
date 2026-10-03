// Scheduled maintenance handler
// Runs on cron schedule: "0 2 * * *" (2AM daily) and "*/30 * * * *" (every 30 min)

import { d1Query, d1Run } from '../bindings/d1';
import { r2Delete } from '../bindings/r2';
import { logInfo, logError } from '../observability/logging';
import { emitMetric } from '../observability/telemetry';
import type { Env } from '../types';

export async function runMaintenance(
  controller: ScheduledController,
  env: Env,
): Promise<void> {
  const requestId = `cron_${Date.now()}`;
  logInfo(requestId, 'scheduled_start', {
    cron: controller.cron,
    scheduledTime: new Date(controller.scheduledTime).toISOString(),
  });
  emitMetric('scheduled_run', 1, { cron: controller.cron });

  const tasks = [
    cleanExpiredAssets(env, requestId),
    cleanStaleJobs(env, requestId),
    detectStuckJobs(env, requestId),
  ];

  // Only run daily stats on the 2AM cron
  if (controller.cron === '0 2 * * *') {
    tasks.push(produceDailyStats(env, requestId));
  }

  const results = await Promise.allSettled(tasks);
  let failures = 0;

  for (const result of results) {
    if (result.status === 'rejected') {
      logError(requestId, 'scheduled_task_failed', result.reason);
      emitMetric('scheduled_error', 1);
      failures++;
    }
  }

  logInfo(requestId, 'scheduled_complete', {
    tasks_total: tasks.length,
    tasks_failed: failures,
  });
}

async function cleanExpiredAssets(env: Env, requestId: string): Promise<void> {
  const now = new Date().toISOString();

  // Find expired assets
  const expired = await d1Query<{ id: string; object_key: string }>(
    env.DB,
    "SELECT id, object_key FROM assets WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at < ?",
    [now],
  );

  for (const asset of expired) {
    // Delete from R2
    try {
      await r2Delete(env.BUCKET, asset.object_key);
    } catch (err) {
      logError(requestId, 'r2_delete_failed', err, { asset_id: asset.id });
    }

    // Update D1
    await d1Run(
      env.DB,
      "UPDATE assets SET status = 'expired', updated_at = ? WHERE id = ?",
      [now, asset.id],
    );
  }

  logInfo(requestId, 'expired_assets_cleaned', { count: expired.length });
}

async function cleanStaleJobs(env: Env, requestId: string): Promise<void> {
  // Jobs stuck in 'queued' for more than 1 hour
  const cutoff = new Date(Date.now() - 3600 * 1000).toISOString();

  const stale = await d1Query<{ id: string }>(
    env.DB,
    "SELECT id FROM jobs WHERE status = 'queued' AND created_at < ?",
    [cutoff],
  );

  for (const job of stale) {
    await d1Run(
      env.DB,
      "UPDATE jobs SET status = 'failed', error = 'Job expired: stuck in queued state', finished_at = ? WHERE id = ?",
      [new Date().toISOString(), job.id],
    );
  }

  logInfo(requestId, 'stale_jobs_cleaned', { count: stale.length });
}

async function detectStuckJobs(env: Env, requestId: string): Promise<void> {
  // Jobs stuck in 'running' for more than 10 minutes
  const cutoff = new Date(Date.now() - 600 * 1000).toISOString();

  const stuck = await d1Query<{ id: string }>(
    env.DB,
    "SELECT id FROM jobs WHERE status = 'running' AND started_at < ?",
    [cutoff],
  );

  for (const job of stuck) {
    await d1Run(
      env.DB,
      "UPDATE jobs SET status = 'failed', error = 'Job timed out: stuck in running state', finished_at = ? WHERE id = ?",
      [new Date().toISOString(), job.id],
    );
    emitMetric('job_failed', 1, { reason: 'stuck' });
  }

  logInfo(requestId, 'stuck_jobs_detected', { count: stuck.length });
}

async function produceDailyStats(env: Env, requestId: string): Promise<void> {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split('T')[0];

  const stats = await d1Query<{ event_type: string; count: number }>(
    env.DB,
    "SELECT event_type, COUNT(*) as count FROM audit_events WHERE DATE(created_at) = ? GROUP BY event_type",
    [dateStr],
  );

  const summary: Record<string, number> = {};
  for (const row of stats) {
    summary[row.event_type] = row.count;
  }

  logInfo(requestId, 'daily_stats', { date: dateStr, summary: JSON.stringify(summary) });
}
