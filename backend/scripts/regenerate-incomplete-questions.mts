// Regenerates AI questions only for published videos that do NOT already have
// exactly AI_QUESTIONS_PER_VIDEO ai-sourced questions — i.e. the ones a prior
// batch run missed. Each video is wrapped in a timeout so a stalled SDK/DB call
// is turned into a caught error and skipped, instead of draining the event loop
// (which exits Node with code 13, "unsettled top-level await").
//
//   cd backend
//   npx tsx scripts/regenerate-incomplete-questions.mts
import { closePool, queryRows } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { generateQuestionsForVideo } from '../src/services/questionGeneration.service.js';

const PER_VIDEO_TIMEOUT_MS = 12 * 60 * 1000;

const withTimeout = async <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${ms / 1000}s: ${label}`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
};

interface VideoRow {
  id: string;
  title: string;
  ai: number;
}

const target = env.AI_QUESTIONS_PER_VIDEO;
const rows = await queryRows<VideoRow>(
  `SELECT v.id, v.title,
          (SELECT COUNT(*) FROM video_questions q WHERE q.video_id = v.id AND q.source = 'ai') AS ai
   FROM videos v
   WHERE v.status = 'published'
   ORDER BY v.created_at ASC, v.id ASC`
);
const incomplete = rows.filter((r) => Number(r.ai) !== target);

console.log(
  `${incomplete.length} of ${rows.length} published video(s) need regeneration to reach ${target} question(s).`
);

let succeeded = 0;
let failed = 0;
const failures: Array<{ id: string; title: string; error: string }> = [];

for (const [index, video] of incomplete.entries()) {
  const label = `[${index + 1}/${incomplete.length}] ${video.title} (${video.id})`;
  try {
    const count = await withTimeout(
      generateQuestionsForVideo(video.id),
      PER_VIDEO_TIMEOUT_MS,
      video.title
    );
    succeeded += 1;
    console.log(`  ok   ${label} -> ${count} question(s)`);
  } catch (error) {
    failed += 1;
    const message = error instanceof Error ? error.message : String(error);
    failures.push({ id: video.id, title: video.title, error: message });
    console.error(`  FAIL ${label} -> ${message}`);
  }
}

console.log(`\nDone. ${succeeded} succeeded, ${failed} failed.`);
if (failures.length > 0) {
  console.log('Failures:');
  for (const f of failures) {
    console.log(`  - ${f.title} (${f.id}): ${f.error}`);
  }
}

await closePool();
process.exit(failed > 0 ? 1 : 0);
