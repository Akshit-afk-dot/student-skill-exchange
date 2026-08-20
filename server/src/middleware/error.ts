import type { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { isProd } from '../config/env';
import { logger } from '../config/logger';
import { ApiError } from '../utils/errors';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(ApiError.notFound(`No route matches ${req.method} ${req.path}`));
}

/**
 * Duplicate-key detection without importing the `mongodb` driver directly: it is a
 * transitive dependency of mongoose, so depending on its types here would couple us to
 * a package we do not declare.
 */
function isDuplicateKeyError(err: unknown): err is { keyPattern?: Record<string, unknown> } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: unknown }).code === 11000
  );
}

interface ErrorBody {
  error: { code: string; message: string; details?: unknown; stack?: string };
}

/**
 * Single exit point for every failure. Translates the errors the data layer throws into
 * the same shape the rest of the API uses, so clients only ever parse one envelope.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  let apiError: ApiError;

  if (err instanceof ApiError) {
    apiError = err;
  } else if (err instanceof mongoose.Error.ValidationError) {
    const details: Record<string, string> = {};
    for (const [path, issue] of Object.entries(err.errors)) details[path] = issue.message;
    apiError = ApiError.unprocessable('Validation failed', details);
  } else if (err instanceof mongoose.Error.CastError) {
    apiError = ApiError.badRequest(`Invalid value for "${err.path}"`);
  } else if (isDuplicateKeyError(err)) {
    const field = Object.keys(err.keyPattern ?? {}).join(', ') || 'field';
    apiError = ApiError.conflict(`A record with that ${field} already exists`);
  } else if (err instanceof SyntaxError && 'body' in err) {
    apiError = ApiError.badRequest('Request body is not valid JSON');
  } else {
    apiError = ApiError.internal();
  }

  // 5xx means we did something wrong, so log the cause; 4xx is the client's business.
  if (apiError.status >= 500) {
    logger.error({ err, path: req.path, method: req.method }, 'Unhandled request error');
  } else {
    logger.debug({ code: apiError.code, path: req.path }, apiError.message);
  }

  const body: ErrorBody = {
    error: { code: apiError.code, message: apiError.message },
  };
  if (apiError.details !== undefined) body.error.details = apiError.details;
  // Stacks are debugging aids, never shipped to clients in production.
  if (!isProd && err instanceof Error && apiError.status >= 500) body.error.stack = err.stack;

  res.status(apiError.status).json(body);
}
