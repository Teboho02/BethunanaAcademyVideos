import { Router } from 'express';
import {
  createTopicHandler,
  deleteTopicHandler,
  listTopicsHandler,
  renameTopicHandler,
} from '../controllers/topic.controller.js';

const topicRouter = Router();

topicRouter.get('/', listTopicsHandler);
topicRouter.post('/', createTopicHandler);
topicRouter.patch('/:id', renameTopicHandler);
topicRouter.delete('/:id', deleteTopicHandler);

export default topicRouter;
