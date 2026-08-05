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
    'http://localhost:5173,http://localhost:8081,https://bethunanaacademy.co.za,https://www.bethunanaacademy.co.za'
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

  // AI practice-question generation.
  //
  // Video storage (S3_*) is a Lightsail bucket whose keys are scoped to that
  // bucket only — they cannot call Bedrock or Transcribe, and Transcribe cannot
  // read a Lightsail bucket. So Bedrock + Transcribe use their own dedicated IAM
  // credentials (AI_AWS_*) and a standard S3 bucket (AI_TRANSCRIBE_BUCKET) for
  // the temporary audio/transcript. The worker downloads the video locally
  // first, so the transcribe bucket is independent of where the video lives.
  AI_QUESTIONS_ENABLED:
    (process.env.AI_QUESTIONS_ENABLED ?? 'true').toLowerCase() !== 'false',
  // When false, the worker does NOT auto-enqueue generation for existing videos
  // on startup — useful for local testing so you can generate one video on
  // demand (admin "Generate" button) instead of backfilling the whole catalog.
  AI_QUESTIONS_BACKFILL_ON_STARTUP:
    (process.env.AI_QUESTIONS_BACKFILL_ON_STARTUP ?? 'true').toLowerCase() !== 'false',
  AI_QUESTIONS_PER_VIDEO: toNumber(process.env.AI_QUESTIONS_PER_VIDEO, 15),
  AI_QUESTION_FRAME_COUNT: toNumber(process.env.AI_QUESTION_FRAME_COUNT, 8),
  // When true, the admin "Generate" endpoint runs generation IN-PROCESS on the
  // API instead of enqueuing to the shared media_jobs queue. Use this when the
  // DB is shared with another backend whose worker runs older code and would
  // otherwise claim and fail 'video_generate_questions' jobs it doesn't know.
  AI_QUESTIONS_INLINE:
    (process.env.AI_QUESTIONS_INLINE ?? 'false').toLowerCase() === 'true',

  // Dedicated IAM credentials for Bedrock + Transcribe. Leave empty to use the
  // default AWS credential chain (e.g. an instance role).
  AI_AWS_ACCESS_KEY_ID: toNonEmptyString(process.env.AI_AWS_ACCESS_KEY_ID, ''),
  AI_AWS_SECRET_ACCESS_KEY: toNonEmptyString(process.env.AI_AWS_SECRET_ACCESS_KEY, ''),

  // AWS Transcribe. AI_TRANSCRIBE_BUCKET must be a standard S3 bucket in
  // TRANSCRIBE_REGION owned by the same account as AI_AWS_* (NOT the Lightsail
  // video bucket).
  AI_TRANSCRIBE_BUCKET: toNonEmptyString(process.env.AI_TRANSCRIBE_BUCKET, ''),
  TRANSCRIBE_REGION: toNonEmptyString(process.env.TRANSCRIBE_REGION, 'ap-southeast-1'),
  TRANSCRIBE_LANGUAGE: toNonEmptyString(process.env.TRANSCRIBE_LANGUAGE, 'en-ZA'),
  TRANSCRIBE_MAX_WAIT_MS: toNumber(process.env.TRANSCRIBE_MAX_WAIT_MS, 20 * 60 * 1000),
  TRANSCRIBE_POLL_INTERVAL_MS: toNumber(process.env.TRANSCRIBE_POLL_INTERVAL_MS, 8000),

  // Bedrock (Claude). Sonnet 4.5 is used because 4.6 requires a new Marketplace
  // subscription this account cannot currently complete (billing). Verify ids
  // with `aws bedrock list-inference-profiles --region <region>`.
  BEDROCK_REGION: toNonEmptyString(process.env.BEDROCK_REGION, 'ap-southeast-1'),
  BEDROCK_MODEL_ID: toNonEmptyString(
    process.env.BEDROCK_MODEL_ID,
    'global.anthropic.claude-sonnet-4-5-20250929-v1:0'
  ),
  // Sized for the full AI_QUESTIONS_PER_VIDEO set (15 questions x stem + 4
  // options + explanation). 4096 truncates the tool call well before 15
  // questions are emitted, so the model returns fewer than requested.
  BEDROCK_MAX_TOKENS: toNumber(process.env.BEDROCK_MAX_TOKENS, 8192),

  LOCAL_VIDEO_STORAGE_PATH: toNonEmptyString(
    process.env.LOCAL_VIDEO_STORAGE_PATH,
    './storage/videos'
  ),
  VIDEO_STREAM_CHUNK_SIZE: toNumber(process.env.VIDEO_STREAM_CHUNK_SIZE, 1024 * 1024),
  MAX_UPLOAD_BYTES: toNumber(process.env.MAX_UPLOAD_BYTES, 1024 * 1024 * 1024),
  MEDIA_JOB_POLL_INTERVAL_MS: toNumber(process.env.MEDIA_JOB_POLL_INTERVAL_MS, 2000),
  MEDIA_JOB_RETRY_DELAY_MS: toNumber(process.env.MEDIA_JOB_RETRY_DELAY_MS, 10000),
  ADMIN_STUDENT_NUMBER: toNonEmptyString(process.env.ADMIN_STUDENT_NUMBER, 'ADMIN001'),

  // Signs session cookies. Set in production so sessions survive restarts.
  JWT_SECRET: toNonEmptyString(process.env.JWT_SECRET, ''),
  // Shared secret for server-to-server enrollment sync with the exams
  // platform. Must match the exams platform's SyncSecret setting.
  ENROLL_SYNC_SECRET: toNonEmptyString(process.env.ENROLL_SYNC_SECRET, ''),

  // Grade 10-12 learners authenticate against the exams platform and watch
  // videos here with that exams JWT (they have no separate videos session).
  // These let this service verify an exams token for content access — they must
  // match the exams platform's Jwt:Key / Jwt:Issuer / Jwt:Audience.
  EXAMS_JWT_SECRET: toNonEmptyString(
    process.env.EXAMS_JWT_SECRET,
    'BethunanaAcademy_SuperSecretKey_ChangeInProd_2024'
  ),
  EXAMS_JWT_ISSUER: toNonEmptyString(process.env.EXAMS_JWT_ISSUER, 'BethunanaAPI'),
  EXAMS_JWT_AUDIENCE: toNonEmptyString(process.env.EXAMS_JWT_AUDIENCE, 'BethunanaAcademyClient')
} as const;
