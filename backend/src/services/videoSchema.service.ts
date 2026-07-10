import { execute, queryRows } from '../config/db.js';

let ensuredVideoThumbnailColumns = false;
let ensureVideoThumbnailColumnsInFlight: Promise<void> | null = null;

interface ColumnExistsRow {
  column_exists: number;
}

const columnExists = async (columnName: string): Promise<boolean> => {
  const rows = await queryRows<ColumnExistsRow>(
    `SELECT TOP 1 1 AS column_exists
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_CATALOG = DB_NAME()
       AND TABLE_NAME = 'videos'
       AND COLUMN_NAME = ?`,
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

  await execute(`ALTER TABLE videos ADD ${columnDefinitionSql}`);
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
      "thumbnail_storage_type VARCHAR(10) NULL CONSTRAINT chk_videos_thumb_storage CHECK (thumbnail_storage_type IN ('local', 's3'))"
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
