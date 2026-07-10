import { execute, queryRows } from '../config/db.js';
import { HttpError } from '../types/index.js';

interface WatchProgressRow {
  video_id: string;
  student_number: string;
  first_name: string | null;
  last_name: string | null;
  last_position_seconds: number;
  total_watched_seconds: number;
  updated_at: Date | string;
}

interface WatchProgressRecord {
  videoId: string;
  studentNumber: string;
  name: string | null;
  surname: string | null;
  lastPositionSeconds: number;
  totalWatchedSeconds: number;
  updatedAt: string;
}

const toSafeNumber = (value: unknown): number => {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) {
    return 0;
  }
  return numberValue;
};

const mapProgressRow = (row: WatchProgressRow): WatchProgressRecord => ({
  videoId: row.video_id,
  studentNumber: row.student_number,
  name: row.first_name ?? null,
  surname: row.last_name ?? null,
  lastPositionSeconds: Number(row.last_position_seconds),
  totalWatchedSeconds: Number(row.total_watched_seconds),
  updatedAt: new Date(row.updated_at).toISOString()
});

const toVideoAnalytics = (videoId: string, records: WatchProgressRecord[]) => {
  const sorted = [...records].sort(
    (left, right) => right.totalWatchedSeconds - left.totalWatchedSeconds
  );
  const totalWatchedSeconds = sorted.reduce(
    (sum, viewer) => sum + viewer.totalWatchedSeconds,
    0
  );
  const viewerCount = sorted.length;

  return {
    videoId,
    viewerCount,
    totalWatchedSeconds,
    averageWatchSeconds: viewerCount > 0 ? totalWatchedSeconds / viewerCount : 0,
    viewers: sorted.map((viewer) => ({
      studentNumber: viewer.studentNumber,
      name: viewer.name,
      surname: viewer.surname,
      totalWatchedSeconds: viewer.totalWatchedSeconds,
      lastPositionSeconds: viewer.lastPositionSeconds,
      updatedAt: viewer.updatedAt
    }))
  };
};

export const saveWatchProgress = async (
  videoId: string,
  studentNumber: string,
  positionSeconds: unknown,
  watchedSecondsDelta: unknown
): Promise<WatchProgressRecord> => {
  const cleanVideoId = videoId.trim();
  const cleanStudentNumber = studentNumber.trim();
  if (!cleanVideoId) {
    throw new HttpError(400, 'Video id is required');
  }
  if (!cleanStudentNumber) {
    throw new HttpError(400, 'Student number is required');
  }

  const nextPosition = toSafeNumber(positionSeconds);
  const nextDelta = toSafeNumber(watchedSecondsDelta);

  // Upsert (replaces MySQL's INSERT ... ON DUPLICATE KEY UPDATE).
  await execute(
    `MERGE watch_progress WITH (HOLDLOCK) AS target
     USING (SELECT ? AS video_id, ? AS student_number, ? AS position_seconds, ? AS watched_delta) AS source
     ON target.video_id = source.video_id AND target.student_number = source.student_number
     WHEN MATCHED THEN UPDATE SET
       last_position_seconds = source.position_seconds,
       total_watched_seconds = target.total_watched_seconds + source.watched_delta,
       updated_at = GETDATE()
     WHEN NOT MATCHED THEN INSERT
       (video_id, student_number, last_position_seconds, total_watched_seconds)
       VALUES (source.video_id, source.student_number, source.position_seconds, source.watched_delta);`,
    [cleanVideoId, cleanStudentNumber, nextPosition, nextDelta]
  );

  const rows = await queryRows<WatchProgressRow>(
    `SELECT TOP 1
       video_id,
       student_number,
       last_position_seconds,
       total_watched_seconds,
       updated_at
     FROM watch_progress
     WHERE video_id = ? AND student_number = ?`,
    [cleanVideoId, cleanStudentNumber]
  );

  if (!rows[0]) {
    throw new HttpError(500, 'Failed to save watch progress');
  }

  return mapProgressRow(rows[0]);
};

export const getWatchProgress = async (
  videoId: string,
  studentNumber: string
): Promise<WatchProgressRecord | null> => {
  const cleanVideoId = videoId.trim();
  const cleanStudentNumber = studentNumber.trim();
  if (!cleanVideoId || !cleanStudentNumber) {
    return null;
  }

  const rows = await queryRows<WatchProgressRow>(
    `SELECT TOP 1
       video_id,
       student_number,
       last_position_seconds,
       total_watched_seconds,
       updated_at
     FROM watch_progress
     WHERE video_id = ? AND student_number = ?`,
    [cleanVideoId, cleanStudentNumber]
  );
  if (!rows[0]) return null;
  return mapProgressRow(rows[0]);
};

export const getVideoAnalytics = async (videoId: string) => {
  const cleanVideoId = videoId.trim();
  const rows = await queryRows<WatchProgressRow>(
    `SELECT
       wp.video_id,
       wp.student_number,
       s.first_name,
       s.last_name,
       wp.last_position_seconds,
       wp.total_watched_seconds,
       wp.updated_at
     FROM watch_progress wp
     LEFT JOIN users u ON LOWER(u.student_number) = LOWER(wp.student_number)
     LEFT JOIN students s ON s.user_id = u.id
     WHERE wp.video_id = ?
     ORDER BY wp.total_watched_seconds DESC`,
    [cleanVideoId]
  );

  return toVideoAnalytics(cleanVideoId, rows.map(mapProgressRow));
};

export const listAllVideoAnalytics = async () => {
  const rows = await queryRows<WatchProgressRow>(
    `SELECT
       wp.video_id,
       wp.student_number,
       s.first_name,
       s.last_name,
       wp.last_position_seconds,
       wp.total_watched_seconds,
       wp.updated_at
     FROM watch_progress wp
     LEFT JOIN users u ON LOWER(u.student_number) = LOWER(wp.student_number)
     LEFT JOIN students s ON s.user_id = u.id
     ORDER BY wp.video_id ASC, wp.total_watched_seconds DESC`
  );

  const byVideo = new Map<string, WatchProgressRecord[]>();
  for (const row of rows) {
    const mapped = mapProgressRow(row);
    const list = byVideo.get(mapped.videoId) ?? [];
    list.push(mapped);
    byVideo.set(mapped.videoId, list);
  }

  return [...byVideo.entries()].map(([videoId, records]) =>
    toVideoAnalytics(videoId, records)
  );
};
