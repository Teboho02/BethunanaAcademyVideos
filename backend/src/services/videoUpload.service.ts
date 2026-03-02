import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2';
import { env } from '../config/env.js';
import { getMySqlPool } from '../config/mysql.js';
import type { UploadVideoInput, VideoAsset, VideoStorageType } from '../types/index.js';
import { HttpError } from '../types/index.js';
import { saveThumbnailToLocalStorage, saveVideoToLocalStorage } from './storage/localVideoStorage.service.js';
import { enqueueVideoPostUploadJob } from './mediaJobs.service.js';
import { buildS3ThumbnailKey, buildS3VideoKey, uploadBufferToS3 } from './storage/s3.service.js';
import { ensureVideoThumbnailColumns } from './videoSchema.service.js';

interface SubjectRow extends RowDataPacket {
  id: number;
}

interface TopicRow extends RowDataPacket {
  id: number;
}

interface VideoRow extends RowDataPacket {
  id: string;
  title: string;
  description: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  storage_type: 'local' | 's3';
  s3_bucket: string | null;
  s3_key: string | null;
  local_path: string | null;
  thumbnail_storage_type: 'local' | 's3' | null;
  thumbnail_s3_bucket: string | null;
  thumbnail_s3_key: string | null;
  thumbnail_local_path: string | null;
  thumbnail_mime_type: string | null;
  created_at: Date;
  updated_at: Date;
  subject_code: string;
  topic_id: number;
}

const VIDEO_SELECT_SQL = `
  SELECT
    v.id,
    v.title,
    v.description,
    v.original_filename,
    v.mime_type,
    v.size_bytes,
    v.storage_type,
    v.s3_bucket,
    v.s3_key,
    v.local_path,
    v.thumbnail_storage_type,
    v.thumbnail_s3_bucket,
    v.thumbnail_s3_key,
    v.thumbnail_local_path,
    v.thumbnail_mime_type,
    v.created_at,
    v.updated_at,
    s.code AS subject_code,
    t.id AS topic_id
  FROM videos v
  JOIN topics t ON t.id = v.topic_id
  JOIN subjects s ON s.id = t.subject_id
  WHERE v.status = 'published'
`;

const rowToVideoAsset = (row: VideoRow): VideoAsset => ({
  id: row.id,
  title: row.title,
  description: row.description,
  subjectId: row.subject_code,
  topicId: String(row.topic_id),
  originalFilename: row.original_filename,
  mimeType: row.mime_type,
  sizeBytes: Number(row.size_bytes),
  storageType: row.storage_type as VideoStorageType,
  s3Bucket: row.s3_bucket ?? undefined,
  s3Key: row.s3_key ?? undefined,
  localPath: row.local_path ?? undefined,
  thumbnailStorageType: row.thumbnail_storage_type ?? undefined,
  thumbnailS3Bucket: row.thumbnail_s3_bucket ?? undefined,
  thumbnailS3Key: row.thumbnail_s3_key ?? undefined,
  thumbnailLocalPath: row.thumbnail_local_path ?? undefined,
  thumbnailMimeType: row.thumbnail_mime_type ?? undefined,
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString()
});

const isS3Configured = (): boolean => Boolean(env.S3_REGION && env.S3_BUCKET);

