-- Bethunana backend schema (MySQL 8+)
--
-- Rules reflected from product requirements:
-- 1) Student number + password are the login credentials.
-- 2) grade_level is stored on users only for non-admin users.
-- 3) Learner enrollment supports grades 10, 11, and 12.

CREATE DATABASE IF NOT EXISTS bethunana
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE bethunana;

-- Identity and access
CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) NOT NULL,
  role ENUM('admin', 'student') NOT NULL,
  student_number VARCHAR(32) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  grade_level TINYINT UNSIGNED NULL,
  status ENUM('active', 'deactivated') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_student_number (student_number),
  KEY idx_users_role_status (role, status),
  CONSTRAINT chk_users_grade_by_role CHECK (
    (role = 'admin' AND grade_level IS NULL) OR
    (role = 'student' AND grade_level IN (10,11, 12))
  )
) ENGINE=InnoDB;

-- Student profile details (grade intentionally not stored here)
CREATE TABLE IF NOT EXISTS students (
  user_id CHAR(36) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_students_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Content taxonomy
CREATE TABLE IF NOT EXISTS subjects (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(120) NOT NULL,
  description TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_subjects_code (code)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS topics (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  subject_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(160) NOT NULL,
  description TEXT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_topics_subject_name (subject_id, name),
  KEY idx_topics_subject_sort (subject_id, sort_order),
  CONSTRAINT fk_topics_subject
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Video content
CREATE TABLE IF NOT EXISTS videos (
  id CHAR(36) NOT NULL,
  topic_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  duration_seconds INT UNSIGNED NULL,
  original_filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size_bytes BIGINT UNSIGNED NOT NULL,
  storage_type ENUM('local', 's3') NOT NULL,
  local_path VARCHAR(1024) NULL,
  s3_bucket VARCHAR(255) NULL,
  s3_key VARCHAR(1024) NULL,
  thumbnail_storage_type ENUM('local', 's3') NULL,
  thumbnail_local_path VARCHAR(1024) NULL,
  thumbnail_s3_bucket VARCHAR(255) NULL,
  thumbnail_s3_key VARCHAR(1024) NULL,
  thumbnail_mime_type VARCHAR(100) NULL,
  uploaded_by CHAR(36) NOT NULL,
  status ENUM('published', 'archived') NOT NULL DEFAULT 'published',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_videos_topic_status (topic_id, status),
  KEY idx_videos_uploaded_by (uploaded_by),
  CONSTRAINT fk_videos_topic
    FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE RESTRICT,
  CONSTRAINT fk_videos_uploaded_by
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT chk_videos_storage CHECK (
    (storage_type = 'local' AND local_path IS NOT NULL AND s3_key IS NULL) OR
    (storage_type = 's3' AND s3_key IS NOT NULL)
  )
) ENGINE=InnoDB;

-- Learner watch progress (tracks who watched which video and for how long)
CREATE TABLE IF NOT EXISTS watch_progress (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  video_id CHAR(36) NOT NULL,
  student_number VARCHAR(32) NOT NULL,
  last_position_seconds DOUBLE NOT NULL DEFAULT 0,
  total_watched_seconds DOUBLE NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_watch_video_student (video_id, student_number),
  KEY idx_watch_student (student_number),
  KEY idx_watch_video (video_id)
) ENGINE=InnoDB;

-- Background processing queue for media-related work
CREATE TABLE IF NOT EXISTS media_jobs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  job_type VARCHAR(64) NOT NULL,
  video_id CHAR(36) NOT NULL,
  payload_json JSON NULL,
  status ENUM('queued', 'processing', 'completed', 'failed') NOT NULL DEFAULT 'queued',
  attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
  max_attempts TINYINT UNSIGNED NOT NULL DEFAULT 5,
  available_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  locked_at TIMESTAMP NULL DEFAULT NULL,
  locked_by VARCHAR(100) NULL,
  last_error TEXT NULL,
  completed_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_media_jobs_status_available (status, available_at),
  KEY idx_media_jobs_video (video_id),
  CONSTRAINT fk_media_jobs_video
    FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ───────────────────────────────────────────────
-- Seed data
-- ───────────────────────────────────────────────

-- Default admin user (login with student number ADMIN001, password: Password)
INSERT IGNORE INTO users (id, role, student_number, password_hash, grade_level, status)
VALUES (UUID(), 'admin', 'ADMIN001', '$2b$10$/bI5MF4iy79nhxd63fYnT.EVtyRS.zT1Uo4lTVqgkTBv3Mce.UiUG', NULL, 'active');

-- ───────────────────────────────────────────────
-- Migration: add password_hash to existing users
-- Run this on existing databases to add the column and set default password "Password"
-- ───────────────────────────────────────────────
-- ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) NOT NULL DEFAULT '' AFTER student_number;
-- UPDATE users SET password_hash = '$2b$10$/bI5MF4iy79nhxd63fYnT.EVtyRS.zT1Uo4lTVqgkTBv3Mce.UiUG' WHERE password_hash = '';

-- Curriculum subject seed data (no video mock data)
INSERT IGNORE INTO subjects (code, name, description) VALUES
  ('g10-mathematics', 'Mathematics', 'Grade 10 Mathematics'),
  ('g10-physical-sciences', 'Physical Sciences', 'Grade 10 Physical Sciences'),
  ('g11-mathematics', 'Mathematics', 'Grade 11 Mathematics'),
  ('g11-physical-sciences', 'Physical Sciences', 'Grade 11 Physical Sciences'),
  ('g12-mathematics', 'Mathematics', 'Grade 12 Mathematics'),
  ('g12-physical-sciences', 'Physical Sciences', 'Grade 12 Physical Sciences'),
  ('g12-life-sciences', 'Life Sciences', 'Grade 12 Life Sciences');
