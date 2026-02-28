import type { RowDataPacket } from 'mysql2';
import { getMySqlPool } from '../config/mysql.js';
import { HttpError } from '../types/index.js';

interface WatchProgressRow extends RowDataPacket {
  video_id: string;
  student_number: string;
  last_position_seconds: number;
  total_watched_seconds: number;
  updated_at: Date | string;
}

interface WatchProgressRecord {
  videoId: string;
  studentNumber: string;
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

  const pool = getMySqlPool();
  await pool.query(
    `INSERT INTO watch_progress
       (video_id, student_number, last_position_seconds, total_watched_seconds)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       last_position_seconds = VALUES(last_position_seconds),
       total_watched_seconds = total_watched_seconds + VALUES(total_watched_seconds),
       updated_at = CURRENT_TIMESTAMP`,
    [cleanVideoId, cleanStudentNumber, nextPosition, nextDelta]
  );

  const [rows] = await pool.query<WatchProgressRow[]>(
    `SELECT
       video_id,
       student_number,
       last_position_seconds,
       total_watched_seconds,
       updated_at
     FROM watch_progress
     WHERE video_id = ? AND student_number = ?
     LIMIT 1`,
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

  const pool = getMySqlPool();
  const [rows] = await pool.query<WatchProgressRow[]>(
    `SELECT
       video_id,
       student_number,
       last_position_seconds,
       total_watched_seconds,
       updated_at
     FROM watch_progress
     WHERE video_id = ? AND student_number = ?
     LIMIT 1`,
    [cleanVideoId, cleanStudentNumber]
  );
  if (!rows[0]) return null;
  return mapProgressRow(rows[0]);
};

export const getVideoAnalytics = async (videoId: string) => {
  const cleanVideoId = videoId.trim();
  const pool = getMySqlPool();
  const [rows] = await pool.query<WatchProgressRow[]>(
    `SELECT
       video_id,
       student_number,
       last_position_seconds,
       total_watched_seconds,
       updated_at
     FROM watch_progress
     WHERE video_id = ?
     ORDER BY total_watched_seconds DESC`,
    [cleanVideoId]
  );

  return toVideoAnalytics(cleanVideoId, rows.map(mapProgressRow));
};

export const listAllVideoAnalytics = async () => {
  const pool = getMySqlPool();
  const [rows] = await pool.query<WatchProgressRow[]>(
    `SELECT
       video_id,
       student_number,
       last_position_seconds,
       total_watched_seconds,
       updated_at
     FROM watch_progress
     ORDER BY video_id ASC, total_watched_seconds DESC`
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
