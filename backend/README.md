# Bethunana Backend

Express + TypeScript backend for student account administration and video upload/streaming.

## Architecture

Source layout:

- `src/index.tsx`: main server entry point
- `src/app.ts`: express app setup, middleware, route mounting, error handling
- `src/routes/`: route definitions
- `src/controllers/`: HTTP handlers
- `src/services/`: business logic and storage services
- `src/config/`: environment and SQL Server config
- `src/data/contentCatalog.ts`: catalog projection from the subject/topic/video tables
- `schema/sqlserver-schema.sql`: SQL Server schema (`schema/mysql-schema.sql` is the legacy MySQL version, kept for reference)

The backend is backed by Azure SQL Server for student, topic, video, and watch analytics data.

## Environment Variables

Copy `.env.example` to `.env` and set values:

- `PORT`: API port (default `4000`)
- `CORS_ORIGIN`: allowed frontend origin(s), comma-separated
- `SQLSERVER_HOST` (e.g. `your-server.database.windows.net`), `SQLSERVER_PORT`, `SQLSERVER_USER`, `SQLSERVER_PASSWORD`, `SQLSERVER_DATABASE`
- `SQLSERVER_ENCRYPT` (default `true`; Azure SQL requires it — only set `false` for a local SQL Server without TLS)
- `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`
- `S3_ENDPOINT` (optional for S3-compatible providers)
- `LOCAL_VIDEO_STORAGE_PATH` (fallback local storage when S3 is not configured)
- `VIDEO_STREAM_CHUNK_SIZE` (default 1MB)
- `MAX_UPLOAD_BYTES` (default 1GB)
- `MEDIA_JOB_POLL_INTERVAL_MS` (worker poll interval, default 2000)
- `MEDIA_JOB_RETRY_DELAY_MS` (retry backoff, default 10000)

### AI practice questions (video -> transcript + frames -> Claude)

The worker can auto-generate multiple-choice practice questions for each video.
It downloads the video, extracts the audio, transcribes it with AWS Transcribe,
samples frames with ffmpeg, and asks Claude on Amazon Bedrock to write
questions. Only the transcript text and a few downscaled frames are sent to
Bedrock.

**Important — credentials.** Video storage (`S3_*`) is an AWS **Lightsail**
bucket. Lightsail bucket keys are scoped to that bucket only: they cannot call
Bedrock/Transcribe, and Transcribe cannot read a Lightsail bucket. So Bedrock +
Transcribe use their own dedicated IAM credentials (`AI_AWS_*`) and a **standard**
S3 bucket (`AI_TRANSCRIBE_BUCKET`) for the temporary audio/transcript. The worker
downloads the video to local disk first, so that temp bucket is independent of
where the video lives.

- `AI_QUESTIONS_ENABLED` (default `true`; set `false` to disable generation and backfill)
- `AI_QUESTIONS_BACKFILL_ON_STARTUP` (default `true`; set `false` to skip
  auto-generating for existing videos on worker startup — useful locally so you
  can generate one video on demand instead of the whole catalog)
- `AI_QUESTIONS_PER_VIDEO` (default `5`)
- `AI_QUESTION_FRAME_COUNT` (frames sampled per video, default `8`)
- `AI_AWS_ACCESS_KEY_ID` / `AI_AWS_SECRET_ACCESS_KEY` (dedicated IAM user; empty = default AWS chain)
- `AI_TRANSCRIBE_BUCKET` (standard S3 bucket in `TRANSCRIBE_REGION`, same account as `AI_AWS_*`)
- `TRANSCRIBE_REGION` (default `ap-southeast-1`), `TRANSCRIBE_LANGUAGE` (default `en-ZA`)
- `TRANSCRIBE_MAX_WAIT_MS` (default 20 min), `TRANSCRIBE_POLL_INTERVAL_MS` (default 8000)
- `BEDROCK_REGION` (default `ap-southeast-1`)
- `BEDROCK_MODEL_ID` (default `global.anthropic.claude-sonnet-4-5-20250929-v1:0`;
  verify with `aws bedrock list-inference-profiles --region <region>`)
- `BEDROCK_MAX_TOKENS` (default `4096`)

The `AI_AWS_*` IAM principal needs:

- `bedrock:InvokeModel` (attach the AWS-managed `AmazonBedrockLimitedAccess`
  policy — it also grants the `aws-marketplace` actions Bedrock models require)
- `transcribe:StartTranscriptionJob`, `transcribe:GetTranscriptionJob`
- `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` on `AI_TRANSCRIBE_BUCKET/*`
  and `s3:ListBucket` on the bucket

> Note: Claude Sonnet **4.6** currently fails on this account with
> `INVALID_PAYMENT_INSTRUMENT` (a Marketplace/billing issue, not IAM), so we use
> Sonnet **4.5**. Fix the account's default payment method to switch to 4.6 via
> `BEDROCK_MODEL_ID`.

Existing videos are backfilled on worker startup; admins can also (re)generate
per video via `POST /videos/:id/questions/generate`.

## Install and Run

```bash
cd backend
npm install
npm run dev
```

Build/start:

```bash
npm run build
npm run start
```

Run tests:

```bash
npm run test
```

## Endpoints

Base URL: `/api`

### Health

- `GET /health`

### Student Account Management

- `POST /admin/students/enroll`
  - Body: `{ "name": "Lerato", "surname": "Mokoena", "grade": 10 }`
  - Allowed grades: `10`, `11`, or `12`
  - Returns created student including generated `studentNumber`
- `GET /admin/students`
  - Returns all generated/enrolled students
- `PATCH /admin/students/:id/deactivate`
  - Marks account as `deactivated`
- `DELETE /admin/students/:id`
  - Removes student account

### Video Upload and Streaming

- `POST /videos/upload`
  - `multipart/form-data`
  - File field: `video`
  - Required fields: `subjectId`, `topicId`
  - Optional fields: `title`, `description`
  - Video bytes are uploaded to S3 when configured, otherwise stored locally.
- `GET /videos`
  - Returns uploaded video metadata list
- `DELETE /videos/:id`
  - Deletes a video by id
- `GET /videos/:id/stream`
  - Streams video via range requests/chunking
  - Backend handles `Range` headers and returns `206 Partial Content`
  - For S3 videos, backend fetches byte ranges from S3 and proxies chunk stream to clients
  - For local videos, backend streams from local filesystem

### Content Catalog

- `GET /content/catalog`
  - Returns frontend-ready catalog payload:
    - `grades`
    - `subjects`
    - `topics`
    - `videos`
  - Includes published videos from the database (`playerType: "stream"`).

## Database Schema

Create the `bethunana` database on your Azure SQL server first (portal or `az sql db create`), then apply the schema with `sqlcmd`:

```bash
sqlcmd -S your-server.database.windows.net -d bethunana -U <user> -P <password> -i backend/schema/sqlserver-schema.sql
```

The script is idempotent and also seeds the default admin (`ADMIN001` / `Password`) and the curriculum subjects. Remember to allow your app's outbound IP in the Azure SQL server firewall (or enable "Allow Azure services").

Tables:

- `students`: name/surname, generated student number, status
- `videos`: metadata including storage info (`s3` or `local`)
- `media_jobs`: background queue for post-upload media processing
