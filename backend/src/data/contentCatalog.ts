import type { RowDataPacket } from 'mysql2';
import { env } from '../config/env.js';
import { getMySqlPool } from '../config/mysql.js';
import type { ContentCatalog, ContentSubject, ContentTopic, ContentVideo } from '../types/index.js';
import { ensureVideoThumbnailColumns } from '../services/videoSchema.service.js';

interface SubjectRow extends RowDataPacket {
  code: string;
  name: string;
  description: string | null;
}

interface TopicRow extends RowDataPacket {
  id: number;
  name: string;
  subject_code: string;
  video_count: number;
}

interface VideoRow extends RowDataPacket {
  id: string;
  title: string;
  description: string;
  duration_seconds: number | null;
  created_at: Date;
  subject_code: string;
  topic_id: number;
  storage_type: 'local' | 's3';
  s3_key: string | null;
  thumbnail_storage_type: 'local' | 's3' | null;
  thumbnail_s3_key: string | null;
  thumbnail_local_path: string | null;
}

const defaultThumbnailBySubject: Record<string, string> = {
  mathematics: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800&q=80',
  'physical-sciences': 'https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?w=800&q=80',
  'life-sciences': 'https://images.unsplash.com/photo-1576086213369-97a306d36557?w=800&q=80'
};

const parseGradeFromSubjectCode = (subjectCode: string): number => {
  const match = /^g(\d+)-/i.exec(subjectCode.trim());
  if (!match) return 0;
  const grade = Number(match[1]);
  return Number.isFinite(grade) ? grade : 0;
};

const getBaseSubject = (subjectCode: string): string => subjectCode.replace(/^g\d+-/i, '');

const getSubjectIcon = (subjectCode: string): string => {
  const base = getBaseSubject(subjectCode);
  if (base === 'mathematics') return 'calculator';
  if (base === 'physical-sciences') return 'atom';
  if (base === 'life-sciences') return 'leaf';
  return 'book-open';
};

const getSubjectThumbnail = (subjectCode: string): string => {
  const base = getBaseSubject(subjectCode);
  return defaultThumbnailBySubject[base] ?? defaultThumbnailBySubject.mathematics;
};

