import { Router } from 'express';
import {
  createCatalogTopicHandler,
  getCatalogHandler,
  getCatalogVideoHandler
} from '../controllers/content.controller.js';
import { deleteVideoHandler } from '../controllers/video.controller.js';

const contentRouter = Router();

contentRouter.get('/catalog', getCatalogHandler);
contentRouter.get('/videos/:id', getCatalogVideoHandler);
contentRouter.delete('/videos/:id', deleteVideoHandler);
contentRouter.post('/topics', createCatalogTopicHandler);

export default contentRouter;
