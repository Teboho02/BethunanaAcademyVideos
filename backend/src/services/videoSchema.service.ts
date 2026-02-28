import { getMySqlPool } from '../config/mysql.js';
import type { RowDataPacket } from 'mysql2';

let ensuredVideoThumbnailColumns = false;
let ensureVideoThumbnailColumnsInFlight: Promise<void> | null = null;

interface ColumnExistsRow extends RowDataPacket {
  column_exists: number;
}

const columnExists = async (columnName: string): Promise<boolean> => {
  const pool = getMySqlPool();
  const [rows] = await pool.query<ColumnExistsRow[]>(
    `SELECT 1 AS column_exists
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'videos'
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [columnName]
  );
  return Boolean(rows[0]?.column_exists);
};

const addColumnIfMissing = async (
  columnName: string,
  columnDefinitionSql: string
): Promise<void> => {
  if (await columnExists(columnName)) {
    return;
  }

  const pool = getMySqlPool();
  await pool.query(`ALTER TABLE videos ADD COLUMN ${columnDefinitionSql}`);
};

export const ensureVideoThumbnailColumns = async (): Promise<void> => {
  if (ensuredVideoThumbnailColumns) {
    return;
  }
  if (ensureVideoThumbnailColumnsInFlight) {
    await ensureVideoThumbnailColumnsInFlight;
    return;
  }

  ensureVideoThumbnailColumnsInFlight = (async () => {
    await addColumnIfMissing(
      'thumbnail_storage_type',
      "thumbnail_storage_type ENUM('local', 's3') NULL"
    );
    await addColumnIfMissing(
      'thumbnail_local_path',
      'thumbnail_local_path VARCHAR(1024) NULL'
    );
    await addColumnIfMissing(
      'thumbnail_s3_bucket',
      'thumbnail_s3_bucket VARCHAR(255) NULL'
    );
    await addColumnIfMissing(
      'thumbnail_s3_key',
      'thumbnail_s3_key VARCHAR(1024) NULL'
    );
    await addColumnIfMissing(
      'thumbnail_mime_type',
      'thumbnail_mime_type VARCHAR(100) NULL'
    );

    ensuredVideoThumbnailColumns = true;
  })();

  try {
    await ensureVideoThumbnailColumnsInFlight;
  } finally {
    ensureVideoThumbnailColumnsInFlight = null;
  }
};
