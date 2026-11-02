import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors';
import { env } from '../config/env';

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    const response: Record<string, unknown> = {
      success: false,
      message: err.message,
    };
    if (err.errors && Object.keys(err.errors).length > 0) {
      response.errors = err.errors;
    }
    res.status(err.statusCode).json(response);
    return;
  }

  if (err instanceof ZodError) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of err.issues) {
      const pathKey = issue.path.length > 0 ? issue.path.join('.') : 'root';
      if (!fieldErrors[pathKey]) {
        fieldErrors[pathKey] = [];
      }
      fieldErrors[pathKey].push(issue.message);
    }

    res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors: fieldErrors,
    });
    return;
  }

  // Handle PostgreSQL unique constraint violation (23505) or check violation (23514)
  if (err && typeof err === 'object' && 'code' in err) {
    const pgErr = err as { code?: string; constraint?: string; detail?: string };
    if (pgErr.code === '23505') {
      res.status(409).json({
        success: false,
        message: 'A record with the provided unique identifier already exists',
      });
      return;
    }
    if (pgErr.code === '23514') {
      res.status(422).json({
        success: false,
        message: 'Database constraint violation',
      });
      return;
    }
  }

  if (env.NODE_ENV !== 'test') {
    console.error('[Unhandled API Error]:', err);
  }

  res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
}
