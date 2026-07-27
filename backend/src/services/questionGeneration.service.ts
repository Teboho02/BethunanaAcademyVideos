import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { unlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { env } from '../config/env.js';
import { queryRows } from '../config/db.js';
import { generateVideoQuestions } from './bedrock.service.js';
import {
  captureEvenlySpacedFrames,
  getVideoDurationSeconds
} from './mediaProbe.service.js';
import { transcribeVideoAudio } from './transcription.service.js';
import { replaceGeneratedQuestions } from './videoQuestions.service.js';
import { resolveLocalVideoPath } from './storage/localVideoStorage.service.js';
import { getS3Object } from './storage/s3.service.js';

interface QuestionContextRow {
  id: string;
  duration_seconds: number | null;
  storage_type: 'local' | 's3';
  local_path: string | null;
  s3_key: string | null;
  title: string;
  description: string | null;
  topic_name: string | null;
  subject_name: string | null;
}

/**
 * Makes a video available as a local file path for ffmpeg/ffprobe. Local videos
 * are used in place; S3 videos are downloaded to a temp file that the caller
 * cleans up.
 */
const materializeVideoFile = async (
  row: Pick<QuestionContextRow, 'id' | 'storage_type' | 'local_path' | 's3_key'>
): Promise<{ videoPath: string; cleanup: () => Promise<void> }> => {
  if (row.storage_type === 'local') {
    if (!row.local_path) {
      throw new Error(`Video ${row.id} has local storage but no local path`);
    }
    return { videoPath: resolveLocalVideoPath(row.local_path), cleanup: async () => {} };
  }

  if (!row.s3_key) {
    throw new Error(`Video ${row.id} has S3 storage but no S3 key`);
  }

  const extension = path.extname(row.s3_key) || '.mp4';
  const tempPath = path.join(os.tmpdir(), `bethunana-media-${randomUUID()}${extension}`);
  const object = await getS3Object(row.s3_key);
  await pipeline(object.stream, createWriteStream(tempPath));

  return {
    videoPath: tempPath,
    cleanup: async () => {
      try {
        await unlink(tempPath);
      } catch {
        // Temp file cleanup is best-effort.
      }
    }
  };
};

/**
 * Generates AI practice questions for one video and stores them, replacing any
 * previous AI-generated set. Shared by the media-jobs worker and (in inline
 * mode) the admin generate endpoint. Returns the number of questions stored.
 */
export const generateQuestionsForVideo = async (videoId: string): Promise<number> => {
  const rows = await queryRows<QuestionContextRow>(
    `SELECT TOP 1
       v.id,
       v.duration_seconds,
       v.storage_type,
       v.local_path,
       v.s3_key,
       v.title,
       v.description,
       t.name AS topic_name,
       s.name AS subject_name
     FROM videos v
     LEFT JOIN topics t ON t.id = v.topic_id
     LEFT JOIN subjects s ON s.id = t.subject_id
     WHERE v.id = ?`,
    [videoId]
  );
  const row = rows[0];
  if (!row) {
    throw new Error(`Video ${videoId} not found`);
  }

  const { videoPath, cleanup } = await materializeVideoFile(row);
  try {
    const durationSeconds =
      Number(row.duration_seconds) > 0
        ? Number(row.duration_seconds)
        : (await getVideoDurationSeconds(videoPath)) ?? 0;

    const transcript = await transcribeVideoAudio(videoPath, row.id);
    const frames = await captureEvenlySpacedFrames(
      videoPath,
      durationSeconds,
      env.AI_QUESTION_FRAME_COUNT
    );

    const questions = await generateVideoQuestions({
      title: row.title,
      subjectName: row.subject_name ?? undefined,
      topicName: row.topic_name ?? undefined,
      transcript,
      frames,
      count: env.AI_QUESTIONS_PER_VIDEO
    });

    await replaceGeneratedQuestions(row.id, questions);
    return questions.length;
  } finally {
    await cleanup();
  }
};
