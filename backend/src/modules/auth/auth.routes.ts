import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authController } from './auth.controller';
import { requireAuth } from '../../middleware/auth.middleware';
import { env } from '../../config/env';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.NODE_ENV === 'test' ? 1000 : 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts, please try again later.',
  },
});

export const authRouter = Router();

authRouter.post('/login', loginLimiter, (req, res, next) => authController.login(req, res, next));
authRouter.get('/me', requireAuth, (req, res, next) => authController.me(req, res, next));
