import { execute, queryRows, withTransaction } from '../config/db.js';
import { HttpError } from '../types/index.js';
import type { GeneratedQuestion } from './bedrock.service.js';

let ensuredTable = false;
let ensureTableInFlight: Promise<void> | null = null;

// In-memory generation state for inline mode (AI_QUESTIONS_INLINE), where the
// admin generate endpoint runs generation in the API process instead of via the
// shared media_jobs queue. Process-local, which is correct because the same API
// process both starts generation and serves the status endpoint.
const inlineInFlight = new Set<string>();
const inlineFailures = new Map<string, string>();

export const isInlineGenerationInFlight = (videoId: string): boolean =>
  inlineInFlight.has(videoId);

export const markInlineGenerationStarted = (videoId: string): void => {
  inlineInFlight.add(videoId);
  inlineFailures.delete(videoId);
};

export const markInlineGenerationDone = (videoId: string): void => {
  inlineInFlight.delete(videoId);
  inlineFailures.delete(videoId);
};

export const markInlineGenerationFailed = (videoId: string, error: string): void => {
  inlineInFlight.delete(videoId);
  inlineFailures.set(videoId, error.slice(0, 2000));
};

export interface VideoQuestion {
  id: number;
  videoId: string;
  position: number;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  difficulty: string;
  source: string;
}

/** What learners receive — no correct answer or explanation leaked. */
export interface LearnerQuestion {
  id: number;
  position: number;
  question: string;
  options: string[];
  difficulty: string;
}

export interface GradedAnswer {
  questionId: number;
  selectedIndex: number | null;
  correctIndex: number;
  isCorrect: boolean;
  explanation: string;
}

export interface AttemptResult {
  total: number;
  correct: number;
  answers: GradedAnswer[];
}

export type QuestionGenerationState = 'none' | 'queued' | 'processing' | 'completed' | 'failed';

export interface QuestionGenerationStatus {
  state: QuestionGenerationState;
  questionCount: number;
  lastError: string | null;
}

interface VideoQuestionRow {
  id: number;
  video_id: string;
  position: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_index: number;
  explanation: string | null;
  difficulty: string | null;
  source: string;
}

const rowToQuestion = (row: VideoQuestionRow): VideoQuestion => ({
  id: Number(row.id),
  videoId: row.video_id,
  position: Number(row.position),
  question: row.question_text,
  options: [row.option_a, row.option_b, row.option_c, row.option_d],
  correctIndex: Number(row.correct_index),
  explanation: row.explanation ?? '',
  difficulty: row.difficulty ?? 'medium',
  source: row.source
});

export const ensureVideoQuestionsTable = async (): Promise<void> => {
  if (ensuredTable) return;
  if (ensureTableInFlight) {
    await ensureTableInFlight;
    return;
  }

  ensureTableInFlight = (async () => {
    await execute(
      `IF OBJECT_ID('dbo.video_questions', 'U') IS NULL
       BEGIN
         CREATE TABLE dbo.video_questions (
           id BIGINT IDENTITY(1,1) NOT NULL,
           video_id CHAR(36) NOT NULL,
           position INT NOT NULL CONSTRAINT df_video_questions_position DEFAULT 0,
           question_text NVARCHAR(1000) NOT NULL,
           option_a NVARCHAR(500) NOT NULL,
           option_b NVARCHAR(500) NOT NULL,
           option_c NVARCHAR(500) NOT NULL,
           option_d NVARCHAR(500) NOT NULL,
           correct_index TINYINT NOT NULL,
           explanation NVARCHAR(2000) NULL,
           difficulty VARCHAR(20) NULL,
           source VARCHAR(20) NOT NULL CONSTRAINT df_video_questions_source DEFAULT 'ai',
           created_at DATETIME2 NOT NULL CONSTRAINT df_video_questions_created_at DEFAULT GETDATE(),
           updated_at DATETIME2 NOT NULL CONSTRAINT df_video_questions_updated_at DEFAULT GETDATE(),
           CONSTRAINT pk_video_questions PRIMARY KEY (id),
           CONSTRAINT chk_video_questions_correct CHECK (correct_index BETWEEN 0 AND 3),
           CONSTRAINT fk_video_questions_video
             FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
         );

         CREATE INDEX idx_video_questions_video ON dbo.video_questions (video_id, position);
       END`
    );
    ensuredTable = true;
  })();

  try {
    await ensureTableInFlight;
  } finally {
    ensureTableInFlight = null;
  }
};

/**
 * Replaces all AI-generated questions for a video in a single transaction so a
 * regeneration never leaves a half-written set behind. Manually-authored
 * questions (source != 'ai') are preserved.
 */
export const replaceGeneratedQuestions = async (
  videoId: string,
  questions: GeneratedQuestion[]
): Promise<void> => {
  await ensureVideoQuestionsTable();
  await withTransaction(async (tx) => {
    await tx.execute(`DELETE FROM video_questions WHERE video_id = ? AND source = 'ai'`, [videoId]);
    let position = 0;
    for (const q of questions) {
      await tx.execute(
        `INSERT INTO video_questions
           (video_id, position, question_text, option_a, option_b, option_c, option_d,
            correct_index, explanation, difficulty, source)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ai')`,
        [
          videoId,
          position,
          q.question,
          q.options[0],
          q.options[1],
          q.options[2],
          q.options[3],
          q.correctIndex,
          q.explanation,
          q.difficulty
        ]
      );
      position += 1;
    }
  });
};

