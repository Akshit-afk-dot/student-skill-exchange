import { Router, type Request, type Response } from 'express';
import { env } from '../../config/env';
import { LEGAL } from '../../config/legal';
import { authLimiter } from '../../middleware';
import { User } from '../../models';
import { asyncHandler } from '../../utils/async';
import { escapeHtml, renderPage } from '../../utils/html';
import { deleteAccount } from '../account/service';
import { sendAccountDeletedEmail } from '../notifications/mail';
import { privacyPolicyHtml, termsHtml } from './legal';

/**
 * Pages the API renders as HTML rather than JSON: the legal documents both app stores
 * link to, and the web route for account deletion that Google Play requires alongside
 * the in-app one.
 */
export const pagesRouter = Router();

const urls = {
  privacy: () => `${env.PUBLIC_URL}/legal/privacy`,
  terms: () => `${env.PUBLIC_URL}/legal/terms`,
  deletion: () => `${env.PUBLIC_URL}/account/delete`,
};

function sendPage(res: Response, status: number, title: string, body: string): void {
  res.status(status).type('html').send(renderPage(title, body, env.APP_NAME));
}

pagesRouter.get('/legal/privacy', (_req, res) => {
  sendPage(res, 200, 'Privacy policy', privacyPolicyHtml(env.APP_NAME, urls.deletion()));
});

pagesRouter.get('/legal/terms', (_req, res) => {
  sendPage(res, 200, 'Terms of use', termsHtml(env.APP_NAME, urls.privacy()));
});

function deletionForm(error?: string, email = ''): string {
  return `
<h1>Delete your account</h1>
<p>The quickest way is in the app: open <strong>Settings → Delete account</strong>.</p>
<p>You can also do it here with your email address and password. This permanently deletes your profile, skills, requests, connections, conversations, sessions, reviews and notifications. It cannot be undone.</p>
<p class="muted">If you sign in with Google, you have no password to enter here: delete your account from the app instead, or email <a href="mailto:${escapeHtml(LEGAL.contactEmail)}">${escapeHtml(LEGAL.contactEmail)}</a> from that address and we will do it for you.</p>
${error ? `<div class="alert" role="alert">${escapeHtml(error)}</div>` : ''}
<form method="post" action="/account/delete">
  <label for="email">Email</label>
  <input id="email" name="email" type="email" autocomplete="username" required value="${escapeHtml(email)}">
  <label for="password">Password</label>
  <input id="password" name="password" type="password" autocomplete="current-password" required>
  <label style="font-weight:400;display:flex;gap:10px;align-items:flex-start">
    <input type="checkbox" name="confirm" value="yes" required style="width:auto;margin-top:6px">
    <span>I understand that this permanently deletes my account and cannot be undone.</span>
  </label>
  <p style="margin-top:20px"><button class="button danger" type="submit">Delete my account</button></p>
</form>
<p class="muted"><a href="${escapeHtml(urls.privacy())}">Privacy policy</a></p>`;
}

pagesRouter.get('/account/delete', (_req, res) => {
  sendPage(res, 200, 'Delete your account', deletionForm());
});

pagesRouter.post(
  '/account/delete',
  authLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (body.confirm !== 'yes') {
      return sendPage(res, 400, 'Delete your account', deletionForm('Tick the box to confirm.', email));
    }

    // One message for every way this can fail, so the form cannot be used to discover
    // which addresses have accounts.
    const failed = (): void =>
      sendPage(
        res,
        400,
        'Delete your account',
        deletionForm('We could not verify that email and password. Check them and try again.', email),
      );

    if (!email || !password) return failed();
    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user?.passwordHash || !(await user.verifyPassword(password))) return failed();

    if (user.role === 'ADMIN') {
      return sendPage(
        res,
        403,
        'Delete your account',
        deletionForm('This account cannot be deleted here. Contact us instead.', email),
      );
    }

    const deleted = await deleteAccount(String(user._id));
    if (deleted) await sendAccountDeletedEmail(deleted.email, deleted.name);

    sendPage(
      res,
      200,
      'Account deleted',
      `<h1>Your account has been deleted</h1>
       <p>Your account and the data linked to it are gone. We have sent a confirmation to your email address.</p>
       <p class="muted">You can uninstall the app. Thank you for being part of ${escapeHtml(env.APP_NAME)}.</p>`,
    );
  }),
);
