import { OAuth2Client } from 'google-auth-library';
import { env, googleAuthEnabled } from '../../config/env';
import { logger } from '../../config/logger';
import { User, hashPassword, type UserDoc } from '../../models';
import { ApiError } from '../../utils/errors';
import { sendPasswordResetEmail, sendVerificationEmail } from '../notifications/mail';
import {
  generateOneTimeToken,
  generateOtp,
  hashToken,
  issueTokens,
  revokeAllForUser,
  revokeRefreshToken,
  rotateRefreshToken,
  signAccessToken,
  type IssuedTokens,
} from './tokens';
import type { LoginInput, RegisterInput } from './validators';

export interface RequestContext {
  userAgent?: string;
  ip?: string;
}

export interface AuthResult {
  user: UserDoc;
  tokens: IssuedTokens;
}

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 30 * 60 * 1000;

function assertUsable(user: UserDoc): void {
  if (user.status === 'BANNED') {
    throw new ApiError(403, 'ACCOUNT_BANNED', 'This account has been permanently banned');
  }
  if (user.isSuspended()) {
    const until = user.suspendedUntil ? ` until ${user.suspendedUntil.toISOString()}` : '';
    throw new ApiError(403, 'ACCOUNT_SUSPENDED', `This account is suspended${until}`);
  }
}

export async function register(input: RegisterInput, ctx: RequestContext): Promise<AuthResult> {
  const existing = await User.findOne({ email: input.email });
  if (existing) {
    throw ApiError.conflict('An account with that email already exists');
  }

  const { token, hash } = generateOneTimeToken();
  const user = await User.create({
    name: input.name,
    email: input.email,
    passwordHash: await hashPassword(input.password),
    college: input.college,
    department: input.department,
    year: input.year,
    emailVerificationTokenHash: hash,
    emailVerificationExpires: new Date(Date.now() + VERIFICATION_TTL_MS),
    ...(input.acceptTerms ? { termsAcceptedAt: new Date() } : {}),
  });

  // Not awaited: a slow mail server must not hold up sign-up. `sendMail` handles its own errors.
  void sendVerificationEmail(user.email, user.name, token);

  return { user, tokens: await issueTokens(String(user._id), user.role, ctx) };
}

export async function login(input: LoginInput, ctx: RequestContext): Promise<AuthResult> {
  const user = await User.findOne({ email: input.email }).select('+passwordHash');

  // One generic message for both "no such user" and "wrong password", so the endpoint
  // cannot be used to enumerate which emails are registered.
  const invalid = ApiError.unauthorized('Incorrect email or password');
  if (!user || !user.passwordHash) throw invalid;

  const ok = await user.verifyPassword(input.password);
  if (!ok) throw invalid;

  assertUsable(user);

  return { user, tokens: await issueTokens(String(user._id), user.role, ctx) };
}

let googleClient: OAuth2Client | null = null;

/**
 * Verifies a Google ID token issued to one of our own client IDs and signs the student
 * in, creating the account on first use.
 */
export async function loginWithGoogle(idToken: string, ctx: RequestContext): Promise<AuthResult> {
  if (!googleAuthEnabled) {
    throw new ApiError(501, 'GOOGLE_AUTH_DISABLED', 'Google sign-in is not configured');
  }
  googleClient ??= new OAuth2Client();

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      // Restricting the audience is what stops a token minted for another app being
      // replayed against ours.
      audience: env.GOOGLE_CLIENT_IDS,
    });
    payload = ticket.getPayload();
  } catch (err) {
    logger.warn({ err }, 'Google ID token verification failed');
    throw ApiError.unauthorized('Google sign-in failed');
  }

  if (!payload?.email || !payload.sub) {
    throw ApiError.unauthorized('Google account did not supply an email address');
  }
  if (!payload.email_verified) {
    throw ApiError.unauthorized('Your Google email address is not verified');
  }

  const email = payload.email.toLowerCase();
  let user = await User.findOne({ $or: [{ googleId: payload.sub }, { email }] });

  if (!user) {
    user = await User.create({
      name: payload.name?.slice(0, 80) || email.split('@')[0],
      email,
      googleId: payload.sub,
      profileImage: payload.picture,
      // Google has already proven ownership of the address.
      emailVerified: true,
    });
  } else {
    assertUsable(user);
    // Link the Google identity to a pre-existing password account on first Google login.
    let dirty = false;
    if (!user.googleId) {
      user.googleId = payload.sub;
      dirty = true;
    }
    if (!user.emailVerified) {
      user.emailVerified = true;
      dirty = true;
    }
    if (!user.profileImage && payload.picture) {
      user.profileImage = payload.picture;
      dirty = true;
    }
    if (dirty) await user.save();
  }

  return { user, tokens: await issueTokens(String(user._id), user.role, ctx) };
}

