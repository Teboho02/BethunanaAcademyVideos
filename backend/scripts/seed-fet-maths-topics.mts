// Reconciles Grade 10-12 Mathematics topics to the current curriculum.
// Renames near-duplicate topics (so attached videos carry over), adds new
// topics, and splits Grade 12 "Statistics and Probability" into two topics.
// Idempotent — safe to re-run.
//   npx tsx scripts/seed-fet-maths-topics.mts
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

// Rename oldName -> newName, keeping the same row (and its videos/sort_order).
async function renameTopic(subjectId: number, oldName: string, newName: string) {
  const target = await topicByName(subjectId, newName);
  if (target) {
    console.log(`  = "${newName}" already present — skipping rename from "${oldName}".`);
    return;
  }
  const source = await topicByName(subjectId, oldName);
  if (!source) {
    console.log(`  ! neither "${oldName}" nor "${newName}" found — nothing to rename.`);
    return;
  }
  await execute('UPDATE topics SET name = ?, updated_at = GETDATE() WHERE id = ?', [
    newName,
    source.id
  ]);
  console.log(`  ~ renamed "${oldName}" -> "${newName}" (topic id ${source.id}).`);
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

// Delete a topic only when it exists and has no videos attached.
async function deleteTopicIfEmpty(subjectId: number, name: string) {
  const existing = await topicByName(subjectId, name);
  if (!existing) {
    console.log(`  = "${name}" not present — nothing to delete.`);
    return;
  }
  const videos = await queryRows<{ n: number }>(
    'SELECT COUNT(*) AS n FROM videos WHERE topic_id = ?',
    [existing.id]
  );
  if ((videos[0]?.n ?? 0) > 0) {
    console.log(`  ! "${name}" has ${videos[0].n} video(s) — refusing to delete, please reassign first.`);
    return;
  }
  await execute('DELETE FROM topics WHERE id = ?', [existing.id]);
  console.log(`  - deleted "${name}" (id ${existing.id}).`);
}

// ── Grade 10 ────────────────────────────────────────────────
console.log('Grade 10 Mathematics:');
{
  const g10 = await getSubjectId('g10-mathematics');
  await renameTopic(g10, 'Exponents and Surds', 'Exponents, equations and inequalities');
  await renameTopic(g10, 'Trigonometry', 'Trigonometry (2D)');
  await renameTopic(g10, 'Financial Mathematics', 'Finance and Growth');
  await ensureTopic(g10, 'Measurements', 100);
  // "Trigonometric Functions" already exists — no action.
}

// ── Grade 11 ────────────────────────────────────────────────
console.log('Grade 11 Mathematics:');
{
  const g11 = await getSubjectId('g11-mathematics');
  await renameTopic(g11, 'Trigonometry', 'Trigonometry (2D)');
  await ensureTopic(g11, 'Number Patterns', 90);
  // "Trigonometric Functions" already exists — no action.
}

// ── Grade 12 ────────────────────────────────────────────────
console.log('Grade 12 Mathematics:');
{
  const g12 = await getSubjectId('g12-mathematics');
  await renameTopic(g12, 'Trigonometry', 'Trigonometry (3D)');
  await deleteTopicIfEmpty(g12, 'Statistics and Probability');
  await ensureTopic(g12, 'Statistics', 80);
  await ensureTopic(g12, 'Probability', 90);
  await ensureTopic(g12, 'Trigonometric Functions', 45);
}

// ── Summary ────────────────────────────────────────────────
const summary = await queryRows(
  `SELECT s.code, t.name, t.sort_order
   FROM topics t JOIN subjects s ON s.id = t.subject_id
   WHERE s.code IN ('g10-mathematics','g11-mathematics','g12-mathematics')
     AND t.is_active = 1
   ORDER BY s.code, t.sort_order, t.name`
);
console.log('\nCurrent topics:\n' + JSON.stringify(summary, null, 2));

await closePool();
