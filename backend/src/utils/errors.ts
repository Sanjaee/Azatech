export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errors?: Record<string, string[]>;

  constructor(message: string, statusCode = 400, errors?: Record<string, string[]>) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errors = errors;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', errors?: Record<string, string[]>) {
    super(message, 401, errors);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', errors?: Record<string, string[]>) {
    super(message, 403, errors);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', errors?: Record<string, string[]>) {
    super(message, 404, errors);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict', errors?: Record<string, string[]>) {
    super(message, 409, errors);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed', errors?: Record<string, string[]>) {
    super(message, 422, errors);
  }
}
