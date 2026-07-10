-- ============================================================
-- Seed the App/Play Store reviewer student account (VIDEOS backend)
-- ============================================================
-- The mobile app signs in to BOTH backends with the same credentials, so this
-- same student number + password must also exist on the exams backend.
--
-- Login:  BNA2026113697 / Password
--
-- Run against the videos Azure SQL database, e.g. with sqlcmd:
--   sqlcmd -S <server>.database.windows.net -d bethunana -U <user> -P <password> -i seed-reviewer-student.sql
-- Idempotent: safe to run more than once (refreshes password / grade).
-- ============================================================

DECLARE @student_number VARCHAR(32) = 'BNA2026113697';
-- bcrypt hash of the password "Password" (same hash used for the seed admin).
DECLARE @password_hash VARCHAR(255) = '$2b$10$/bI5MF4iy79nhxd63fYnT.EVtyRS.zT1Uo4lTVqgkTBv3Mce.UiUG';
-- Grade MUST match a grade that already has uploaded lessons (10, 11 or 12),
-- otherwise the reviewer logs in but sees an empty catalog.
DECLARE @grade TINYINT = 10;

-- ------------------------------------------------------------
-- Ensure the password_hash column exists (mirrors the backend's own startup
-- migration). Some databases predate it.
-- ------------------------------------------------------------
IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_CATALOG = DB_NAME()
     AND TABLE_NAME   = 'users'
     AND COLUMN_NAME  = 'password_hash'
)
BEGIN
  EXEC sp_executesql
    N'ALTER TABLE users ADD password_hash VARCHAR(255) NOT NULL CONSTRAINT df_users_password_hash DEFAULT ''''';
END;

-- Backfill any rows left with an empty hash to the default "Password" hash.
UPDATE users SET password_hash = @password_hash WHERE password_hash = '';

-- Create the user if it doesn't already exist (student_number is unique).
IF NOT EXISTS (SELECT 1 FROM users WHERE student_number = @student_number)
  INSERT INTO users (id, role, student_number, password_hash, grade_level, status)
  VALUES (LOWER(NEWID()), 'student', @student_number, @password_hash, @grade, 'active');

-- If it already existed, refresh the password, grade, role and status.
UPDATE users
   SET role = 'student',
       password_hash = @password_hash,
       grade_level = @grade,
       status = 'active'
 WHERE student_number = @student_number;

-- Resolve the user id (whether just created or pre-existing).
DECLARE @uid CHAR(36) = (SELECT TOP 1 id FROM users WHERE student_number = @student_number);

-- Upsert the student profile (first/last name live here, not on users).
MERGE students WITH (HOLDLOCK) AS target
USING (SELECT @uid AS user_id) AS source
ON target.user_id = source.user_id
WHEN MATCHED THEN UPDATE SET first_name = 'App', last_name = 'Reviewer'
WHEN NOT MATCHED THEN INSERT (user_id, first_name, last_name)
  VALUES (source.user_id, 'App', 'Reviewer');

-- Verify
SELECT u.student_number, u.role, u.grade_level, u.status, s.first_name, s.last_name
  FROM users u
  LEFT JOIN students s ON s.user_id = u.id
 WHERE u.student_number = @student_number;