const formatDuration = (durationSeconds: number | null): string => {
  if (!Number.isFinite(durationSeconds) || (durationSeconds ?? 0) <= 0) {
    return '00:00';
  }

  const total = Math.floor(Number(durationSeconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  const two = (value: number): string => String(value).padStart(2, '0');
  if (hours > 0) {
    return `${hours}:${two(minutes)}:${two(seconds)}`;
  }
  return `${two(minutes)}:${two(seconds)}`;
};

const toDateOnly = (value: Date): string => new Date(value).toISOString().slice(0, 10);

const normalizeBaseUrl = (value: string): string => value.replace(/\/+$/, '');

const buildVideoUrl = (row: VideoRow): string => {
  const cdnBase = normalizeBaseUrl(env.CDN_BASE_URL);
  if (row.storage_type === 's3' && cdnBase && row.s3_key) {
    return `${cdnBase}/${row.s3_key.replace(/^\/+/, '')}`;
  }
  return `/api/videos/${row.id}/stream`;
};

const buildThumbnailUrl = (row: VideoRow): string => {
  const cdnBase = normalizeBaseUrl(env.CDN_BASE_URL);
  if (row.thumbnail_storage_type === 's3' && cdnBase && row.thumbnail_s3_key) {
    return `${cdnBase}/${row.thumbnail_s3_key.replace(/^\/+/, '')}`;
  }

  if (
    (row.thumbnail_storage_type === 'local' && row.thumbnail_local_path) ||
    (row.thumbnail_storage_type === 's3' && row.thumbnail_s3_key)
  ) {
    return `/api/videos/${row.id}/thumbnail`;
  }

  return getSubjectThumbnail(row.subject_code);
};

const mapSubjectRow = (row: SubjectRow): ContentSubject => ({
  id: row.code,
  name: row.name,
  description: row.description ?? '',
  icon: getSubjectIcon(row.code),
  grade: parseGradeFromSubjectCode(row.code)
});

const mapTopicRow = (row: TopicRow): ContentTopic => ({
  id: String(row.id),
  name: row.name,
  subjectId: row.subject_code,
  videoCount: Number(row.video_count)
});

const mapVideoRow = (row: VideoRow): ContentVideo => ({
  id: row.id,
  title: row.title,
  description: row.description,
  duration: formatDuration(row.duration_seconds),
  videoUrl: buildVideoUrl(row),
  thumbnail: buildThumbnailUrl(row),
  topicId: String(row.topic_id),
  subjectId: row.subject_code,
  dateAdded: toDateOnly(row.created_at),
  playerType: 'stream'
});

export const listCatalogSubjects = async (): Promise<ContentSubject[]> => {
  const pool = getMySqlPool();
  const [rows] = await pool.query<SubjectRow[]>(
    `SELECT code, name, description
     FROM subjects
     WHERE is_active = 1
     ORDER BY code ASC`
  );
  return rows.map(mapSubjectRow);
};

export const listCatalogTopics = async (): Promise<ContentTopic[]> => {
  const pool = getMySqlPool();
  const [rows] = await pool.query<TopicRow[]>(
    `SELECT
       t.id,
       t.name,
       s.code AS subject_code,
       COUNT(v.id) AS video_count
     FROM topics t
     JOIN subjects s ON s.id = t.subject_id
     LEFT JOIN videos v ON v.topic_id = t.id AND v.status = 'published'
     WHERE t.is_active = 1
       AND s.is_active = 1
     GROUP BY t.id, t.name, s.code
     ORDER BY s.code ASC, t.sort_order ASC, t.name ASC`
  );
  return rows.map(mapTopicRow);
};

export const listCatalogVideos = async (): Promise<ContentVideo[]> => {
  await ensureVideoThumbnailColumns();
  const pool = getMySqlPool();
  const [rows] = await pool.query<VideoRow[]>(
    `SELECT
       v.id,
       v.title,
       v.description,
       v.duration_seconds,
       v.created_at,
       s.code AS subject_code,
       t.id AS topic_id,
       v.storage_type,
       v.s3_key,
       v.thumbnail_storage_type,
       v.thumbnail_s3_key,
       v.thumbnail_local_path
     FROM videos v
     JOIN topics t ON t.id = v.topic_id
     JOIN subjects s ON s.id = t.subject_id
     WHERE v.status = 'published'
       AND t.is_active = 1
       AND s.is_active = 1
     ORDER BY v.created_at DESC`
  );
  return rows.map(mapVideoRow);
};

export const getCatalogVideoById = async (videoId: string): Promise<ContentVideo | null> => {
  await ensureVideoThumbnailColumns();
  const pool = getMySqlPool();
  const [rows] = await pool.query<VideoRow[]>(
    `SELECT
       v.id,
       v.title,
       v.description,
       v.duration_seconds,
       v.created_at,
       s.code AS subject_code,
       t.id AS topic_id,
       v.storage_type,
       v.s3_key,
       v.thumbnail_storage_type,
       v.thumbnail_s3_key,
       v.thumbnail_local_path
     FROM videos v
     JOIN topics t ON t.id = v.topic_id
     JOIN subjects s ON s.id = t.subject_id
     WHERE v.id = ?
       AND v.status = 'published'
       AND t.is_active = 1
       AND s.is_active = 1
     LIMIT 1`,
    [videoId]
  );

  if (!rows[0]) return null;
  return mapVideoRow(rows[0]);
};

export const getCatalogPayload = async (): Promise<ContentCatalog> => {
  const [subjects, topics, videos] = await Promise.all([
    listCatalogSubjects(),
    listCatalogTopics(),
    listCatalogVideos()
  ]);

  const grades = [...new Set(subjects.map((subject) => subject.grade).filter((grade) => grade > 0))]
    .sort((left, right) => left - right);

  return {
    grades,
    subjects,
    topics,
    videos
  };
};
