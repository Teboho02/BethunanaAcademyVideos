import type { RowDataPacket } from 'mysql2';
import { getMySqlPool } from '../config/mysql.js';

export type MediaJobStatus = 'queued' | 'processing' | 'completed' | 'failed';
export type MediaJobType = 'video_post_upload';

interface MediaJobRow extends RowDataPacket {
  id: number;
  job_type: string;
  video_id: string;
  payload_json: unknown;
  status: MediaJobStatus;
  attempts: number;
  max_attempts: number;
}

export interface MediaJob {
  id: number;
  jobType: MediaJobType;
  videoId: string;
  payload: Record<string, unknown>;
  status: MediaJobStatus;
  attempts: number;
  maxAttempts: number;
}

let ensuredTable = false;
let ensureTableInFlight: Promise<void> | null = null;

const toPayload = (value: unknown): Record<string, unknown> => {
  if (!value) {
    return {};
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object') {
        return parsed as Record<string, unknown>;
      }
      return {};
    } catch {
      return {};
    }
  }

  if (typeof value === 'object') {
    return value as Record<string, unknown>;
  }

  return {};
};

const toMediaJob = (row: MediaJobRow): MediaJob => ({
  id: Number(row.id),
  jobType: row.job_type as MediaJobType,
  videoId: row.video_id,
  payload: toPayload(row.payload_json),
  status: row.status,
  attempts: Number(row.attempts),
  maxAttempts: Number(row.max_attempts)
});

export const ensureMediaJobsTable = async (): Promise<void> => {
  if (ensuredTable) {
    return;
  }
  if (ensureTableInFlight) {
    await ensureTableInFlight;
    return;
  }

  ensureTableInFlight = (async () => {
    const pool = getMySqlPool();
    await pool.query(
      `CREATE TABLE IF NOT EXISTS media_jobs (
         id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
         job_type VARCHAR(64) NOT NULL,
         video_id CHAR(36) NOT NULL,
         payload_json JSON NULL,
         status ENUM('queued', 'processing', 'completed', 'failed') NOT NULL DEFAULT 'queued',
         attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
         max_attempts TINYINT UNSIGNED NOT NULL DEFAULT 5,
         available_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
         locked_at TIMESTAMP NULL DEFAULT NULL,
         locked_by VARCHAR(100) NULL,
         last_error TEXT NULL,
         completed_at TIMESTAMP NULL DEFAULT NULL,
         created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
         updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
         PRIMARY KEY (id),
         KEY idx_media_jobs_status_available (status, available_at),
         KEY idx_media_jobs_video (video_id),
         CONSTRAINT fk_media_jobs_video
           FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
       ) ENGINE=InnoDB`
    );
    ensuredTable = true;
  })();

  try {
    await ensureTableInFlight;
  } finally {
    ensureTableInFlight = null;
  }
};

export const enqueueVideoPostUploadJob = async (videoId: string): Promise<void> => {
  const cleanVideoId = videoId.trim();
  if (!cleanVideoId) {
    throw new Error('Video id is required to enqueue media job');
  }

  await ensureMediaJobsTable();
  const pool = getMySqlPool();
  await pool.query(
    `INSERT INTO media_jobs
       (job_type, video_id, payload_json, status, attempts, max_attempts, available_at)
     VALUES (?, ?, ?, 'queued', 0, 5, NOW())`,
    [
      'video_post_upload',
      cleanVideoId,
      JSON.stringify({ videoId: cleanVideoId })
    ]
  );
};

export const claimNextMediaJob = async (workerId: string): Promise<MediaJob | null> => {
  await ensureMediaJobsTable();
  const pool = getMySqlPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const [rows] = await connection.query<MediaJobRow[]>(
      `SELECT
         id,
         job_type,
         video_id,
         payload_json,
         status,
         attempts,
         max_attempts
       FROM media_jobs
       WHERE status = 'queued'
         AND available_at <= NOW()
         AND attempts < max_attempts
       ORDER BY available_at ASC, id ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED`
    );

    const row = rows[0];
    if (!row) {
      await connection.commit();
      return null;
    }

    await connection.query(
      `UPDATE media_jobs
       SET status = 'processing',
           attempts = attempts + 1,
           locked_at = NOW(),
           locked_by = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [workerId, row.id]
    );
    await connection.commit();

    return {
      ...toMediaJob(row),
      status: 'processing',
      attempts: Number(row.attempts) + 1
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

export const completeMediaJob = async (jobId: number): Promise<void> => {
  const pool = getMySqlPool();
  await pool.query(
    `UPDATE media_jobs
     SET status = 'completed',
         completed_at = NOW(),
         locked_at = NULL,
         locked_by = NULL,
         last_error = NULL,
         updated_at = NOW()
     WHERE id = ?`,
    [jobId]
  );
};

export const failMediaJob = async (
  job: MediaJob,
  errorMessage: string,
  retryDelayMs: number
): Promise<void> => {
  const pool = getMySqlPool();
  const safeError = errorMessage.slice(0, 2000);
  const retrySeconds = Math.max(1, Math.floor(retryDelayMs / 1000));

  if (job.attempts >= job.maxAttempts) {
    await pool.query(
      `UPDATE media_jobs
       SET status = 'failed',
           last_error = ?,
           locked_at = NULL,
           locked_by = NULL,
           updated_at = NOW()
       WHERE id = ?`,
      [safeError, job.id]
    );
    return;
  }

  await pool.query(
    `UPDATE media_jobs
     SET status = 'queued',
         available_at = DATE_ADD(NOW(), INTERVAL ? SECOND),
         last_error = ?,
         locked_at = NULL,
         locked_by = NULL,
         updated_at = NOW()
     WHERE id = ?`,
    [retrySeconds, safeError, job.id]
  );
};
