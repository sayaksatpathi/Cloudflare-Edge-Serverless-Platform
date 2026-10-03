import { d1First, d1Run } from '../bindings/d1';
import { r2Head } from '../bindings/r2';
import { logInfo, logError } from '../observability/logging';
import { emitMetric } from '../observability/telemetry';
import type { QueueMessage, Env } from '../types';

const MAX_ATTEMPTS = 3;

export async function processQueue(
  batch: MessageBatch<QueueMessage>,
  env: Env,
): Promise<void> {
  for (const message of batch.messages) {
    const msg = message.body;
    const requestId = `queue_${msg.job_id}`;

    try {
      await processJob(env, msg, requestId);
      message.ack();
    } catch (err) {
      logError(requestId, 'queue_job_failed', err, {
        job_id: msg.job_id,
        attempt: msg.attempt,
      });
      emitMetric('job_failed', 1, { type: msg.type });

      if (msg.attempt >= MAX_ATTEMPTS) {
        // Mark as permanently failed
        await d1Run(
          env.DB,
          "UPDATE jobs SET status = 'failed', finished_at = ?, error = ?, attempts = ? WHERE id = ?",
          [new Date().toISOString(), `Max attempts (${MAX_ATTEMPTS}) exceeded`, msg.attempt, msg.job_id],
        );
        message.ack(); // Don't retry — move to DLQ
      } else {
        // Mark as retrying and nack for redelivery
        await d1Run(
          env.DB,
          "UPDATE jobs SET status = 'retrying', attempts = ? WHERE id = ?",
          [msg.attempt, msg.job_id],
        );
        message.retry();
      }
    }
  }
}

async function processJob(env: Env, msg: QueueMessage, requestId: string): Promise<void> {
  // Mark job as running
  const now = new Date().toISOString();
  await d1Run(
    env.DB,
    "UPDATE jobs SET status = 'running', started_at = ?, attempts = ? WHERE id = ?",
    [now, msg.attempt, msg.job_id],
  );

  logInfo(requestId, 'job_processing', {
    job_id: msg.job_id,
    type: msg.type,
    attempt: msg.attempt,
  });

  // Get asset info
  const asset = await d1First<{
    id: string;
    object_key: string;
    filename: string;
    content_type: string;
    size_bytes: number;
  }>(env.DB, 'SELECT id, object_key, filename, content_type, size_bytes FROM assets WHERE id = ?', [
    msg.asset_id,
  ]);

  if (!asset) {
    throw new Error(`Asset ${msg.asset_id} not found`);
  }

  // Verify object exists in R2
  const r2Object = await r2Head(env.BUCKET, asset.object_key);
  if (!r2Object) {
    throw new Error(`R2 object not found: ${asset.object_key}`);
  }

  // Perform work based on job type
  let result: Record<string, unknown> = {};
  switch (msg.type) {
    case 'inspect':
      result = await performInspect(asset);
      break;
    case 'thumbnail':
      result = await performThumbnail(asset);
      break;
    case 'transform':
      result = await performTransform(asset);
      break;
    default:
      throw new Error(`Unknown job type: ${msg.type}`);
  }

  // Mark job as successful
  const finishedAt = new Date().toISOString();
  await d1Run(
    env.DB,
    "UPDATE jobs SET status = 'success', finished_at = ?, attempts = ?, error = NULL WHERE id = ?",
    [finishedAt, msg.attempt, msg.job_id],
  );

  emitMetric('job_success', 1, { type: msg.type });
  logInfo(requestId, 'job_completed', {
    job_id: msg.job_id,
    type: msg.type,
    result: JSON.stringify(result),
  });
}

async function performInspect(asset: {
  filename: string;
  content_type: string;
  size_bytes: number;
}): Promise<Record<string, unknown>> {
  // Deterministic metadata inspection
  return {
    filename: asset.filename,
    content_type: asset.content_type,
    size_bytes: asset.size_bytes,
    size_kb: Math.round(asset.size_bytes / 1024),
    inspected_at: new Date().toISOString(),
  };
}

async function performThumbnail(asset: { filename: string }): Promise<Record<string, unknown>> {
  // Placeholder — real thumbnail generation would use image transformation
  return {
    thumbnail_generated: false,
    reason: 'Thumbnail generation requires image transformation pipeline',
    filename: asset.filename,
  };
}

async function performTransform(asset: { filename: string }): Promise<Record<string, unknown>> {
  return {
    transform_applied: false,
    reason: 'Transform pipeline not implemented in this release',
    filename: asset.filename,
  };
}
