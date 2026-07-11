import { Router } from 'express';
import {
  deleteStudentHandler,
  deactivateStudentHandler,
  enrollStudentHandler,
  listStudentsHandler
} from '../controllers/student.controller.js';
import { requireAdmin, requireAdminOrSyncSecret } from '../middleware/auth.middleware.js';

const studentRouter = Router();

// Enroll also accepts trusted server-to-server calls from the exams platform.
studentRouter.post('/enroll', requireAdminOrSyncSecret, enrollStudentHandler);
studentRouter.get('/', requireAdmin, listStudentsHandler);
studentRouter.patch('/:id/deactivate', requireAdmin, deactivateStudentHandler);
studentRouter.delete('/:id', requireAdmin, deleteStudentHandler);

export default studentRouter;
