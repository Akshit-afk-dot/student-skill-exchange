import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { User, type UserDoc } from '../models';
import { verifyAccessToken } from '../modules/auth/tokens';
import type { UserRole } from '../types/domain';
import { ApiError } from '../utils/errors';
import { asyncHandler } from '../utils/async';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: UserDoc;
      userId?: string;
    }
  }
}

function bearerFrom(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) return null;
  return token.trim() || null;
}

/**
 * Requires a valid access token and loads the user.
 *
 * The user document is fetched on every request rather than trusted from the token so
 * that a suspension or role change takes effect immediately, instead of waiting out the
 * access-token TTL.
 */
export const requireAuth: RequestHandler = asyncHandler(async (req, _res, next) => {
  const token = bearerFrom(req);
  if (!token) throw ApiError.unauthorized('Missing bearer token');

  const payload = verifyAccessToken(token);
  const user = await User.findById(payload.sub);
  if (!user) throw ApiError.unauthorized('Account no longer exists');

  if (user.status === 'BANNED') {
    throw new ApiError(403, 'ACCOUNT_BANNED', 'This account has been permanently banned');
  }
  if (user.isSuspended()) {
    const until = user.suspendedUntil ? ` until ${user.suspendedUntil.toISOString()}` : '';
    throw new ApiError(403, 'ACCOUNT_SUSPENDED', `This account is suspended${until}`);
  }

  req.user = user;
  req.userId = String(user._id);
  next();
});

/** Attaches the user when a token is present, but does not demand one. */
export const optionalAuth: RequestHandler = asyncHandler(async (req, _res, next) => {
  const token = bearerFrom(req);
  if (!token) return next();
  try {
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub);
    if (user && user.status === 'ACTIVE') {
      req.user = user;
      req.userId = String(user._id);
    }
  } catch {
    // An invalid token on an optional route is simply an anonymous request.
  }
  next();
});

export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden('This action requires elevated privileges'));
    }
    next();
  };
}

export const requireAdmin: RequestHandler[] = [requireAuth, requireRole('ADMIN')];

/** Narrowing helper for handlers mounted behind `requireAuth`. */
export function currentUser(req: Request): UserDoc {
  if (!req.user) throw ApiError.unauthorized();
  return req.user;
}

export function currentUserId(req: Request): string {
  if (!req.userId) throw ApiError.unauthorized();
  return req.userId;
}
