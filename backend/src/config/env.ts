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
  // Defaults cover the Vite web frontend, the Expo (mobile app) web/dev client,
  // and the production site. Native mobile requests send no Origin header and
  // are never CORS-blocked.
  CORS_ORIGIN: toNonEmptyString(
    process.env.CORS_ORIGIN,
    'http://localhost:5173,http://localhost:8081,https://bethunanaacademy.co.za'
  ),

  // Azure SQL Server, e.g. SQLSERVER_HOST=myserver.database.windows.net
  SQLSERVER_HOST: toNonEmptyString(process.env.SQLSERVER_HOST, 'localhost'),
  SQLSERVER_PORT: toNumber(process.env.SQLSERVER_PORT, 1433),
  SQLSERVER_USER: toNonEmptyString(process.env.SQLSERVER_USER, 'sa'),
  SQLSERVER_PASSWORD: process.env.SQLSERVER_PASSWORD ?? '',
  SQLSERVER_DATABASE: toNonEmptyString(process.env.SQLSERVER_DATABASE, 'bethunana'),
  SQLSERVER_ENCRYPT: (process.env.SQLSERVER_ENCRYPT ?? 'true').toLowerCase() !== 'false',

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
