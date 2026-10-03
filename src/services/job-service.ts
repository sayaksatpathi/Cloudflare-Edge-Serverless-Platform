import { d1First, d1Run } from '../bindings/d1';
import { enqueueJob } from '../bindings/queue';
import { generateId } from '../utils/ids';
import { validateJobType } from '../utils/validation';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors';
import type { Job, CreateJobRequest, QueueMessage, Env } from '../types';

export async function createJob(
  env: Env,
  userId: string,
  body: CreateJobRequest,
): Promise<Job> {
  if (!body.asset_id) throw new ValidationError('asset_id is required');
  const jobType = validateJobType(body.type ?? 'inspect');

  // Verify asset ownership
  const asset = await d1First<{ id: string; user_id: string }>(
    env.DB,
    "SELECT id, user_id FROM assets WHERE id = ? AND status = 'active'",
    [body.asset_id],
  );
  if (!asset) throw new NotFoundError('Asset');
  if (asset.user_id !== userId) throw new ForbiddenError('Access denied');

  const id = generateId();
  const now = new Date().toISOString();

  await d1Run(
    env.DB,
    `INSERT INTO jobs (id, user_id, asset_id, type, status, attempts, created_at, started_at, finished_at, error)
     VALUES (?, ?, ?, ?, 'queued', 0, ?, NULL, NULL, NULL)`,
    [id, userId, body.asset_id, jobType, now],
  );

  const message: QueueMessage = {
    job_id: id,
    asset_id: body.asset_id,
    user_id: userId,
    type: jobType,
    attempt: 1,
  };

  await enqueueJob(env.JOB_QUEUE, message);

  return {
    id,
    user_id: userId,
    asset_id: body.asset_id,
    type: jobType,
    status: 'queued',
    attempts: 0,
    created_at: now,
    started_at: null,
    finished_at: null,
    error: null,
  };
}

export async function getJob(env: Env, userId: string, jobId: string): Promise<Job> {
  const job = await d1First<Job>(env.DB, 'SELECT * FROM jobs WHERE id = ?', [jobId]);
  if (!job) throw new NotFoundError('Job');
  if (job.user_id !== userId) throw new ForbiddenError('Access denied');
  return job;
}
