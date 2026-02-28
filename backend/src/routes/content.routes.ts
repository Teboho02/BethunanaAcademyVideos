import { Router } from 'express';
import {
  createCatalogTopicHandler,
  getCatalogHandler,
  getCatalogVideoHandler
} from '../controllers/content.controller.js';

const contentRouter = Router();

contentRouter.get('/catalog', getCatalogHandler);
contentRouter.get('/videos/:id', getCatalogVideoHandler);
contentRouter.post('/topics', createCatalogTopicHandler);

export default contentRouter;
