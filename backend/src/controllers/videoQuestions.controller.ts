import type { RequestHandler } from 'express';
import { HttpError } from '../types/index.js';
import { env } from '../config/env.js';
import {
  enqueueAllQuestionGenerationJobs,
  enqueueQuestionGenerationJob
} from '../services/mediaJobs.service.js';
import { generateQuestionsForVideo } from '../services/questionGeneration.service.js';
import {
  deleteQuestion,
  gradeAttempt,
  getGenerationStatus,
  isInlineGenerationInFlight,
  listLearnerQuestionsForVideo,
  listQuestionsForVideo,
  markInlineGenerationDone,
  markInlineGenerationFailed,
  markInlineGenerationStarted,
  updateQuestion
} from '../services/videoQuestions.service.js';

const requireVideoId = (value: unknown): string => {
  const videoId = typeof value === 'string' ? value.trim() : '';
  if (!videoId) {
    throw new HttpError(400, 'Video id is required');
  }
  return videoId;
};

// Learner-facing: questions without correct answers, plus generation status so
// the UI can show a "still generating" state.
export const listQuestionsHandler: RequestHandler = async (req, res, next) => {
  try {
    const videoId = requireVideoId(req.params.id);
    const [questions, generation] = await Promise.all([
      listLearnerQuestionsForVideo(videoId),
      getGenerationStatus(videoId)
    ]);
    res.status(200).json({ success: true, data: { questions, generation } });
  } catch (error) {
    next(error);
  }
};

export const attemptQuestionsHandler: RequestHandler = async (req, res, next) => {
  try {
    const videoId = requireVideoId(req.params.id);
    const rawAnswers = (req.body as { answers?: unknown }).answers;
    if (!rawAnswers || typeof rawAnswers !== 'object' || Array.isArray(rawAnswers)) {
      throw new HttpError(400, 'answers must be an object mapping questionId to selected option index');
    }

    const answers: Record<string, number> = {};
    for (const [key, value] of Object.entries(rawAnswers as Record<string, unknown>)) {
      if (typeof value === 'number' && Number.isInteger(value)) {
        answers[key] = value;
      }
    }

    const result = await gradeAttempt(videoId, answers);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

// Admin-only: (re)generate questions for a video.
//
// Inline mode runs generation in this API process (no shared queue) so a
// foreign/old worker on a shared DB can't claim and fail the job. Queue mode
// enqueues a media_jobs job for the dedicated worker to pick up.
export const generateQuestionsHandler: RequestHandler = async (req, res, next) => {
  try {
    const videoId = requireVideoId(req.params.id);

    if (env.AI_QUESTIONS_INLINE) {
      if (!env.AI_QUESTIONS_ENABLED) {
        throw new HttpError(400, 'AI question generation is disabled');
      }
      if (isInlineGenerationInFlight(videoId)) {
        res.status(202).json({
          success: true,
          data: { enqueued: false },
          message: 'Question generation is already in progress'
        });
        return;
      }

      markInlineGenerationStarted(videoId);
      // Fire-and-forget: generation takes minutes, so we respond immediately and
      // let the client poll the status endpoint. Errors are recorded in memory.
      void generateQuestionsForVideo(videoId)
        .then((count) => {
          markInlineGenerationDone(videoId);
          console.info(`[api] Inline generation stored ${count} question(s) for video ${videoId}.`);
        })
        .catch((error) => {
          const message = error instanceof Error ? error.message : String(error);
          markInlineGenerationFailed(videoId, message);
          console.error(`[api] Inline generation failed for video ${videoId}: ${message}`);
        });

      res.status(202).json({
        success: true,
        data: { enqueued: true },
        message: 'Question generation started'
      });
      return;
    }

    const enqueued = await enqueueQuestionGenerationJob(videoId);
    res.status(202).json({
      success: true,
      data: { enqueued },
      message: enqueued
        ? 'Question generation started'
        : 'Question generation is already in progress'
    });
  } catch (error) {
    next(error);
  }
};

// Admin-only: (re)generate questions for EVERY published video in one batch.
// Enqueues one generation job per video onto the shared media_jobs queue; the
// dedicated worker processes them sequentially. Existing AI questions are
// overwritten per video, manual questions are preserved.
export const regenerateAllQuestionsHandler: RequestHandler = async (_req, res, next) => {
  try {
    if (!env.AI_QUESTIONS_ENABLED) {
      throw new HttpError(400, 'AI question generation is disabled');
    }

    const enqueued = await enqueueAllQuestionGenerationJobs();
    res.status(202).json({
      success: true,
      data: { enqueued },
      message: `Queued question generation for ${enqueued} video(s)`
    });
  } catch (error) {
    next(error);
  }
};

// Admin-only: full questions including correct answers + explanations.
export const listAdminQuestionsHandler: RequestHandler = async (req, res, next) => {
  try {
    const videoId = requireVideoId(req.params.id);
    const [questions, generation] = await Promise.all([
      listQuestionsForVideo(videoId),
      getGenerationStatus(videoId)
    ]);
    res.status(200).json({ success: true, data: { questions, generation } });
  } catch (error) {
    next(error);
  }
};

const parseQuestionId = (value: unknown): number => {
  const questionId = Number(typeof value === 'string' ? value : NaN);
  if (!Number.isInteger(questionId) || questionId <= 0) {
    throw new HttpError(400, 'A valid question id is required');
  }
  return questionId;
};

export const updateQuestionHandler: RequestHandler = async (req, res, next) => {
  try {
    const videoId = requireVideoId(req.params.id);
    const questionId = parseQuestionId(req.params.questionId);
    const body = req.body as {
      question?: unknown;
      options?: unknown;
      correctIndex?: unknown;
      explanation?: unknown;
      difficulty?: unknown;
    };

    if (typeof body.question !== 'string') {
      throw new HttpError(400, 'question is required');
    }
    if (!Array.isArray(body.options) || !body.options.every((o) => typeof o === 'string')) {
      throw new HttpError(400, 'options must be an array of strings');
    }
    if (typeof body.correctIndex !== 'number') {
      throw new HttpError(400, 'correctIndex is required');
    }

    await updateQuestion(videoId, questionId, {
      question: body.question,
      options: body.options,
      correctIndex: body.correctIndex,
      explanation: typeof body.explanation === 'string' ? body.explanation : undefined,
      difficulty: typeof body.difficulty === 'string' ? body.difficulty : undefined
    });
    res.status(200).json({ success: true, message: 'Question updated' });
  } catch (error) {
    next(error);
  }
};

export const deleteQuestionHandler: RequestHandler = async (req, res, next) => {
  try {
    const videoId = requireVideoId(req.params.id);
    const questionId = parseQuestionId(req.params.questionId);
    await deleteQuestion(videoId, questionId);
    res.status(200).json({ success: true, message: 'Question deleted' });
  } catch (error) {
    next(error);
  }
};
