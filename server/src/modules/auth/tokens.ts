import crypto from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../../config/env';
import { RefreshToken } from '../../models';
import type { UserRole } from '../../types/domain';
import { ApiError } from '../../utils/errors';

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  /** Token version marker, reserved for future global invalidation. */
  v: number;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  accessExpiresIn: string;
  refreshExpiresAt: Date;
}

export function signAccessToken(userId: string, role: UserRole): string {
  const payload: AccessTokenPayload = { sub: userId, role, v: 1 };
  const options: SignOptions = {
    expiresIn: env.ACCESS_TOKEN_TTL as SignOptions['expiresIn'],
    issuer: 'student-skill-exchange',
  };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      issuer: 'student-skill-exchange',
    });
    if (typeof decoded === 'string' || !decoded.sub) {
      throw ApiError.unauthorized('Malformed token');
    }
    return decoded as unknown as AccessTokenPayload;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof jwt.TokenExpiredError) {
      throw new ApiError(401, 'TOKEN_EXPIRED', 'Access token expired');
    }
    throw ApiError.unauthorized('Invalid token');
  }
}

/**
 * Refresh tokens are opaque random strings, not JWTs: they must be revocable, and only
 * a hash is stored so a database dump yields nothing usable.
 */
export function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function issueTokens(
  userId: string,
  role: UserRole,
  context: { userAgent?: string; ip?: string } = {},
): Promise<IssuedTokens> {
  const refreshToken = generateRefreshToken();
  const refreshExpiresAt = new Date(
    Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  );

  await RefreshToken.create({
    user: userId,
    tokenHash: hashToken(refreshToken),
    expiresAt: refreshExpiresAt,
    userAgent: context.userAgent?.slice(0, 300),
    ip: context.ip?.slice(0, 64),
  });

  return {
    accessToken: signAccessToken(userId, role),
    refreshToken,
    accessExpiresIn: env.ACCESS_TOKEN_TTL,
    refreshExpiresAt,
  };
}

export interface RotatedRefresh {
  userId: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

/**
 * Rotate a refresh token: the presented token is revoked and a new one issued.
 *
 * No access token is minted here — the caller re-reads the user first, so a demoted or
 * suspended account cannot keep minting privileged access tokens for the remaining
 * lifetime of its refresh token.
 *
 * If a token that was already revoked is presented, that is a replay — the usual cause
 * is a stolen token being used after the legitimate client rotated. Every session for
 * the user is killed rather than silently issuing another pair.
 */
export async function rotateRefreshToken(
  presented: string,
  context: { userAgent?: string; ip?: string } = {},
): Promise<RotatedRefresh> {
  const presentedHash = hashToken(presented);
  const stored = await RefreshToken.findOne({ tokenHash: presentedHash });

  if (!stored) throw ApiError.unauthorized('Invalid refresh token');

  if (stored.revokedAt) {
    await RefreshToken.updateMany(
      { user: stored.user, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } },
    );
    throw new ApiError(
      401,
      'TOKEN_REUSE_DETECTED',
      'Refresh token was already used. All sessions have been signed out.',
    );
  }

  if (stored.expiresAt.getTime() <= Date.now()) {
    throw ApiError.unauthorized('Refresh token expired');
  }

  const userId = String(stored.user);
  const refreshToken = generateRefreshToken();
  const refreshExpiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  await RefreshToken.create({
    user: userId,
    tokenHash: hashToken(refreshToken),
    expiresAt: refreshExpiresAt,
    userAgent: context.userAgent?.slice(0, 300),
    ip: context.ip?.slice(0, 64),
  });

  stored.revokedAt = new Date();
  stored.replacedByHash = hashToken(refreshToken);
  await stored.save();

  return { userId, refreshToken, refreshExpiresAt };
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await RefreshToken.updateOne(
    { tokenHash: hashToken(token), revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } },
  );
}

export async function revokeAllForUser(userId: string): Promise<void> {
  await RefreshToken.updateMany(
    { user: userId, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } },
  );
}

/** Single-use tokens for email verification and password reset. */
export function generateOneTimeToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(32).toString('hex');
  return { token, hash: hashToken(token) };
}

/** Six-digit OTP for email/phone confirmation flows. */
export function generateOtp(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}
