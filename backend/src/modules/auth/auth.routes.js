import { Router } from 'express';
import * as ctrl from './auth.controller.js';
import { asyncHandler } from '../../utils/response.js';
import { authMiddleware } from '../../middlewares/authMiddleware.js';

export const authRouter = Router();

authRouter.post('/login', asyncHandler(ctrl.login));
authRouter.post('/logout', asyncHandler(ctrl.logout));
authRouter.post('/refresh', asyncHandler(ctrl.refresh));
authRouter.post('/forgot-password', asyncHandler(ctrl.forgotPassword));
authRouter.post('/reset-password', asyncHandler(ctrl.resetPassword));
authRouter.get('/me', authMiddleware, asyncHandler(ctrl.me));
authRouter.post('/change-password', authMiddleware, asyncHandler(ctrl.changePassword));
