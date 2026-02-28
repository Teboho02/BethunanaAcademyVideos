import { Router } from 'express';
import studentRouter from './student.routes.js';
import videoRouter from './video.routes.js';
import contentRouter from './content.routes.js';
import authRouter from './auth.routes.js';
import topicRouter from './topic.routes.js';

const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString()
    }
  });
});

apiRouter.use('/admin/students', studentRouter);
apiRouter.use('/admin/topics', topicRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/videos', videoRouter);
apiRouter.use('/content', contentRouter);

export default apiRouter;
