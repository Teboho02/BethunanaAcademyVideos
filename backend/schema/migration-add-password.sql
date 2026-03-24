-- Migration: Add password_hash column to users table
-- Sets default password "Password" (bcrypt hashed) for all existing users.
-- Run this ONCE on your existing database.

ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) NOT NULL DEFAULT '' AFTER student_number;

UPDATE users SET password_hash = '$2b$10$/bI5MF4iy79nhxd63fYnT.EVtyRS.zT1Uo4lTVqgkTBv3Mce.UiUG' WHERE password_hash = '';