export const uploadVideoAndRegister = async (
  file: Express.Multer.File,
  metadata: UploadVideoInput
): Promise<VideoAsset> => {
  if (!file) throw new HttpError(400, 'Video file is required');
  await ensureVideoThumbnailColumns();

  const title = metadata.title.trim();
  if (!title) throw new HttpError(400, 'Video title is required');

  const subjectCode = metadata.subjectId?.trim() ?? '';
  if (!subjectCode) throw new HttpError(400, 'Subject is required');

  const topicIdInput = metadata.topicId?.trim() ?? '';
  if (!topicIdInput) throw new HttpError(400, 'Topic is required');

  const pool = getMySqlPool();

  const [adminRows] = await pool.query<RowDataPacket[]>(
    'SELECT id FROM users WHERE student_number = ? AND role = "admin" LIMIT 1',
    [env.ADMIN_STUDENT_NUMBER]
  );
  const adminId = (adminRows[0] as { id?: string } | undefined)?.id;
  if (!adminId) {
    throw new HttpError(500, 'Admin user not found in database. Run the DB seed SQL first.');
  }

  const [subjectRows] = await pool.query<SubjectRow[]>(
    'SELECT id FROM subjects WHERE code = ? AND is_active = 1 LIMIT 1',
    [subjectCode]
  );
  const subjectDbId = subjectRows[0]?.id;
  if (!subjectDbId) {
    throw new HttpError(404, 'Subject not found');
  }

  const [topicRows] = await pool.query<TopicRow[]>(
    'SELECT id FROM topics WHERE id = ? AND subject_id = ? AND is_active = 1 LIMIT 1',
    [topicIdInput, subjectDbId]
  );
  const topicDbId = topicRows[0]?.id;
  if (!topicDbId) {
    throw new HttpError(404, 'Topic not found for selected subject');
  }

  const description = metadata.description?.trim() ?? '';
  const videoId = randomUUID();
  const now = new Date().toISOString();
  const thumbnailFile = metadata.thumbnailFile;

  if (thumbnailFile) {
    if (!thumbnailFile.mimetype.startsWith('image/')) {
      throw new HttpError(400, 'Thumbnail must be an image');
    }

    if (thumbnailFile.size > 10 * 1024 * 1024) {
      throw new HttpError(400, 'Thumbnail size cannot exceed 10MB');
    }
  }

  let videoStorageType: VideoStorageType = 'local';
  let localPath: string | null = null;
  let s3Bucket: string | null = null;
  let s3Key: string | null = null;

  let thumbnailStorageType: VideoStorageType | null = null;
  let thumbnailLocalPath: string | null = null;
  let thumbnailS3Bucket: string | null = null;
  let thumbnailS3Key: string | null = null;
  let thumbnailMimeType: string | null = null;

  if (isS3Configured()) {
    videoStorageType = 's3';
    s3Key = buildS3VideoKey(file.originalname);
    s3Bucket = env.S3_BUCKET;
    await uploadBufferToS3(s3Key, file.buffer, file.mimetype);

    if (thumbnailFile) {
      thumbnailStorageType = 's3';
      thumbnailS3Key = buildS3ThumbnailKey(thumbnailFile.originalname || `${videoId}.jpg`);
      thumbnailS3Bucket = env.S3_BUCKET;
      thumbnailMimeType = thumbnailFile.mimetype || 'image/jpeg';
      await uploadBufferToS3(thumbnailS3Key, thumbnailFile.buffer, thumbnailMimeType);
    }
  } else {
    const localStored = await saveVideoToLocalStorage(file);
    localPath = localStored.storageKey;

    if (thumbnailFile) {
      const localThumb = await saveThumbnailToLocalStorage(thumbnailFile);
      thumbnailStorageType = 'local';
      thumbnailLocalPath = localThumb.storageKey;
      thumbnailMimeType = thumbnailFile.mimetype || 'image/jpeg';
    }
  }

  await pool.query(
    `INSERT INTO videos
       (id, topic_id, title, description, original_filename, mime_type, size_bytes,
        storage_type, local_path, s3_bucket, s3_key,
        thumbnail_storage_type, thumbnail_local_path, thumbnail_s3_bucket, thumbnail_s3_key, thumbnail_mime_type,
        uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      videoId,
      topicDbId,
      title,
      description,
      file.originalname,
      file.mimetype,
      file.size,
      videoStorageType,
      localPath,
      s3Bucket,
      s3Key,
      thumbnailStorageType,
      thumbnailLocalPath,
      thumbnailS3Bucket,
      thumbnailS3Key,
      thumbnailMimeType,
      adminId
    ]
  );
  await enqueueVideoPostUploadJob(videoId);

  return {
    id: videoId,
    title,
    description,
    subjectId: subjectCode,
    topicId: String(topicDbId),
    originalFilename: file.originalname,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    storageType: videoStorageType,
    s3Bucket: s3Bucket ?? undefined,
    s3Key: s3Key ?? undefined,
    localPath: localPath ?? undefined,
    thumbnailStorageType: thumbnailStorageType ?? undefined,
    thumbnailS3Bucket: thumbnailS3Bucket ?? undefined,
    thumbnailS3Key: thumbnailS3Key ?? undefined,
    thumbnailLocalPath: thumbnailLocalPath ?? undefined,
    thumbnailMimeType: thumbnailMimeType ?? undefined,
    createdAt: now,
    updatedAt: now
  };
};

export const listVideoAssets = async (): Promise<VideoAsset[]> => {
  await ensureVideoThumbnailColumns();
  const pool = getMySqlPool();
  const [rows] = await pool.query<VideoRow[]>(`${VIDEO_SELECT_SQL} ORDER BY v.created_at DESC`);
  return rows.map(rowToVideoAsset);
};

export const deleteVideoAsset = async (videoId: string): Promise<void> => {
  const pool = getMySqlPool();
  const [result] = await pool.query<import('mysql2').ResultSetHeader>(
    'DELETE FROM videos WHERE id = ?',
    [videoId]
  );
  if (result.affectedRows === 0) throw new HttpError(404, 'Video not found');
};

export const getVideoAssetById = async (videoId: string): Promise<VideoAsset | null> => {
  await ensureVideoThumbnailColumns();
  const pool = getMySqlPool();
  const [rows] = await pool.query<VideoRow[]>(
    `${VIDEO_SELECT_SQL} AND v.id = ? LIMIT 1`,
    [videoId]
  );
  if (!rows[0]) return null;
  return rowToVideoAsset(rows[0]);
};
