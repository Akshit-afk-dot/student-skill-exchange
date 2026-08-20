import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import type { Request } from 'express';
import { isTest } from '../config/env';
import { ApiError } from '../utils/errors';

/**
 * Authenticated callers are limited per account, so several students behind one college
 * NAT do not exhaust a shared IP budget. Anonymous callers fall back to IP, via the
 * library's helper (it normalises IPv6 to a /56 block rather than a single address).
 */
function keyByUserOrIp(req: Request): string {
  return req.userId ? `user:${req.userId}` : `ip:${ipKeyGenerator(req.ip ?? '')}`;
}

const base = {
  standardHeaders: 'draft-7' as const,
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
  // Limits would make the integration suite flaky and prove nothing about the app.
  skip: () => isTest,
  handler: () => {
    throw ApiError.tooMany();
  },
};

/** Broad ceiling applied to the whole API. */
export const globalLimiter = rateLimit({ ...base, windowMs: 60_000, limit: 300 });

/** Credential endpoints: tight, to blunt password guessing. */
export const authLimiter = rateLimit({ ...base, windowMs: 15 * 60_000, limit: 20 });

/** Password reset and verification email triggers. */
export const emailLimiter = rateLimit({ ...base, windowMs: 60 * 60_000, limit: 5 });

/** Write-heavy social actions that would otherwise enable spam. */
export const writeLimiter = rateLimit({ ...base, windowMs: 60_000, limit: 60 });

/** Uploads are the most expensive request we serve. */
export const uploadLimiter = rateLimit({ ...base, windowMs: 60 * 60_000, limit: 40 });
