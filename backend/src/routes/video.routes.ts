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
import { requireAdmin } from '../middleware/auth.middleware.js';

const videoRouter = Router();

// Admin-only management endpoints. Streaming, thumbnails and watch progress
// stay open for learners and the mobile app.
videoRouter.post('/upload', requireAdmin, uploadVideoMiddleware, uploadVideoHandler);
videoRouter.get('/analytics', requireAdmin, listVideoAnalyticsHandler);
videoRouter.get('/:id/analytics', requireAdmin, getVideoAnalyticsHandler);
videoRouter.get('/:id/progress', getWatchProgressHandler);
videoRouter.post('/:id/progress', saveWatchProgressHandler);
videoRouter.get('/:id/thumbnail', streamVideoThumbnailHandler);
videoRouter.get('/:id/stream', streamVideoHandler);

// AI practice questions. Listing + attempts are open to learners; generation
// and editing are admin-only.
videoRouter.get('/:id/questions', listQuestionsHandler);
videoRouter.post('/:id/questions/attempt', attemptQuestionsHandler);
videoRouter.get('/:id/questions/admin', requireAdmin, listAdminQuestionsHandler);
videoRouter.post('/:id/questions/generate', requireAdmin, generateQuestionsHandler);
videoRouter.put('/:id/questions/:questionId', requireAdmin, updateQuestionHandler);
videoRouter.delete('/:id/questions/:questionId', requireAdmin, deleteQuestionHandler);

videoRouter.delete('/:id', requireAdmin, deleteVideoHandler);
videoRouter.get('/', requireAdmin, listVideosHandler);

export default videoRouter;
