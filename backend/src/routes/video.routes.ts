import { Router } from 'express';
import {
  deleteVideoHandler,
  getVideoAnalyticsHandler,
  getWatchProgressHandler,
  listVideoAnalyticsHandler,
  listVideosHandler,
  saveWatchProgressHandler,
  streamVideoThumbnailHandler,
  streamVideoHandler,
  uploadVideoHandler,
  uploadVideoMiddleware
} from '../controllers/video.controller.js';
import {
  attemptQuestionsHandler,
  deleteQuestionHandler,
  generateQuestionsHandler,
  listAdminQuestionsHandler,
  listQuestionsHandler,
  updateQuestionHandler
} from '../controllers/videoQuestions.controller.js';
import { requireAdmin, requireSession } from '../middleware/auth.middleware.js';

const videoRouter = Router();

// Admin-only management endpoints.
videoRouter.post('/upload', requireAdmin, uploadVideoMiddleware, uploadVideoHandler);
videoRouter.get('/analytics', requireAdmin, listVideoAnalyticsHandler);
videoRouter.get('/:id/analytics', requireAdmin, getVideoAnalyticsHandler);

// Learner endpoints now require a current single-device session (web sends the
// cookie, mobile a Bearer token). Thumbnails stay open — they are not sensitive
// and gating them would force auth headers onto every image request.
videoRouter.get('/:id/progress', requireSession, getWatchProgressHandler);
videoRouter.post('/:id/progress', requireSession, saveWatchProgressHandler);
videoRouter.get('/:id/thumbnail', streamVideoThumbnailHandler);
videoRouter.get('/:id/stream', requireSession, streamVideoHandler);

// AI practice questions. Listing + attempts require a signed-in learner;
// generation and editing are admin-only.
videoRouter.get('/:id/questions', requireSession, listQuestionsHandler);
videoRouter.post('/:id/questions/attempt', requireSession, attemptQuestionsHandler);
videoRouter.get('/:id/questions/admin', requireAdmin, listAdminQuestionsHandler);
videoRouter.post('/:id/questions/generate', requireAdmin, generateQuestionsHandler);
videoRouter.put('/:id/questions/:questionId', requireAdmin, updateQuestionHandler);
videoRouter.delete('/:id/questions/:questionId', requireAdmin, deleteQuestionHandler);

videoRouter.delete('/:id', requireAdmin, deleteVideoHandler);
videoRouter.get('/', requireAdmin, listVideosHandler);

export default videoRouter;
