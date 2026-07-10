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
