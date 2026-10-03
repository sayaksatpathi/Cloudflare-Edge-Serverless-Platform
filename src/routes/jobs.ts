import { createJob, getJob } from '../services/job-service';
import { requireAuth } from '../middleware/auth';
import { successResponse } from '../middleware/error-handler';
import { parseJsonBody } from '../utils/validation';
import { logInfo } from '../observability/logging';
import { emitMetric } from '../observability/telemetry';
import type { CreateJobRequest, Env } from '../types';

export async function handleCreateJob(
  request: Request,
  env: Env,
  requestId: string,
): Promise<Response> {
  const token = await requireAuth(request, env);
  const body = await parseJsonBody<CreateJobRequest>(request);
  const job = await createJob(env, token.user_id, body);
  logInfo(requestId, 'job_created', { user_id: token.user_id, job_id: job.id });
  emitMetric('job_created', 1, { type: job.type });
  return successResponse(job, requestId, 201);
}

export async function handleGetJob(
  request: Request,
  env: Env,
  requestId: string,
  jobId: string,
): Promise<Response> {
  const token = await requireAuth(request, env);
  const job = await getJob(env, token.user_id, jobId);
  return successResponse(job, requestId);
}
