// Regenerates AI practice questions for EVERY published video, in one batch.
// Runs generation in-process (this script's code + .env), so it produces the
// current AI_QUESTIONS_PER_VIDEO count with the latest prompt/caching without
// waiting for a server deploy. Existing AI questions are overwritten per video;
// manual questions (source != 'ai') are preserved.
//
// Sequential on purpose: keeps AWS Transcribe/Bedrock concurrency low and lets
// the cached system prompt + tool schema be reused across calls (5-min TTL).
//
//   cd backend
//   npx tsx scripts/regenerate-all-questions.mts
import { closePool, queryRows } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { generateQuestionsForVideo } from '../src/services/questionGeneration.service.js';

interface VideoRow {
  id: string;
  title: string;
}

if (!env.AI_QUESTIONS_ENABLED) {
  console.error('AI_QUESTIONS_ENABLED is false — nothing to do. Enable it and re-run.');
  await closePool();
  process.exit(1);
}

const videos = await queryRows<VideoRow>(
  `SELECT id, title FROM videos WHERE status = 'published' ORDER BY created_at ASC, id ASC`
);

console.log(
  `Regenerating ${env.AI_QUESTIONS_PER_VIDEO} question(s) each for ${videos.length} published video(s).`
);

let succeeded = 0;
let failed = 0;
const failures: Array<{ id: string; title: string; error: string }> = [];

for (const [index, video] of videos.entries()) {
  const label = `[${index + 1}/${videos.length}] ${video.title} (${video.id})`;
  try {
    const count = await generateQuestionsForVideo(video.id);
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
