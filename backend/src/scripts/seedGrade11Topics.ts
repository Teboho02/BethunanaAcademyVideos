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
  'g11-mathematics': [
    'Algebra',
    'Functions',
    'Exponents and Logarithms',
    'Trigonometry',
    'Analytical Geometry',
    'Euclidean Geometry',
    'Statistics',
    'Probability'
  ],
  'g11-physical-sciences': [
    'Vectors in Two Dimensions',
    'Newtons Laws',
    'Projectile Motion',
    'Work, Energy and Power',
    'Waves, Sound and Light',
    'Geometrical Optics',
    'Electrostatics',
    'Electric Circuits',
    'Atomic Structure',
    'The Periodic Table',
    'Chemical Bonding',
    'Intermolecular Forces',
    'Energy and Chemical Change',
    'Rates of Reaction',
    'Stoichiometry'
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
      throw new Error(`Subject not found: ${subjectCode}. Seed subjects first.`);
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
     WHERE s.code IN (?, ?)
     ORDER BY s.code ASC, t.sort_order ASC, t.name ASC`,
    ['g11-mathematics', 'g11-physical-sciences']
  );

  console.info('[seed] Grade 11 topics ready:');
  for (const row of rows) {
    console.info(`- ${row.subject_code}: ${row.topic_name}`);
  }
};

run()
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[seed] Failed to seed Grade 11 topics: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
