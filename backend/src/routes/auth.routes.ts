import { Router } from 'express';
import { loginHandler, logoutHandler } from '../controllers/auth.controller.js';

const authRouter = Router();

authRouter.post('/login', loginHandler);
authRouter.post('/logout', logoutHandler);

export default authRouter;
