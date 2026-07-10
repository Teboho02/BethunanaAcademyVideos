// Seeds Grade 8 and Grade 9 Mathematics (subjects + topics) and allows
// grades 8 and 9 in the users grade constraint. Idempotent — safe to re-run.
//   npx tsx scripts/seed-junior-maths.mts
import { closePool, execute, queryRows } from '../src/config/db.js';

interface GradeSeed {
  code: string;
  grade: number;
  topics: string[];
}

const GRADES: GradeSeed[] = [
  {
    code: 'g8-mathematics',
    grade: 8,
    topics: [
      'The Number System, Ratio, Rate and Financial Mathematics',
      'Integers',
      'Exponents',
      'Numeric and Geometric Number Patterns',
      'Functions and Relationships',
      'Algebraic Expressions',
      'Introduction to Equations',
      'Further Algebraic Expressions',
      'Equations',
      'Geometric Constructions',
      'Geometry of 2D Shapes',
      'Geometry of Straight Lines',
      'Common Fractions',
      'Decimal Fractions',
      'The Theorem of Pythagoras',
      'Area and Perimeter',
      'Surface Area and Volume',
      'Data Handling',
      'Functions, Relationships, Algebraic Equations and Graphs',
      'Transformational Geometry',
      'Geometry of 3D Shapes',
      'Probability'
    ]
  },
  {
    code: 'g9-mathematics',
    grade: 9,
    topics: [
      'The Number System, Ratio, Rate and Financial Mathematics',
      'Integers',
      'Exponents',
      'Numeric and Geometric Number Patterns',
      'Functions and Relationships',
      'Algebraic Expressions',
      'Common Fractions',
      'Decimal Fractions',
      'Factorisation',
      'Equations',
      'Geometric Constructions',
      'Geometry of 2D Shapes',
      'Geometry of Straight Lines',
      'The Theorem of Pythagoras',
      'Area and Perimeter',
      'Surface Area and Volume',
      'Transformational Geometry',
      'Geometry of 3D Shapes',
      'Data Handling',
      'Probability'
    ]
  }
];

const ALLOWED_GRADES = [8, 9, 10, 11, 12];

for (const seed of GRADES) {
  const existingSubject = await queryRows<{ id: number }>(
    'SELECT TOP 1 id FROM subjects WHERE code = ?',
    [seed.code]
  );
  let subjectId = existingSubject[0]?.id;
  if (subjectId) {
    console.log(`Subject ${seed.code} already exists (id ${subjectId}).`);
  } else {
    await execute(
      'INSERT INTO subjects (code, name, description) VALUES (?, ?, ?)',
      [seed.code, 'Mathematics', `Grade ${seed.grade} Mathematics`]
    );
    const inserted = await queryRows<{ id: number }>(
      'SELECT TOP 1 id FROM subjects WHERE code = ?',
      [seed.code]
    );
    subjectId = inserted[0]?.id;
    console.log(`Created subject ${seed.code} (id ${subjectId}).`);
  }
  if (!subjectId) {
    throw new Error('Could not resolve subject id for ' + seed.code);
  }

  let touched = 0;
  for (const [index, name] of seed.topics.entries()) {
    const sortOrder = index + 1;
    const result = await execute(
      `IF NOT EXISTS (SELECT 1 FROM topics WHERE subject_id = ? AND name = ?)
         INSERT INTO topics (subject_id, name, sort_order) VALUES (?, ?, ?)
       ELSE
         UPDATE topics SET sort_order = ? WHERE subject_id = ? AND name = ?`,
      [subjectId, name, subjectId, name, sortOrder, sortOrder, subjectId, name]
    );
    if (result.affectedRows > 0) touched += 1;
  }
  console.log(`${seed.code}: ${seed.topics.length} topics ensured (${touched} inserted/updated).`);
}

// Allow the junior grades in the users check constraint
const gradeList = ALLOWED_GRADES.join(', ');
const constraint = await queryRows<{ name: string; definition: string }>(
  `SELECT name, definition
   FROM sys.check_constraints
   WHERE parent_object_id = OBJECT_ID('dbo.users')
     AND definition LIKE '%grade_level%'`
);
if (constraint.length === 0) {
  console.log('No grade_level check constraint found on users — nothing to update.');
} else if (ALLOWED_GRADES.every((grade) => constraint[0].definition.includes(`(${grade})`))) {
  console.log(`Constraint ${constraint[0].name} already allows grades ${gradeList}.`);
} else {
  await execute(`ALTER TABLE dbo.users DROP CONSTRAINT ${constraint[0].name}`);
  await execute(
    `ALTER TABLE dbo.users ADD CONSTRAINT chk_users_grade_by_role CHECK (
       (role = 'admin' AND grade_level IS NULL) OR
       (role = 'student' AND grade_level IN (${gradeList}))
     )`
  );
  console.log(`Replaced constraint ${constraint[0].name} to allow grades ${gradeList}.`);
}

const summary = await queryRows(
  `SELECT s.code, COUNT(t.id) AS topic_count
   FROM subjects s
   LEFT JOIN topics t ON t.subject_id = s.id AND t.is_active = 1
   WHERE s.code IN ('g8-mathematics', 'g9-mathematics')
   GROUP BY s.code`
);
console.log('Summary:', JSON.stringify(summary));

await closePool();
