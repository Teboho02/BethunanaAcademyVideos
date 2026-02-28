import { Router } from 'express';
import {
  deleteStudentHandler,
  deactivateStudentHandler,
  enrollStudentHandler,
  listStudentsHandler
} from '../controllers/student.controller.js';

const studentRouter = Router();

studentRouter.post('/enroll', enrollStudentHandler);
studentRouter.get('/', listStudentsHandler);
studentRouter.patch('/:id/deactivate', deactivateStudentHandler);
studentRouter.delete('/:id', deleteStudentHandler);

export default studentRouter;
