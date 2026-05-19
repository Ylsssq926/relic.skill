import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from 'express';

import { logger } from './logger';

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorPayload;
}

export class AppError extends Error {
  public readonly statusCode: number;

  public readonly code: string;

  public readonly details?: unknown;

  public readonly expose: boolean;

  public constructor(
    message: string,
    statusCode = 500,
    code = 'INTERNAL_ERROR',
    details?: unknown,
    expose = true,
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.expose = expose;
  }
}

export class ValidationError extends AppError {
  public constructor(message: string, details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  public constructor(message: string, details?: unknown) {
    super(message, 404, 'NOT_FOUND', details);
    this.name = 'NotFoundError';
  }
}

export class ConfigurationError extends AppError {
  public constructor(message: string, details?: unknown) {
    super(message, 503, 'CONFIGURATION_ERROR', details);
    this.name = 'ConfigurationError';
  }
}

export class ExternalServiceError extends AppError {
  public constructor(message: string, details?: unknown) {
    super(message, 502, 'EXTERNAL_SERVICE_ERROR', details);
    this.name = 'ExternalServiceError';
  }
}

export function successResponse<T>(data: T, meta?: Record<string, unknown>): ApiSuccessResponse<T> {
  if (meta) {
    return {
      success: true,
      data,
      meta,
    };
  }

  return {
    success: true,
    data,
  };
}

export function asyncHandler(handler: (request: Request, response: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return (request: Request, response: Response, next: NextFunction) => {
    void handler(request, response, next).catch(next);
  };
}

export const notFoundHandler: RequestHandler = (request: Request, _response: Response, next: NextFunction) => {
  next(new NotFoundError(`未找到路由: ${request.method} ${request.originalUrl}`));
};

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  request: Request,
  response: Response,
  _next: NextFunction,
) => {
  if (response.headersSent) {
    return;
  }

  const requestId = response.locals.requestId as string | undefined;
  const normalizedError = error instanceof AppError
    ? error
    : new AppError('服务器内部错误', 500, 'INTERNAL_ERROR', undefined, false);

  logger.error(normalizedError.message, {
    requestId,
    method: request.method,
    path: request.originalUrl,
    statusCode: normalizedError.statusCode,
    code: normalizedError.code,
    details: normalizedError.details,
    error: error instanceof Error ? error : undefined,
  });

  const payload: ApiErrorResponse = {
    success: false,
    error: {
      code: normalizedError.code,
      message: normalizedError.expose ? normalizedError.message : '服务器内部错误',
      timestamp: new Date().toISOString(),
      ...(normalizedError.details !== undefined ? { details: normalizedError.details } : {}),
      ...(requestId ? { requestId } : {}),
    },
  };

  response.status(normalizedError.statusCode).json(payload);
};
