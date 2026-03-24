import type { RowDataPacket } from 'mysql2';
import { getMySqlPool } from '../config/mysql.js';

const DEFAULT_PASSWORD_HASH =
  '$2b$10$/bI5MF4iy79nhxd63fYnT.EVtyRS.zT1Uo4lTVqgkTBv3Mce.UiUG';

interface ColumnRow extends RowDataPacket {
  COLUMN_NAME: string;
}

/**
 * Ensures the password_hash column exists on the users table.
 * If the column is missing it is added and all existing rows are
 * populated with the default bcrypt hash for "Password".
 *
 * Safe to call on every startup — it is a no-op when the column
 * already exists.
 */
export async function ensurePasswordHashColumn(): Promise<void> {
  const pool = getMySqlPool();

  const [cols] = await pool.query<ColumnRow[]>(
    `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME   = 'users'
        AND COLUMN_NAME  = 'password_hash'`
  );

  if (cols.length > 0) {
    return; // column already exists
  }

  await pool.query(
    "ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) NOT NULL DEFAULT '' AFTER student_number"
  );

  await pool.query(
    "UPDATE users SET password_hash = ? WHERE password_hash = ''",
    [DEFAULT_PASSWORD_HASH]
  );

  console.info('[migrations] Added password_hash column and set default passwords.');
}
