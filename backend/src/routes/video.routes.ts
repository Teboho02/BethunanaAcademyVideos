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
videoRouter.delete('/:id', requireAdmin, deleteVideoHandler);
videoRouter.get('/', requireAdmin, listVideosHandler);

export default videoRouter;
