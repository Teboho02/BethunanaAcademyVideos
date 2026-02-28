import type { RowDataPacket } from 'mysql2';
import { closePool, execute, queryRows } from '../config/mysql.js';

interface SubjectRow extends RowDataPacket {
  id: number;
  code: string;
}

interface TopicRow extends RowDataPacket {
  subject_code: string;
  topic_name: string;
  sort_order: number;
}

const topicSeeds: Record<string, string[]> = {
  'g12-mathematics': [
    'Algebra',
    'Functions',
    'Calculus',
    'Trigonometry',
    'Analytical Geometry',
    'Euclidean Geometry',
    'Circle Geometry',
    'Statistics and Probability'
  ],
  'g12-life-sciences': [
    'Nucleic acids',
    'Meiosis',
    'Reproduction in vertebrates',
    'Reproduction',
    'Genetics',
    'Evolution'
  ],
  'g12-physical-sciences': [
    'Momentum and Impulse',
    'Vertical Projectile Motion',
    'Work, Energy and Power',
    'Doppler Effect',
    'Electrostatics',
    'Electric Circuits',
    'Electrodynamics',
    'Chemical Change',
    'Organic Chemistry',
    'Chemical Systems',
    'Chemical Equilibrium'
  ]
};

const run = async (): Promise<void> => {
  for (const [subjectCode, topics] of Object.entries(topicSeeds)) {
    const subjectRows = await queryRows<SubjectRow>(
      `SELECT id, code
       FROM subjects
       WHERE code = ? AND is_active = 1
       LIMIT 1`,
      [subjectCode]
    );

    const subject = subjectRows[0];
    if (!subject) {
      throw new Error(
        `Subject not found: ${subjectCode}. Seed subjects first.`
      );
    }

    for (let index = 0; index < topics.length; index += 1) {
      const topicName = topics[index];
      const sortOrder = (index + 1) * 10;

      await execute(
        `INSERT IGNORE INTO topics (subject_id, name, sort_order, is_active)
         VALUES (?, ?, ?, 1)`,
        [subject.id, topicName, sortOrder]
      );
    }
  }

  const rows = await queryRows<TopicRow>(
    `SELECT s.code AS subject_code, t.name AS topic_name, t.sort_order
     FROM topics t
     JOIN subjects s ON s.id = t.subject_id
     WHERE s.code IN (?, ?, ?)
     ORDER BY s.code ASC, t.sort_order ASC, t.name ASC`,
    ['g12-life-sciences', 'g12-mathematics', 'g12-physical-sciences']
  );

  console.info('[seed] Grade 12 topics ready:');
  for (const row of rows) {
    console.info(`- ${row.subject_code}: ${row.topic_name}`);
  }
};

run()
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[seed] Failed to seed Grade 12 topics: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
