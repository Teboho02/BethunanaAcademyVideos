import { execute, queryRows } from '../config/db.js';

const DEFAULT_PASSWORD_HASH =
  '$2b$10$/bI5MF4iy79nhxd63fYnT.EVtyRS.zT1Uo4lTVqgkTBv3Mce.UiUG';

interface ColumnRow {
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
  const cols = await queryRows<ColumnRow>(
    `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_CATALOG = DB_NAME()
        AND TABLE_NAME   = 'users'
        AND COLUMN_NAME  = 'password_hash'`
  );

  if (cols.length > 0) {
    return; // column already exists
  }

  await execute(
    "ALTER TABLE users ADD password_hash VARCHAR(255) NOT NULL CONSTRAINT df_users_password_hash DEFAULT ''"
  );

  await execute(
    "UPDATE users SET password_hash = ? WHERE password_hash = ''",
    [DEFAULT_PASSWORD_HASH]
  );

  console.info('[migrations] Added password_hash column and set default passwords.');
}
