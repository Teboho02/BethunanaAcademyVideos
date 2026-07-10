-- Bethunana backend schema (Azure SQL Server / SQL Server 2019+)
--
-- Rules reflected from product requirements:
-- 1) Student number + password are the login credentials.
-- 2) grade_level is stored on users only for non-admin users.
-- 3) Learner enrollment supports grades 10, 11, and 12.
--
-- Run against the database configured in SQLSERVER_DATABASE (create the
-- database first in the Azure portal — CREATE DATABASE is not run here
-- because Azure SQL logical servers manage databases separately).
--
-- Idempotent: safe to run more than once.

-- Identity and access
IF OBJECT_ID('dbo.users', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.users (
    id CHAR(36) NOT NULL,
    role VARCHAR(10) NOT NULL,
    student_number VARCHAR(32) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    grade_level TINYINT NULL,
    status VARCHAR(15) NOT NULL CONSTRAINT df_users_status DEFAULT 'active',
    created_at DATETIME2 NOT NULL CONSTRAINT df_users_created_at DEFAULT GETDATE(),
    updated_at DATETIME2 NOT NULL CONSTRAINT df_users_updated_at DEFAULT GETDATE(),
    CONSTRAINT pk_users PRIMARY KEY (id),
    CONSTRAINT uq_users_student_number UNIQUE (student_number),
    CONSTRAINT chk_users_role CHECK (role IN ('admin', 'student')),
    CONSTRAINT chk_users_status CHECK (status IN ('active', 'deactivated')),
    CONSTRAINT chk_users_grade_by_role CHECK (
      (role = 'admin' AND grade_level IS NULL) OR
      (role = 'student' AND grade_level IN (10, 11, 12))
    )
  );

  CREATE INDEX idx_users_role_status ON dbo.users (role, status);
END;

-- Student profile details (grade intentionally not stored here)
IF OBJECT_ID('dbo.students', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.students (
    user_id CHAR(36) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT df_students_created_at DEFAULT GETDATE(),
    updated_at DATETIME2 NOT NULL CONSTRAINT df_students_updated_at DEFAULT GETDATE(),
    CONSTRAINT pk_students PRIMARY KEY (user_id),
    CONSTRAINT fk_students_user
      FOREIGN KEY (user_id) REFERENCES dbo.users(id) ON DELETE CASCADE
  );
END;

-- Content taxonomy
IF OBJECT_ID('dbo.subjects', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.subjects (
    id BIGINT IDENTITY(1,1) NOT NULL,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(120) NOT NULL,
    description NVARCHAR(MAX) NULL,
    is_active BIT NOT NULL CONSTRAINT df_subjects_is_active DEFAULT 1,
    created_at DATETIME2 NOT NULL CONSTRAINT df_subjects_created_at DEFAULT GETDATE(),
    updated_at DATETIME2 NOT NULL CONSTRAINT df_subjects_updated_at DEFAULT GETDATE(),
    CONSTRAINT pk_subjects PRIMARY KEY (id),
    CONSTRAINT uq_subjects_code UNIQUE (code)
  );
END;

IF OBJECT_ID('dbo.topics', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.topics (
    id BIGINT IDENTITY(1,1) NOT NULL,
    subject_id BIGINT NOT NULL,
    name VARCHAR(160) NOT NULL,
    description NVARCHAR(MAX) NULL,
    sort_order INT NOT NULL CONSTRAINT df_topics_sort_order DEFAULT 0,
    is_active BIT NOT NULL CONSTRAINT df_topics_is_active DEFAULT 1,
    created_at DATETIME2 NOT NULL CONSTRAINT df_topics_created_at DEFAULT GETDATE(),
    updated_at DATETIME2 NOT NULL CONSTRAINT df_topics_updated_at DEFAULT GETDATE(),
    CONSTRAINT pk_topics PRIMARY KEY (id),
    CONSTRAINT uq_topics_subject_name UNIQUE (subject_id, name),
    CONSTRAINT fk_topics_subject
      FOREIGN KEY (subject_id) REFERENCES dbo.subjects(id) ON DELETE CASCADE
  );

  CREATE INDEX idx_topics_subject_sort ON dbo.topics (subject_id, sort_order);
END;

-- Video content
IF OBJECT_ID('dbo.videos', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.videos (
    id CHAR(36) NOT NULL,
    topic_id BIGINT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description NVARCHAR(MAX) NOT NULL,
    duration_seconds INT NULL,
    original_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size_bytes BIGINT NOT NULL,
    storage_type VARCHAR(10) NOT NULL,
    local_path VARCHAR(1024) NULL,
    s3_bucket VARCHAR(255) NULL,
    s3_key VARCHAR(1024) NULL,
    thumbnail_storage_type VARCHAR(10) NULL,
    thumbnail_local_path VARCHAR(1024) NULL,
    thumbnail_s3_bucket VARCHAR(255) NULL,
    thumbnail_s3_key VARCHAR(1024) NULL,
    thumbnail_mime_type VARCHAR(100) NULL,
    uploaded_by CHAR(36) NOT NULL,
    status VARCHAR(15) NOT NULL CONSTRAINT df_videos_status DEFAULT 'published',
    created_at DATETIME2 NOT NULL CONSTRAINT df_videos_created_at DEFAULT GETDATE(),
    updated_at DATETIME2 NOT NULL CONSTRAINT df_videos_updated_at DEFAULT GETDATE(),
    CONSTRAINT pk_videos PRIMARY KEY (id),
    CONSTRAINT chk_videos_storage_type CHECK (storage_type IN ('local', 's3')),
    CONSTRAINT chk_videos_thumb_storage_type CHECK (thumbnail_storage_type IN ('local', 's3')),
    CONSTRAINT chk_videos_status CHECK (status IN ('published', 'archived')),
    CONSTRAINT fk_videos_topic
      FOREIGN KEY (topic_id) REFERENCES dbo.topics(id),
    CONSTRAINT fk_videos_uploaded_by
      FOREIGN KEY (uploaded_by) REFERENCES dbo.users(id),
    CONSTRAINT chk_videos_storage CHECK (
      (storage_type = 'local' AND local_path IS NOT NULL AND s3_key IS NULL) OR
      (storage_type = 's3' AND s3_key IS NOT NULL)
    )
  );

  CREATE INDEX idx_videos_topic_status ON dbo.videos (topic_id, status);
  CREATE INDEX idx_videos_uploaded_by ON dbo.videos (uploaded_by);
END;

-- Learner watch progress (tracks who watched which video and for how long)
IF OBJECT_ID('dbo.watch_progress', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.watch_progress (
    id BIGINT IDENTITY(1,1) NOT NULL,
    video_id CHAR(36) NOT NULL,
    student_number VARCHAR(32) NOT NULL,
    last_position_seconds FLOAT NOT NULL CONSTRAINT df_watch_last_position DEFAULT 0,
    total_watched_seconds FLOAT NOT NULL CONSTRAINT df_watch_total_watched DEFAULT 0,
    created_at DATETIME2 NOT NULL CONSTRAINT df_watch_created_at DEFAULT GETDATE(),
    updated_at DATETIME2 NOT NULL CONSTRAINT df_watch_updated_at DEFAULT GETDATE(),
    CONSTRAINT pk_watch_progress PRIMARY KEY (id),
    CONSTRAINT uq_watch_video_student UNIQUE (video_id, student_number)
  );

  CREATE INDEX idx_watch_student ON dbo.watch_progress (student_number);
  CREATE INDEX idx_watch_video ON dbo.watch_progress (video_id);
END;

-- Background processing queue for media-related work
-- (also created automatically by the backend on startup)
IF OBJECT_ID('dbo.media_jobs', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.media_jobs (
    id BIGINT IDENTITY(1,1) NOT NULL,
    job_type VARCHAR(64) NOT NULL,
    video_id CHAR(36) NOT NULL,
    payload_json NVARCHAR(MAX) NULL,
    status VARCHAR(20) NOT NULL CONSTRAINT df_media_jobs_status DEFAULT 'queued',
    attempts TINYINT NOT NULL CONSTRAINT df_media_jobs_attempts DEFAULT 0,
    max_attempts TINYINT NOT NULL CONSTRAINT df_media_jobs_max_attempts DEFAULT 5,
    available_at DATETIME2 NOT NULL CONSTRAINT df_media_jobs_available_at DEFAULT GETDATE(),
    locked_at DATETIME2 NULL,
    locked_by VARCHAR(100) NULL,
    last_error NVARCHAR(MAX) NULL,
    completed_at DATETIME2 NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT df_media_jobs_created_at DEFAULT GETDATE(),
    updated_at DATETIME2 NOT NULL CONSTRAINT df_media_jobs_updated_at DEFAULT GETDATE(),
    CONSTRAINT pk_media_jobs PRIMARY KEY (id),
    CONSTRAINT chk_media_jobs_status CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
    CONSTRAINT fk_media_jobs_video
      FOREIGN KEY (video_id) REFERENCES dbo.videos(id) ON DELETE CASCADE
  );

  CREATE INDEX idx_media_jobs_status_available ON dbo.media_jobs (status, available_at);
  CREATE INDEX idx_media_jobs_video ON dbo.media_jobs (video_id);
END;

-- ───────────────────────────────────────────────
-- Seed data
-- ───────────────────────────────────────────────

-- Default admin user (login with student number ADMIN001, password: Password)
IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE student_number = 'ADMIN001')
  INSERT INTO dbo.users (id, role, student_number, password_hash, grade_level, status)
  VALUES (LOWER(NEWID()), 'admin', 'ADMIN001', '$2b$10$/bI5MF4iy79nhxd63fYnT.EVtyRS.zT1Uo4lTVqgkTBv3Mce.UiUG', NULL, 'active');

-- Curriculum subject seed data (no video mock data)
IF NOT EXISTS (SELECT 1 FROM dbo.subjects WHERE code = 'g10-mathematics')
  INSERT INTO dbo.subjects (code, name, description) VALUES ('g10-mathematics', 'Mathematics', 'Grade 10 Mathematics');
IF NOT EXISTS (SELECT 1 FROM dbo.subjects WHERE code = 'g10-physical-sciences')
  INSERT INTO dbo.subjects (code, name, description) VALUES ('g10-physical-sciences', 'Physical Sciences', 'Grade 10 Physical Sciences');
IF NOT EXISTS (SELECT 1 FROM dbo.subjects WHERE code = 'g11-mathematics')
  INSERT INTO dbo.subjects (code, name, description) VALUES ('g11-mathematics', 'Mathematics', 'Grade 11 Mathematics');
IF NOT EXISTS (SELECT 1 FROM dbo.subjects WHERE code = 'g11-physical-sciences')
  INSERT INTO dbo.subjects (code, name, description) VALUES ('g11-physical-sciences', 'Physical Sciences', 'Grade 11 Physical Sciences');
IF NOT EXISTS (SELECT 1 FROM dbo.subjects WHERE code = 'g12-mathematics')
  INSERT INTO dbo.subjects (code, name, description) VALUES ('g12-mathematics', 'Mathematics', 'Grade 12 Mathematics');
IF NOT EXISTS (SELECT 1 FROM dbo.subjects WHERE code = 'g12-physical-sciences')
  INSERT INTO dbo.subjects (code, name, description) VALUES ('g12-physical-sciences', 'Physical Sciences', 'Grade 12 Physical Sciences');
IF NOT EXISTS (SELECT 1 FROM dbo.subjects WHERE code = 'g12-life-sciences')
  INSERT INTO dbo.subjects (code, name, description) VALUES ('g12-life-sciences', 'Life Sciences', 'Grade 12 Life Sciences');
