import { getMySqlPool } from '../config/mysql.js';

const HASH = '$2b$10$/bI5MF4iy79nhxd63fYnT.EVtyRS.zT1Uo4lTVqgkTBv3Mce.UiUG';

async function run() {
  const pool = getMySqlPool();
  try {
    await pool.query(
      "ALTER TABLE users ADD COLUMN password_hash VARCHAR(255) NOT NULL DEFAULT '' AFTER student_number"
    );
    console.log('Column password_hash added.');
  } catch (e: any) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('Column password_hash already exists, skipping ALTER.');
    } else {
      throw e;
    }
  }

  const [result] = await pool.query(
    "UPDATE users SET password_hash = ? WHERE password_hash = ''",
    [HASH]
  );
  console.log('Updated rows:', (result as any).affectedRows);
  await pool.end();
}

run().catch((e) => {
  console.error('Migration failed:', e.message);
  process.exit(1);
});