export async function refresh(
  refreshToken: string,
  ctx: RequestContext,
): Promise<{ user: UserDoc; tokens: IssuedTokens }> {
  const rotated = await rotateRefreshToken(refreshToken, ctx);

  // The role comes from the freshly-read user, not from the old token, so privilege
  // changes take effect on the next refresh rather than after the refresh TTL.
  const user = await User.findById(rotated.userId);
  if (!user) throw ApiError.unauthorized('Account no longer exists');
  assertUsable(user);

  return {
    user,
    tokens: {
      accessToken: signAccessToken(String(user._id), user.role),
      refreshToken: rotated.refreshToken,
      accessExpiresIn: env.ACCESS_TOKEN_TTL,
      refreshExpiresAt: rotated.refreshExpiresAt,
    },
  };
}

export async function logout(refreshToken: string): Promise<void> {
  await revokeRefreshToken(refreshToken);
}

export async function logoutEverywhere(userId: string): Promise<void> {
  await revokeAllForUser(userId);
}

/**
 * Always reports success. Telling an anonymous caller whether an address is registered
 * would turn this endpoint into an account-enumeration oracle.
 */
export async function forgotPassword(email: string): Promise<void> {
  const user = await User.findOne({ email });
  if (!user) {
    logger.debug({ email }, 'Password reset requested for unknown address');
    return;
  }

  const otp = generateOtp();
  user.passwordResetTokenHash = hashToken(otp);
  user.passwordResetExpires = new Date(Date.now() + RESET_TTL_MS);
  await user.save();

  // Not awaited: waiting would make known addresses measurably slower than unknown ones.
  void sendPasswordResetEmail(user.email, user.name, otp);
}

export async function resetPassword(
  email: string,
  otp: string,
  newPassword: string,
): Promise<void> {
  const user = await User.findOne({ email }).select(
    '+passwordResetTokenHash +passwordResetExpires',
  );
  const invalid = ApiError.badRequest('That reset code is invalid or has expired');

  if (!user?.passwordResetTokenHash || !user.passwordResetExpires) throw invalid;
  if (user.passwordResetExpires.getTime() < Date.now()) throw invalid;
  if (user.passwordResetTokenHash !== hashToken(otp)) throw invalid;

  user.passwordHash = await hashPassword(newPassword);
  user.passwordResetTokenHash = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  // A password reset is the standard response to a compromise, so every existing
  // session is terminated.
  await revokeAllForUser(String(user._id));
}

export async function verifyEmail(token: string): Promise<void> {
  const user = await User.findOne({
    emailVerificationTokenHash: hashToken(token),
  }).select('+emailVerificationTokenHash +emailVerificationExpires');

  if (!user || !user.emailVerificationExpires) {
    throw ApiError.badRequest('That verification link is invalid');
  }
  if (user.emailVerificationExpires.getTime() < Date.now()) {
    throw ApiError.badRequest('That verification link has expired');
  }

  user.emailVerified = true;
  user.emailVerificationTokenHash = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();
}

export async function resendVerification(user: UserDoc): Promise<void> {
  if (user.emailVerified) throw ApiError.badRequest('Your email is already verified');

  const { token, hash } = generateOneTimeToken();
  user.emailVerificationTokenHash = hash;
  user.emailVerificationExpires = new Date(Date.now() + VERIFICATION_TTL_MS);
  await user.save();

  await sendVerificationEmail(user.email, user.name, token);
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await User.findById(userId).select('+passwordHash');
  if (!user) throw ApiError.notFound('Account not found');

  if (!user.passwordHash) {
    throw ApiError.badRequest(
      'This account signs in with Google. Use "forgot password" to set one.',
    );
  }
  if (!(await user.verifyPassword(currentPassword))) {
    throw ApiError.badRequest('Your current password is incorrect');
  }

  user.passwordHash = await hashPassword(newPassword);
  await user.save();
  await revokeAllForUser(userId);
}
