import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2';
import { env } from '../config/env.js';
import { checkMySqlConnection, closePool, getMySqlPool } from '../config/mysql.js';
import {
  claimNextMediaJob,
  completeMediaJob,
  ensureMediaJobsTable,
  failMediaJob,
  type MediaJob
} from '../services/mediaJobs.service.js';

const sleep = async (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const workerId = `media-worker-${process.pid}-${randomUUID().slice(0, 8)}`;
let running = true;

const processVideoPostUploadJob = async (job: MediaJob): Promise<void> => {
  const pool = getMySqlPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, duration_seconds
     FROM videos
     WHERE id = ?
     LIMIT 1`,
    [job.videoId]
  );
  const row = rows[0];
  if (!row) {
    throw new Error(`Video ${job.videoId} not found`);
  }

  await pool.query(
    `UPDATE videos
     SET duration_seconds = COALESCE(duration_seconds, 0),
         updated_at = NOW()
     WHERE id = ?`,
    [job.videoId]
  );
};

const processMediaJob = async (job: MediaJob): Promise<void> => {
  if (job.jobType === 'video_post_upload') {
    await processVideoPostUploadJob(job);
    return;
  }

  throw new Error(`Unsupported media job type: ${job.jobType}`);
};

const runWorker = async (): Promise<void> => {
  const mysqlHealth = await checkMySqlConnection();
  if (!mysqlHealth.ok) {
    throw new Error(`MySQL check failed: ${mysqlHealth.message}`);
  }

  await ensureMediaJobsTable();
  console.info(`[worker:${workerId}] Started media jobs worker.`);

  while (running) {
    const job = await claimNextMediaJob(workerId);
    if (!job) {
      await sleep(env.MEDIA_JOB_POLL_INTERVAL_MS);
      continue;
    }

    try {
      await processMediaJob(job);
      await completeMediaJob(job.id);
      console.info(`[worker:${workerId}] Completed job ${job.id} (${job.jobType})`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await failMediaJob(job, message, env.MEDIA_JOB_RETRY_DELAY_MS);
      console.error(
        `[worker:${workerId}] Job ${job.id} failed (attempt ${job.attempts}/${job.maxAttempts}): ${message}`
      );
    }
  }

  console.info(`[worker:${workerId}] Stopped media jobs worker.`);
};

const shutdown = async (): Promise<void> => {
  running = false;
  await closePool();
};

process.on('SIGINT', () => {
  void shutdown();
});
process.on('SIGTERM', () => {
  void shutdown();
});

runWorker().catch(async (error) => {
  const message = error instanceof Error ? error.message : 'Unknown worker startup error';
  console.error(`[worker:${workerId}] Failed to start: ${message}`);
  await closePool();
  process.exit(1);
});
