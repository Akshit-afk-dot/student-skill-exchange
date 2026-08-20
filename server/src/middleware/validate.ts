import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { z, type ZodType } from 'zod';
import { ApiError } from '../utils/errors';

export interface RequestSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

/** Field-level errors the mobile client can attach directly to form inputs. */
function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    // Keep the first message per field; later ones are usually cascading noise.
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

/**
 * Validates and *replaces* the request parts with their parsed output, so handlers see
 * coerced types (numbers, dates, defaults) rather than raw strings.
 *
 * Express 5 exposes `req.query` as a getter with no setter, so the parsed query is
 * placed on `req.validatedQuery` instead of being assigned back.
 */
export function validate(schemas: RequestSchemas): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.params) req.params = schemas.params.parse(req.params) as typeof req.params;
      if (schemas.query) {
        req.validatedQuery = schemas.query.parse(req.query);
      }
      if (schemas.body) req.body = schemas.body.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        return next(ApiError.unprocessable('Validation failed', fieldErrors(err)));
      }
      next(err);
    }
  };
}

/** Typed accessor for the output of a `query` schema. */
export function validatedQuery<T>(req: Request): T {
  return req.validatedQuery as T;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      validatedQuery?: unknown;
    }
  }
}
