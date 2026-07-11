import { Router } from 'express';
import {
  changePasswordHandler,
  loginHandler,
  logoutHandler
} from '../controllers/auth.controller.js';

const authRouter = Router();

authRouter.post('/login', loginHandler);
authRouter.post('/logout', logoutHandler);
authRouter.post('/change-password', changePasswordHandler);

export default authRouter;
