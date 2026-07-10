import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { readFile, unlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { env } from '../config/env.js';
import { checkDbConnection, closePool, execute, queryRows } from '../config/db.js';
import {
  claimNextMediaJob,
  completeMediaJob,
  enqueueMissingMediaJobs,
  ensureMediaJobsTable,
  failMediaJob,
  type MediaJob
} from '../services/mediaJobs.service.js';
import {
  captureVideoFrameJpeg,
  getVideoDurationSeconds,
  isMostlyBlackImage
} from '../services/mediaProbe.service.js';
import {
  resolveLocalVideoPath,
  saveThumbnailBufferToLocalStorage
} from '../services/storage/localVideoStorage.service.js';
import {
  buildS3ThumbnailKey,
  getS3Object,
  uploadBufferToS3
} from '../services/storage/s3.service.js';
import { ensureVideoThumbnailColumns } from '../services/videoSchema.service.js';

const sleep = async (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const workerId = `media-worker-${process.pid}-${randomUUID().slice(0, 8)}`;
let running = true;

interface VideoProcessingRow {
  id: string;
  duration_seconds: number | null;
  storage_type: 'local' | 's3';
  local_path: string | null;
  s3_key: string | null;
  thumbnail_storage_type: 'local' | 's3' | null;
  thumbnail_local_path: string | null;
  thumbnail_s3_key: string | null;
}

const streamToBuffer = async (stream: NodeJS.ReadableStream): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

/**
 * Makes the video available as a local file path for ffprobe/ffmpeg.
 * Local videos are used in place; S3 videos are downloaded to a temp file.
 */
const materializeVideoFile = async (
  row: VideoProcessingRow
): Promise<{ videoPath: string; cleanup: () => Promise<void> }> => {
  if (row.storage_type === 'local') {
    if (!row.local_path) {
      throw new Error(`Video ${row.id} has local storage but no local path`);
    }
    return {
      videoPath: resolveLocalVideoPath(row.local_path),
      cleanup: async () => {}
    };
  }

  if (!row.s3_key) {
    throw new Error(`Video ${row.id} has S3 storage but no S3 key`);
  }

  const extension = path.extname(row.s3_key) || '.mp4';
  const tempPath = path.join(os.tmpdir(), `bethunana-media-${randomUUID()}${extension}`);
  const object = await getS3Object(row.s3_key);
  await pipeline(object.stream, createWriteStream(tempPath));

  return {
    videoPath: tempPath,
    cleanup: async () => {
      try {
        await unlink(tempPath);
      } catch {
        // Temp file cleanup is best-effort.
      }
    }
  };
};

const loadStoredThumbnail = async (row: VideoProcessingRow): Promise<Buffer | null> => {
  if (row.thumbnail_storage_type === 'local' && row.thumbnail_local_path) {
    return readFile(resolveLocalVideoPath(row.thumbnail_local_path));
  }
  if (row.thumbnail_storage_type === 's3' && row.thumbnail_s3_key) {
    const object = await getS3Object(row.thumbnail_s3_key);
    return streamToBuffer(object.stream);
  }
  return null;
};

const storeGeneratedThumbnail = async (
  row: VideoProcessingRow,
  jpegBuffer: Buffer
): Promise<void> => {
  const filename = `${row.id}-thumbnail.jpg`;

  if (row.storage_type === 's3' && env.S3_REGION && env.S3_BUCKET) {
    const s3Key = buildS3ThumbnailKey(filename);
    await uploadBufferToS3(s3Key, jpegBuffer, 'image/jpeg');
    await execute(
      `UPDATE videos
       SET thumbnail_storage_type = 's3',
           thumbnail_s3_bucket = ?,
           thumbnail_s3_key = ?,
           thumbnail_local_path = NULL,
           thumbnail_mime_type = 'image/jpeg',
           updated_at = GETDATE()
       WHERE id = ?`,
      [env.S3_BUCKET, s3Key, row.id]
    );
    return;
  }

  const localThumb = await saveThumbnailBufferToLocalStorage(jpegBuffer, filename);
  await execute(
    `UPDATE videos
     SET thumbnail_storage_type = 'local',
         thumbnail_local_path = ?,
         thumbnail_s3_bucket = NULL,
         thumbnail_s3_key = NULL,
         thumbnail_mime_type = 'image/jpeg',
         updated_at = GETDATE()
     WHERE id = ?`,
    [localThumb.storageKey, row.id]
  );
};

const processVideoPostUploadJob = async (job: MediaJob): Promise<void> => {
  const rows = await queryRows<VideoProcessingRow>(
    `SELECT TOP 1
       id,
       duration_seconds,
       storage_type,
       local_path,
       s3_key,
       thumbnail_storage_type,
       thumbnail_local_path,
       thumbnail_s3_key
     FROM videos
     WHERE id = ?`,
    [job.videoId]
  );
  const row = rows[0];
  if (!row) {
    throw new Error(`Video ${job.videoId} not found`);
  }

  const needsDuration = !(Number(row.duration_seconds) > 0);

  // Regenerate the thumbnail when there is none, or when the stored one is
  // black (older uploads captured frame 0, which is often a black frame).
  let needsThumbnail = !row.thumbnail_storage_type;
  if (!needsThumbnail) {
    try {
      const storedThumbnail = await loadStoredThumbnail(row);
      needsThumbnail = !storedThumbnail || (await isMostlyBlackImage(storedThumbnail));
      if (needsThumbnail) {
        console.info(`[worker:${workerId}] Thumbnail for video ${row.id} is black; regenerating.`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `[worker:${workerId}] Could not inspect thumbnail for video ${row.id} (${message}); regenerating.`
      );
      needsThumbnail = true;
    }
  }

  if (!needsDuration && !needsThumbnail) {
    return;
  }

  const { videoPath, cleanup } = await materializeVideoFile(row);
  try {
    const durationSeconds = await getVideoDurationSeconds(videoPath);

    if (needsDuration) {
      await execute(
        `UPDATE videos
         SET duration_seconds = ?,
             updated_at = GETDATE()
         WHERE id = ?`,
        [durationSeconds ? Math.round(durationSeconds) : 0, row.id]
      );
    }

    if (needsThumbnail) {
      // Capture at 1s to avoid black opening frames; for very short clips
      // fall back to the midpoint.
      const captureAt = durationSeconds && durationSeconds < 2 ? durationSeconds / 2 : 1;
      const jpegBuffer = await captureVideoFrameJpeg(videoPath, captureAt);
      await storeGeneratedThumbnail(row, jpegBuffer);
    }
  } finally {
    await cleanup();
  }
};

const processMediaJob = async (job: MediaJob): Promise<void> => {
  if (job.jobType === 'video_post_upload') {
    await processVideoPostUploadJob(job);
    return;
  }

  throw new Error(`Unsupported media job type: ${job.jobType}`);
};

const runWorker = async (): Promise<void> => {
  const dbHealth = await checkDbConnection();
  if (!dbHealth.ok) {
    throw new Error(`SQL Server check failed: ${dbHealth.message}`);
  }

  await ensureMediaJobsTable();
  await ensureVideoThumbnailColumns();

  try {
    const backfilled = await enqueueMissingMediaJobs();
    if (backfilled > 0) {
      console.info(
        `[worker:${workerId}] Enqueued ${backfilled} backfill job(s) for videos missing duration or thumbnail.`
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[worker:${workerId}] Backfill enqueue failed: ${message}`);
  }

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
