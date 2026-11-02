import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import { loginSchema } from './auth.schema';
import { sendSuccess } from '../../utils/response';
import { AuthenticatedRequest } from '../../types';
import { UnauthorizedError } from '../../utils/errors';

export class AuthController {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = loginSchema.parse(req.body);
      const result = await authService.login(parsed);
      sendSuccess(res, result, 'Login successful', 200);
    } catch (error) {
      next(error);
    }
  }

  async me(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }
      const user = await authService.getCurrentUser(req.user.sub);
      sendSuccess(res, { user }, 'Authenticated user retrieved', 200);
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
