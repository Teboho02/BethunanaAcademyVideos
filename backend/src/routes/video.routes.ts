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

const videoRouter = Router();

videoRouter.post('/upload', uploadVideoMiddleware, uploadVideoHandler);
videoRouter.get('/analytics', listVideoAnalyticsHandler);
videoRouter.get('/:id/analytics', getVideoAnalyticsHandler);
videoRouter.get('/:id/progress', getWatchProgressHandler);
videoRouter.post('/:id/progress', saveWatchProgressHandler);
videoRouter.get('/:id/thumbnail', streamVideoThumbnailHandler);
videoRouter.get('/:id/stream', streamVideoHandler);
videoRouter.delete('/:id', deleteVideoHandler);
videoRouter.get('/', listVideosHandler);

export default videoRouter;
