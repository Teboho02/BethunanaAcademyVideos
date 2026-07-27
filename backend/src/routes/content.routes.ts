import { Router } from 'express';
import {
  createCatalogTopicHandler,
  getCatalogHandler,
  getCatalogVideoHandler
} from '../controllers/content.controller.js';
import { deleteVideoHandler } from '../controllers/video.controller.js';
import { requireSession } from '../middleware/auth.middleware.js';

const contentRouter = Router();

// Browsing the catalog requires a current single-device session.
contentRouter.get('/catalog', requireSession, getCatalogHandler);
contentRouter.get('/videos/:id', requireSession, getCatalogVideoHandler);
contentRouter.delete('/videos/:id', deleteVideoHandler);
contentRouter.post('/topics', createCatalogTopicHandler);

export default contentRouter;
