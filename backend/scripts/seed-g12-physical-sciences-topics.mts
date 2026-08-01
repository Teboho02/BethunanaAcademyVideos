// Adds the Grade 12 Physical Sciences "Photoelectric Effect" topic.
// Idempotent — safe to re-run. Sort order 75 slots it after
// "Electrodynamics" (70) and before "Chemical Change" (80), matching the
// CAPS physics-then-chemistry sequence.
//   npx tsx scripts/seed-g12-physical-sciences-topics.mts
import { closePool, execute, queryRows } from '../src/config/db.js';

async function getSubjectId(code: string): Promise<number> {
  const rows = await queryRows<{ id: number }>(
    'SELECT TOP 1 id FROM subjects WHERE code = ?',
    [code]
  );
  const id = rows[0]?.id;
  if (!id) throw new Error(`Subject not found: ${code}`);
  return id;
}

async function topicByName(subjectId: number, name: string) {
  const rows = await queryRows<{ id: number; sort_order: number }>(
    'SELECT TOP 1 id, sort_order FROM topics WHERE subject_id = ? AND name = ?',
    [subjectId, name]
  );
  return rows[0] ?? null;
}

// Insert a topic if it does not exist; otherwise leave it untouched.
async function ensureTopic(subjectId: number, name: string, sortOrder: number) {
  const existing = await topicByName(subjectId, name);
  if (existing) {
    console.log(`  = "${name}" already present (id ${existing.id}).`);
    return;
  }
  await execute(
    'INSERT INTO topics (subject_id, name, sort_order) VALUES (?, ?, ?)',
    [subjectId, name, sortOrder]
  );
  console.log(`  + added "${name}" (sort ${sortOrder}).`);
}

// ── Grade 12 Physical Sciences ──────────────────────────────
console.log('Grade 12 Physical Sciences:');
{
  const g12 = await getSubjectId('g12-physical-sciences');
  await ensureTopic(g12, 'Photoelectric Effect', 75);
}

// ── Summary ────────────────────────────────────────────────
const summary = await queryRows(
  `SELECT s.code, t.name, t.sort_order
   FROM topics t JOIN subjects s ON s.id = t.subject_id
   WHERE s.code = 'g12-physical-sciences'
     AND t.is_active = 1
   ORDER BY t.sort_order, t.name`
);
console.log('\nCurrent topics:\n' + JSON.stringify(summary, null, 2));

await closePool();
