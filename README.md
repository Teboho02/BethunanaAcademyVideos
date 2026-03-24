# Bethunana Academy Platform

Full-stack learning platform for Grade 10-12 learners, with:
- a React + Vite frontend learner/admin portal
- an Express + TypeScript backend API
- a MySQL-backed content and student account model
- optional S3/Lightsail storage for uploaded lesson videos
- watch progress + analytics tracking

Original design source:  
https://www.figma.com/design/k5ZHhCe6dIeNXLK7hwsAi0/Bethunana-Academy-Platform-Design

## Table of Contents

1. [Overview](#overview)
2. [Core Features](#core-features)
3. [Architecture](#architecture)
4. [Tech Stack](#tech-stack)
5. [Project Structure](#project-structure)
6. [Prerequisites](#prerequisites)
7. [Quick Start (Full Stack)](#quick-start-full-stack)
8. [Environment Variables](#environment-variables)
9. [Available Scripts](#available-scripts)
10. [API Summary](#api-summary)
11. [Database Notes](#database-notes)
12. [Testing](#testing)
13. [Build and Production Run](#build-and-production-run)
14. [Troubleshooting](#troubleshooting)
15. [Security Notes](#security-notes)

## Overview

Bethunana Academy is a curriculum-aligned video learning platform.

The frontend supports:
- student and admin login by student number
- grade/subject/topic navigation
- video playback with progress resume
- admin workflows for uploads, topics, students, and analytics

The backend provides:
- student enrollment and lifecycle management
- catalog APIs for subjects/topics/videos
- video upload + streaming (local storage or S3)
- watch progress persistence + analytics aggregation
- a media worker process for post-upload jobs

## Core Features

### Learner Experience
- Login with student number
- Browse by grade and subject
- Explore topic lessons
- Watch videos with local + backend progress sync
- Profile page and session persistence in `localStorage`

### Admin Experience
- Dashboard with quick actions and content summary
- Upload lesson videos with auto-generated thumbnail
- Manage lessons (filter/search + watcher insights)
- Manage topics (create, rename, delete)
- Manage students (enroll, deactivate, delete)
- Video analytics per lesson and per student

### Backend Capabilities
- MySQL-backed users/students/subjects/topics/videos/watch progress
- Range-based video streaming (`206 Partial Content`)
- Thumbnail serving (local, S3, or CDN redirect)
- Queue-based media jobs via background worker

## Architecture

Development flow:

1. Frontend runs on `http://localhost:5173` (Vite).
2. `/api/*` requests are proxied to backend on `http://localhost:4000`.
3. Backend talks to MySQL and local filesystem or S3-compatible object storage.
4. A worker process polls and processes `media_jobs`.

Production flow:

1. Build frontend to root `dist/`.
2. Build backend to `backend/dist/`.
3. Start backend; it serves API and (if present) frontend static files.

## Tech Stack

### Frontend
- React 18
- TypeScript
- Vite 6
- React Router 7
- Tailwind CSS 4
- Radix UI primitives + custom UI components
- Lucide icons
- Recharts (admin dashboards)

### Backend
- Node.js + Express 4
- TypeScript
- MySQL 8 (`mysql2`)
- Multer for multipart uploads
- AWS SDK v3 (S3 integration)
- Vitest + Supertest (integration tests)

## Project Structure

```text
.
|-- src/                        # Frontend app
|   |-- app/
|   |   |-- pages/              # Learner + admin pages
|   |   |-- services/           # Frontend API clients
|   |   |-- components/         # Shared UI + app components
|   |   |-- hooks/              # Catalog hook
|   |   |-- routes.tsx          # Route guards and route map
|   |   `-- App.tsx
|   `-- styles/
|-- backend/
|   |-- src/
|   |   |-- controllers/        # HTTP handlers
|   |   |-- routes/             # API routing
|   |   |-- services/           # Business logic + storage adapters
|   |   |-- data/               # Catalog projection layer
|   |   |-- workers/            # Media job worker
|   |   `-- scripts/            # Seeding scripts
|   |-- schema/mysql-schema.sql # DB schema + seed baseline
|   `-- scripts/run-api-worker.mjs
|-- public/
|-- dist/                       # Frontend build output
`-- documentation.md
```

## Prerequisites

- Node.js 20+ (recommended)
- npm 10+
- MySQL 8+

## Quick Start (Full Stack)

### 1) Install Dependencies

From the repository root:

```bash
npm install
cd backend
npm install
```

### 2) Configure Backend Environment

Copy backend env template and set real values:

```bash
cd backend
cp .env.example .env
```

At minimum, configure:
- `MYSQL_HOST`
- `MYSQL_PORT`
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `MYSQL_DATABASE`

Optional storage modes:
- S3 mode: set `S3_REGION` + `S3_BUCKET` (and credentials as needed)
- Local mode fallback: keep S3 fields empty and use `LOCAL_VIDEO_STORAGE_PATH`

### 3) Create Database Schema

Run schema script in MySQL:

```sql
SOURCE backend/schema/mysql-schema.sql;
```

This creates core tables and inserts baseline seed data, including:
- default admin user with student number `ADMIN001` (or your configured `ADMIN_STUDENT_NUMBER`)
- initial Grade 10-12 subject records

### 4) Optional Topic Seeding

From `backend/`:

```bash
npm run seed:grade10-subjects
npm run seed:grade10-topics
npm run seed:grade11-topics
npm run seed:grade12-topics
```

### 5) Start Backend (API + Worker)

From `backend/`:

```bash
npm run dev
```

This runs:
- API server (`src/index.tsx`)
- media worker (`src/workers/mediaJobs.worker.ts`)

### 6) Start Frontend

From repository root (new terminal):

```bash
npm run dev
```

Frontend URL:
- `http://localhost:5173`

Backend URL:
- `http://localhost:4000`

Health check:
- `GET http://localhost:4000/api/health`

## Environment Variables

### Frontend (root)

The frontend currently does not require runtime env variables for local development.
API calls use relative `/api/*` paths and Vite proxy forwarding to `localhost:4000`.

### Backend (`backend/.env`)

Important variables:

- `NODE_ENV` (default: `development`)
- `PORT` (default: `4000`)
- `CORS_ORIGIN` (default: `http://localhost:5173`)
- `MYSQL_HOST`
- `MYSQL_PORT`
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `MYSQL_DATABASE`
- `ADMIN_STUDENT_NUMBER` (default: `ADMIN001`)
- `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`
- `S3_ENDPOINT` (optional S3-compatible endpoint)
- `CDN_BASE_URL` (optional)
- `LOCAL_VIDEO_STORAGE_PATH`
- `VIDEO_STREAM_CHUNK_SIZE`
- `MAX_UPLOAD_BYTES`
- `MEDIA_JOB_POLL_INTERVAL_MS`
- `MEDIA_JOB_RETRY_DELAY_MS`

## Available Scripts

### Root (`package.json`)

- `npm run dev` - start Vite frontend dev server
- `npm run build` - build frontend bundle to `dist/`
- `npm run lint` - currently aliased to `npm run build`
- `npm run test` - currently aliased to `npm run build`

### Backend (`backend/package.json`)

- `npm run dev` - run API + worker in watch mode
- `npm run dev:api` - run API only (watch)
- `npm run dev:worker` - run worker only (watch)
- `npm run build` - compile backend TS to `backend/dist`
- `npm run start` - run compiled API + worker
- `npm run start:api` - run compiled API only
- `npm run start:worker` - run compiled worker only
- `npm run seed:grade10-subjects`
- `npm run seed:grade10-topics`
- `npm run seed:grade11-topics`
- `npm run seed:grade12-topics`
- `npm run typecheck`
- `npm run test`
- `npm run test:watch`

## API Summary

Base path: `/api`

### Health
- `GET /health`

### Auth
- `POST /auth/login`
  - Body: `{ "studentNumber": "..." }`
  - Admin login is matched against `ADMIN_STUDENT_NUMBER`

### Student Management
- `GET /admin/students`
- `POST /admin/students/enroll`
- `PATCH /admin/students/:id/deactivate`
- `DELETE /admin/students/:id`

### Topic Management
- `GET /admin/topics`
- `POST /admin/topics`
- `PATCH /admin/topics/:id`
- `DELETE /admin/topics/:id`

### Content Catalog
- `GET /content/catalog`
- `GET /content/videos/:id`
- `DELETE /content/videos/:id` (compatibility alias)
- `POST /content/topics`

### Video + Analytics
- `POST /videos/upload` (`multipart/form-data`, field `video`, optional `thumbnail`)
- `GET /videos`
- `DELETE /videos/:id`
- `GET /videos/:id/stream`
- `GET /videos/:id/thumbnail`
- `POST /videos/:id/progress`
- `GET /videos/:id/progress?studentNumber=...`
- `GET /videos/analytics`
- `GET /videos/:id/analytics`

## Database Notes

Schema file: `backend/schema/mysql-schema.sql`

Main tables:
- `users` (admin/student identities + student numbers)
- `students` (student profile fields)
- `subjects` (grade-scoped subject taxonomy)
- `topics` (subject topics)
- `videos` (storage metadata + publication status)
- `watch_progress` (resume + watch-time tracking)
- `media_jobs` (worker queue)

## Testing

Backend tests are integration-style and are skipped unless explicitly enabled:

```bash
cd backend
RUN_BACKEND_INTEGRATION_TESTS=true npm run test
```

Tests validate flows such as:
- health endpoint
- student lifecycle (enroll/list/deactivate/delete)
- video upload + range streaming behavior
- catalog inclusion for uploaded videos

## Build and Production Run

### 1) Build Frontend

From repository root:

```bash
npm run build
```

### 2) Build Backend

From `backend/`:

```bash
npm run build
```

### 3) Start Backend

From `backend/`:

```bash
npm run start
```

If root `dist/index.html` exists, backend serves the frontend alongside API routes.

## Troubleshooting

- Frontend cannot reach API:
  - Ensure backend is running on `http://localhost:4000`
  - Confirm Vite proxy config is active (`vite.config.ts`)

- Startup fails with MySQL connection error:
  - Verify `MYSQL_*` env values
  - Confirm DB exists and schema was applied

- Upload works but playback fails:
  - Check `videos` rows have valid storage metadata
  - For local storage, verify files exist under `LOCAL_VIDEO_STORAGE_PATH`
  - For S3, verify bucket/region/credentials and object keys

- Topic deletion fails:
  - This is expected when published videos still reference the topic

- CORS errors:
  - Ensure `CORS_ORIGIN` includes frontend origin (`http://localhost:5173` in dev)

## Security Notes

- Never commit real secrets in `.env` files.
- If credentials were exposed, rotate them immediately.
- Use least-privilege IAM credentials for S3 access.
- Keep production `ADMIN_STUDENT_NUMBER` private and non-default..
