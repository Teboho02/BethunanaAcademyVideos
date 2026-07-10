import { execute, queryRows } from '../config/db.js';

export type MediaJobStatus = 'queued' | 'processing' | 'completed' | 'failed';
export type MediaJobType = 'video_post_upload';

interface MediaJobRow {
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
    await execute(
      `IF OBJECT_ID('dbo.media_jobs', 'U') IS NULL
       BEGIN
         CREATE TABLE dbo.media_jobs (
           id BIGINT IDENTITY(1,1) NOT NULL,
           job_type VARCHAR(64) NOT NULL,
           video_id CHAR(36) NOT NULL,
           payload_json NVARCHAR(MAX) NULL,
           status VARCHAR(20) NOT NULL CONSTRAINT df_media_jobs_status DEFAULT 'queued',
           attempts TINYINT NOT NULL CONSTRAINT df_media_jobs_attempts DEFAULT 0,
           max_attempts TINYINT NOT NULL CONSTRAINT df_media_jobs_max_attempts DEFAULT 5,
           available_at DATETIME2 NOT NULL CONSTRAINT df_media_jobs_available_at DEFAULT GETDATE(),
           locked_at DATETIME2 NULL,
           locked_by VARCHAR(100) NULL,
           last_error NVARCHAR(MAX) NULL,
           completed_at DATETIME2 NULL,
           created_at DATETIME2 NOT NULL CONSTRAINT df_media_jobs_created_at DEFAULT GETDATE(),
           updated_at DATETIME2 NOT NULL CONSTRAINT df_media_jobs_updated_at DEFAULT GETDATE(),
           CONSTRAINT pk_media_jobs PRIMARY KEY (id),
           CONSTRAINT chk_media_jobs_status CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
           CONSTRAINT fk_media_jobs_video
             FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
         );

         CREATE INDEX idx_media_jobs_status_available ON dbo.media_jobs (status, available_at);
         CREATE INDEX idx_media_jobs_video ON dbo.media_jobs (video_id);
       END`
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
  await execute(
    `INSERT INTO media_jobs
       (job_type, video_id, payload_json, status, attempts, max_attempts, available_at)
     VALUES (?, ?, ?, 'queued', 0, 5, GETDATE())`,
    [
      'video_post_upload',
      cleanVideoId,
      JSON.stringify({ videoId: cleanVideoId })
    ]
  );
};

/**
 * Enqueues post-upload jobs for published videos that still need processing
 * (no duration or no stored thumbnail), skipping videos that already have a
 * queued or in-flight job. Lets the worker backfill videos uploaded before
 * duration extraction and server-side thumbnail generation existed.
 */
export const enqueueMissingMediaJobs = async (): Promise<number> => {
  await ensureMediaJobsTable();
  const result = await execute(
    `INSERT INTO media_jobs
       (job_type, video_id, payload_json, status, attempts, max_attempts, available_at)
     SELECT 'video_post_upload', v.id, NULL, 'queued', 0, 5, GETDATE()
     FROM videos v
     WHERE v.status = 'published'
       AND (
         v.duration_seconds IS NULL
         OR v.duration_seconds <= 0
         OR v.thumbnail_storage_type IS NULL
       )
       AND NOT EXISTS (
         SELECT 1
         FROM media_jobs j
         WHERE j.video_id = v.id
           AND j.status IN ('queued', 'processing')
       )`
  );
  return result.affectedRows;
};

export const claimNextMediaJob = async (workerId: string): Promise<MediaJob | null> => {
  await ensureMediaJobsTable();

  // Atomically claims the next available job. READPAST skips rows locked by
  // other workers (equivalent of MySQL's FOR UPDATE SKIP LOCKED).
  const rows = await queryRows<MediaJobRow>(
    `WITH next_job AS (
       SELECT TOP 1 *
       FROM media_jobs WITH (UPDLOCK, READPAST, ROWLOCK)
       WHERE status = 'queued'
         AND available_at <= GETDATE()
         AND attempts < max_attempts
       ORDER BY available_at ASC, id ASC
     )
     UPDATE next_job
     SET status = 'processing',
         attempts = attempts + 1,
         locked_at = GETDATE(),
         locked_by = ?,
         updated_at = GETDATE()
     OUTPUT
       INSERTED.id,
       INSERTED.job_type,
       INSERTED.video_id,
       INSERTED.payload_json,
       INSERTED.status,
       INSERTED.attempts,
       INSERTED.max_attempts`,
    [workerId]
  );

  const row = rows[0];
  if (!row) {
    return null;
  }

  return toMediaJob(row);
};

export const completeMediaJob = async (jobId: number): Promise<void> => {
  await execute(
    `UPDATE media_jobs
     SET status = 'completed',
         completed_at = GETDATE(),
         locked_at = NULL,
         locked_by = NULL,
         last_error = NULL,
         updated_at = GETDATE()
     WHERE id = ?`,
    [jobId]
  );
};

export const failMediaJob = async (
  job: MediaJob,
  errorMessage: string,
  retryDelayMs: number
): Promise<void> => {
  const safeError = errorMessage.slice(0, 2000);
  const retrySeconds = Math.max(1, Math.floor(retryDelayMs / 1000));

  if (job.attempts >= job.maxAttempts) {
    await execute(
      `UPDATE media_jobs
       SET status = 'failed',
           last_error = ?,
           locked_at = NULL,
           locked_by = NULL,
           updated_at = GETDATE()
       WHERE id = ?`,
      [safeError, job.id]
    );
    return;
  }

  await execute(
    `UPDATE media_jobs
     SET status = 'queued',
         available_at = DATEADD(SECOND, ?, GETDATE()),
         last_error = ?,
         locked_at = NULL,
         locked_by = NULL,
         updated_at = GETDATE()
     WHERE id = ?`,
    [retrySeconds, safeError, job.id]
  );
};
