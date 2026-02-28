import { Router } from 'express';
import { loginHandler } from '../controllers/auth.controller.js';

const authRouter = Router();

authRouter.post('/login', loginHandler);

export default authRouter;
