import { Router, type Request } from 'express';
import {
  authLimiter,
  emailLimiter,
  currentUser,
  currentUserId,
  requireAuth,
  validate,
  validatedQuery,
} from '../../middleware';
import { env } from '../../config/env';
import { asyncHandler } from '../../utils/async';
import { ApiError } from '../../utils/errors';
import { escapeHtml, renderPage } from '../../utils/html';
import { selfUser } from '../users/serializer';
import { registerPushToken, unregisterPushToken } from '../notifications/push';
import * as service from './service';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  googleSchema,
  loginSchema,
  pushTokenSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from './validators';

function contextOf(req: Request): service.RequestContext {
  return { userAgent: req.get('user-agent') ?? undefined, ip: req.ip };
}

export const authRouter = Router();

/**
 * POST /auth/register
 * Creates a student account and returns a token pair.
 */
authRouter.post(
  '/register',
  authLimiter,
  validate({ body: registerSchema }),
  asyncHandler(async (req, res) => {
    const { user, tokens } = await service.register(req.body, contextOf(req));
    res.status(201).json({ data: { user: selfUser(user), tokens } });
  }),
);

/** POST /auth/login */
authRouter.post(
  '/login',
  authLimiter,
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    const { user, tokens } = await service.login(req.body, contextOf(req));
    res.json({ data: { user: selfUser(user), tokens } });
  }),
);

/** POST /auth/google — exchanges a Google ID token for our own session. */
authRouter.post(
  '/google',
  authLimiter,
  validate({ body: googleSchema }),
  asyncHandler(async (req, res) => {
    const { user, tokens } = await service.loginWithGoogle(req.body.idToken, contextOf(req));
    res.json({ data: { user: selfUser(user), tokens } });
  }),
);

/** POST /auth/refresh — rotates the refresh token and mints a new access token. */
authRouter.post(
  '/refresh',
  validate({ body: refreshSchema }),
  asyncHandler(async (req, res) => {
    const { user, tokens } = await service.refresh(req.body.refreshToken, contextOf(req));
    res.json({ data: { user: selfUser(user), tokens } });
  }),
);

/** POST /auth/logout — revokes the presented refresh token only. */
authRouter.post(
  '/logout',
  validate({ body: refreshSchema }),
  asyncHandler(async (req, res) => {
    await service.logout(req.body.refreshToken);
    res.json({ data: { success: true } });
  }),
);

/** POST /auth/logout-all — revokes every session for the signed-in account. */
authRouter.post(
  '/logout-all',
  requireAuth,
  asyncHandler(async (req, res) => {
    await service.logoutEverywhere(currentUserId(req));
    res.json({ data: { success: true } });
  }),
);

/** GET /auth/me */
authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ data: { user: selfUser(currentUser(req)) } });
  }),
);

/** POST /auth/forgot-password — emails a 6-digit reset code. */
authRouter.post(
  '/forgot-password',
  emailLimiter,
  validate({ body: forgotPasswordSchema }),
  asyncHandler(async (req, res) => {
    await service.forgotPassword(req.body.email);
    // Deliberately identical whether or not the address exists.
    res.json({
      data: { success: true, message: 'If that address has an account, a reset code is on its way' },
    });
  }),
);

/** POST /auth/reset-password */
authRouter.post(
  '/reset-password',
  authLimiter,
  validate({ body: resetPasswordSchema }),
  asyncHandler(async (req, res) => {
    await service.resetPassword(req.body.email, req.body.otp, req.body.password);
    res.json({ data: { success: true } });
  }),
);

/**
 * GET /auth/verify-email?token=... — the target of the emailed link, so it answers with
 * a small HTML page rather than JSON.
 */
authRouter.get(
  '/verify-email',
  validate({ query: verifyEmailSchema }),
  asyncHandler(async (req, res) => {
    const { token } = validatedQuery<{ token: string }>(req);
    try {
      await service.verifyEmail(token);
    } catch (err) {
      // An expired or reused link is opened in a browser, so it gets a page, not JSON.
      if (!(err instanceof ApiError)) throw err;
      res
        .status(err.status)
        .type('html')
        .send(
          renderPage(
            'Link not valid',
            `<h1>This link didn't work</h1>
             <p>${escapeHtml(err.message)}. If you already verified your email, you're all set.</p>
             <p>Otherwise, open the app and choose <strong>Settings → Resend verification email</strong> for a new link.</p>`,
            env.APP_NAME,
          ),
        );
      return;
    }
    res
      .status(200)
      .type('html')
      .send(
        renderPage(
          'Email verified',
          // skillexchange:// is the app's URL scheme (app.json "scheme").
          `<h1>Your email is verified</h1>
           <p>Thanks. Your account is fully set up, and you can now send learning requests and messages.</p>
           <p><a class="button" href="skillexchange://">Open the app</a></p>
           <p class="muted">If the button does nothing, just switch back to the app.</p>`,
          env.APP_NAME,
        ),
      );
  }),
);

/** POST /auth/resend-verification */
authRouter.post(
  '/resend-verification',
  emailLimiter,
  requireAuth,
  asyncHandler(async (req, res) => {
    await service.resendVerification(currentUser(req));
    res.json({ data: { success: true } });
  }),
);

/** POST /auth/change-password */
authRouter.post(
  '/change-password',
  authLimiter,
  requireAuth,
  validate({ body: changePasswordSchema }),
  asyncHandler(async (req, res) => {
    await service.changePassword(
      currentUserId(req),
      req.body.currentPassword,
      req.body.newPassword,
    );
    res.json({ data: { success: true } });
  }),
);

/** POST /auth/push-token — registers this device for push notifications. */
authRouter.post(
  '/push-token',
  requireAuth,
  validate({ body: pushTokenSchema }),
  asyncHandler(async (req, res) => {
    await registerPushToken(currentUserId(req), req.body.token);
    res.json({ data: { success: true } });
  }),
);

/** DELETE /auth/push-token — called on sign-out so the device stops receiving pushes. */
authRouter.delete(
  '/push-token',
  requireAuth,
  validate({ body: pushTokenSchema }),
  asyncHandler(async (req, res) => {
    await unregisterPushToken(currentUserId(req), req.body.token);
    res.json({ data: { success: true } });
  }),
);
