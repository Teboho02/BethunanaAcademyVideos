import { closePool, queryRows } from '../src/config/db.js';

const statusCounts = await queryRows<{ status: string; job_count: number }>(
  `SELECT status, COUNT(*) AS job_count FROM media_jobs GROUP BY status`
);
console.log('--- media_jobs by status ---');
console.table(statusCounts);

const recent = await queryRows<Record<string, unknown>>(
  `SELECT TOP 10 id, video_id, status, attempts, locked_by, last_error, available_at, updated_at
   FROM media_jobs
   ORDER BY updated_at DESC`
);
console.log('--- 10 most recent jobs ---');
for (const job of recent) {
  console.log(JSON.stringify(job, null, 2));
}

const videos = await queryRows<Record<string, unknown>>(
  `SELECT COUNT(*) AS total,
          SUM(CASE WHEN duration_seconds IS NULL OR duration_seconds <= 0 THEN 1 ELSE 0 END) AS missing_duration,
          SUM(CASE WHEN thumbnail_storage_type IS NULL THEN 1 ELSE 0 END) AS missing_thumbnail
   FROM videos
   WHERE status = 'published'`
);
console.log('--- videos summary ---');
console.table(videos);

await closePool();
