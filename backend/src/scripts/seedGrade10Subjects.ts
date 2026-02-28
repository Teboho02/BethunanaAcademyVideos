import type { RowDataPacket } from 'mysql2';
import { closePool, execute, queryRows } from '../config/mysql.js';

interface SubjectRow extends RowDataPacket {
  code: string;
  name: string;
  description: string | null;
}

const run = async (): Promise<void> => {
  await execute(
    `INSERT IGNORE INTO subjects (code, name, description)
     VALUES
       (?, ?, ?),
       (?, ?, ?),
       (?, ?, ?),
       (?, ?, ?),
       (?, ?, ?),
       (?, ?, ?),
       (?, ?, ?)`,
    [
      'g10-mathematics',
      'Mathematics',
      'Grade 10 Mathematics',
      'g10-physical-sciences',
      'Physical Sciences',
      'Grade 10 Physical Sciences',
      'g11-mathematics',
      'Mathematics',
      'Grade 11 Mathematics',
      'g11-physical-sciences',
      'Physical Sciences',
      'Grade 11 Physical Sciences',
      'g12-mathematics',
      'Mathematics',
      'Grade 12 Mathematics',
      'g12-physical-sciences',
      'Physical Sciences',
      'Grade 12 Physical Sciences',
      'g12-life-sciences',
      'Life Sciences',
      'Grade 12 Life Sciences'
    ]
  );

  const rows = await queryRows<SubjectRow>(
    `SELECT code, name, description
     FROM subjects
     WHERE code IN (?, ?, ?, ?, ?, ?, ?)
     ORDER BY code ASC`,
    [
      'g10-mathematics',
      'g10-physical-sciences',
      'g11-mathematics',
      'g11-physical-sciences',
      'g12-mathematics',
      'g12-physical-sciences',
      'g12-life-sciences'
    ]
  );

  console.info('[seed] Curriculum subjects ready:');
  for (const row of rows) {
    console.info(`- ${row.code}: ${row.name}`);
  }
};

run()
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[seed] Failed to seed Grade 10 subjects: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
