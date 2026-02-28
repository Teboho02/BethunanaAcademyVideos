import dotenv from 'dotenv';

dotenv.config();

const toNumber = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toNonEmptyString = (value: string | undefined, fallback: string): string => {
  if (!value) return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
};

export const env = {
  NODE_ENV: toNonEmptyString(process.env.NODE_ENV, 'development'),
  PORT: toNumber(process.env.PORT, 4000),
  CORS_ORIGIN: toNonEmptyString(process.env.CORS_ORIGIN, 'http://localhost:5173'),

  MYSQL_HOST: toNonEmptyString(process.env.MYSQL_HOST, 'localhost'),
  MYSQL_PORT: toNumber(process.env.MYSQL_PORT, 3306),
  MYSQL_USER: toNonEmptyString(process.env.MYSQL_USER, 'root'),
  MYSQL_PASSWORD: process.env.MYSQL_PASSWORD ?? '',
  MYSQL_DATABASE: toNonEmptyString(process.env.MYSQL_DATABASE, 'bethunana'),

  S3_REGION: toNonEmptyString(process.env.S3_REGION, ''),
  S3_BUCKET: toNonEmptyString(process.env.S3_BUCKET, ''),
  S3_ACCESS_KEY_ID: toNonEmptyString(process.env.S3_ACCESS_KEY_ID, ''),
  S3_SECRET_ACCESS_KEY: toNonEmptyString(process.env.S3_SECRET_ACCESS_KEY, ''),
  S3_ENDPOINT: toNonEmptyString(process.env.S3_ENDPOINT, ''),
  CDN_BASE_URL: toNonEmptyString(process.env.CDN_BASE_URL, ''),

  LOCAL_VIDEO_STORAGE_PATH: toNonEmptyString(
    process.env.LOCAL_VIDEO_STORAGE_PATH,
    './storage/videos'
  ),
  VIDEO_STREAM_CHUNK_SIZE: toNumber(process.env.VIDEO_STREAM_CHUNK_SIZE, 1024 * 1024),
  MAX_UPLOAD_BYTES: toNumber(process.env.MAX_UPLOAD_BYTES, 1024 * 1024 * 1024),
  MEDIA_JOB_POLL_INTERVAL_MS: toNumber(process.env.MEDIA_JOB_POLL_INTERVAL_MS, 2000),
  MEDIA_JOB_RETRY_DELAY_MS: toNumber(process.env.MEDIA_JOB_RETRY_DELAY_MS, 10000),
  ADMIN_STUDENT_NUMBER: toNonEmptyString(process.env.ADMIN_STUDENT_NUMBER, 'ADMIN001')
} as const;