export const listQuestionsForVideo = async (videoId: string): Promise<VideoQuestion[]> => {
  await ensureVideoQuestionsTable();
  const rows = await queryRows<VideoQuestionRow>(
    `SELECT id, video_id, position, question_text, option_a, option_b, option_c, option_d,
            correct_index, explanation, difficulty, source
     FROM video_questions
     WHERE video_id = ?
     ORDER BY position ASC, id ASC`,
    [videoId]
  );
  return rows.map(rowToQuestion);
};

export const listLearnerQuestionsForVideo = async (
  videoId: string
): Promise<LearnerQuestion[]> => {
  const questions = await listQuestionsForVideo(videoId);
  return questions.map((q) => ({
    id: q.id,
    position: q.position,
    question: q.question,
    options: q.options,
    difficulty: q.difficulty
  }));
};

/** Grades a learner's answers server-side; correct answers never leave until now. */
export const gradeAttempt = async (
  videoId: string,
  answers: Record<string, number>
): Promise<AttemptResult> => {
  const questions = await listQuestionsForVideo(videoId);
  if (questions.length === 0) {
    throw new HttpError(404, 'No questions available for this video');
  }

  const graded: GradedAnswer[] = questions.map((q) => {
    const rawSelected = answers[String(q.id)];
    const selectedIndex =
      typeof rawSelected === 'number' && Number.isInteger(rawSelected) && rawSelected >= 0 && rawSelected <= 3
        ? rawSelected
        : null;
    return {
      questionId: q.id,
      selectedIndex,
      correctIndex: q.correctIndex,
      isCorrect: selectedIndex === q.correctIndex,
      explanation: q.explanation
    };
  });

  return {
    total: questions.length,
    correct: graded.filter((a) => a.isCorrect).length,
    answers: graded
  };
};

export const deleteQuestion = async (videoId: string, questionId: number): Promise<void> => {
  await ensureVideoQuestionsTable();
  const result = await execute(
    `DELETE FROM video_questions WHERE id = ? AND video_id = ?`,
    [questionId, videoId]
  );
  if (result.affectedRows === 0) {
    throw new HttpError(404, 'Question not found');
  }
};

export interface UpdateQuestionInput {
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
  difficulty?: string;
}

export const updateQuestion = async (
  videoId: string,
  questionId: number,
  input: UpdateQuestionInput
): Promise<void> => {
  await ensureVideoQuestionsTable();
  if (input.options.length !== 4 || !input.options.every((o) => o.trim().length > 0)) {
    throw new HttpError(400, 'Exactly four non-empty options are required');
  }
  if (!Number.isInteger(input.correctIndex) || input.correctIndex < 0 || input.correctIndex > 3) {
    throw new HttpError(400, 'correctIndex must be an integer between 0 and 3');
  }
  if (!input.question.trim()) {
    throw new HttpError(400, 'Question text is required');
  }

  const result = await execute(
    `UPDATE video_questions
     SET question_text = ?, option_a = ?, option_b = ?, option_c = ?, option_d = ?,
         correct_index = ?, explanation = ?, difficulty = ?, updated_at = GETDATE()
     WHERE id = ? AND video_id = ?`,
    [
      input.question.trim(),
      input.options[0].trim(),
      input.options[1].trim(),
      input.options[2].trim(),
      input.options[3].trim(),
      input.correctIndex,
      input.explanation?.trim() ?? '',
      input.difficulty?.trim() ?? 'medium',
      questionId,
      videoId
    ]
  );
  if (result.affectedRows === 0) {
    throw new HttpError(404, 'Question not found');
  }
};

interface GenerationStatusRow {
  status: QuestionGenerationState;
  last_error: string | null;
}

/**
 * Reports where question generation stands for a video, so the UI can show a
 * "generating…" state. Derived from the latest video_generate_questions job in
 * the shared media_jobs queue plus the current question count.
 */
export const getGenerationStatus = async (
  videoId: string
): Promise<QuestionGenerationStatus> => {
  await ensureVideoQuestionsTable();

  const countRows = await queryRows<{ n: number }>(
    `SELECT COUNT(*) AS n FROM video_questions WHERE video_id = ?`,
    [videoId]
  );
  const questionCount = Number(countRows[0]?.n ?? 0);

  // Inline generation (in-process) takes precedence over the media_jobs queue,
  // which a foreign/old worker on a shared DB might otherwise interfere with.
  if (inlineInFlight.has(videoId)) {
    return { state: 'processing', questionCount, lastError: null };
  }
  const inlineError = inlineFailures.get(videoId);
  if (inlineError && questionCount === 0) {
    return { state: 'failed', questionCount, lastError: inlineError };
  }

  let state: QuestionGenerationState = questionCount > 0 ? 'completed' : 'none';
  let lastError: string | null = null;

  let jobRows: GenerationStatusRow[] = [];
  try {
    jobRows = await queryRows<GenerationStatusRow>(
      `SELECT TOP 1 status, last_error
       FROM media_jobs
       WHERE video_id = ? AND job_type = 'video_generate_questions'
       ORDER BY id DESC`,
      [videoId]
    );
  } catch {
    // media_jobs may not exist yet on a fresh DB before the worker runs;
    // fall back to the question-count-derived state.
  }
  const job = jobRows[0];
  if (job) {
    if (job.status === 'queued' || job.status === 'processing') {
      state = job.status;
    } else if (job.status === 'failed' && questionCount === 0) {
      state = 'failed';
      lastError = job.last_error;
    }
  }

  return { state, questionCount, lastError };
};
