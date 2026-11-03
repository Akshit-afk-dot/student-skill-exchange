import nodemailer, { type Transporter } from 'nodemailer';
import { env, mailEnabled } from '../../config/env';
import { logger } from '../../config/logger';
import { escapeHtml } from '../../utils/html';

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!mailEnabled) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
      // Hosts that block SMTP ports hang rather than refuse, and the default wait is minutes.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }
  return transporter;
}

export interface MailPayload {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Sends mail when SMTP is configured, and logs it otherwise.
 *
 * Falling back to a log rather than throwing means a fresh clone can complete the
 * signup and password-reset flows end to end with no third-party account — the
 * verification link simply appears in the server output.
 */
export async function sendMail(payload: MailPayload): Promise<void> {
  const tx = getTransporter();
  if (!tx) {
    logger.info(
      { to: payload.to, subject: payload.subject, body: payload.text },
      'SMTP not configured — email written to log instead of sent',
    );
    return;
  }
  try {
    await tx.sendMail({ from: env.MAIL_FROM, ...payload });
  } catch (err) {
    // A failed welcome email must not fail the registration that triggered it.
    logger.error({ err, to: payload.to }, 'Failed to send email');
  }
}

let deliverable = false;

/** Whether the last connection check reached the SMTP server. */
export function mailDeliverable(): boolean {
  return deliverable;
}

/**
 * Checks the SMTP connection. Run at boot and periodically, because configured is not the
 * same as working: Render's free tier blocks ports 25, 465 and 587, and enforcing email
 * verification with no mail getting through would lock out every new student.
 */
export async function checkMailTransport(): Promise<void> {
  const tx = getTransporter();
  if (!tx) return;
  try {
    await tx.verify();
    deliverable = true;
  } catch (err) {
    deliverable = false;
    logger.error({ err }, 'SMTP is configured but unreachable; email verification is not being enforced');
  }
}

/**
 * Connects to the SMTP server and sends one message, throwing on any failure.
 *
 * `sendMail` deliberately swallows errors so a mail outage cannot break signups; this
 * is its opposite, for `npm run mail:test`, where a silent failure is the bug.
 */
export async function sendTestMail(to: string): Promise<void> {
  const tx = getTransporter();
  if (!tx) throw new Error('SMTP is not configured: set SMTP_HOST and SMTP_PORT');
  await tx.verify();
  await tx.sendMail({
    from: env.MAIL_FROM,
    to,
    subject: `${env.APP_NAME}: test email`,
    text: 'If you can read this, outgoing email is working.',
    html: layout('Email is working', '<p>If you can read this, outgoing email is working.</p>'),
  });
}

/** Builds the shared email chrome. `title` is escaped; `bodyHtml` must already be safe. */
function layout(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#f6f7f9;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;color:#14151a">
    <p style="margin:0 0 18px;font-weight:700;color:#4f46e5">${escapeHtml(env.APP_NAME)}</p>
    <h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(title)}</h1>
    ${bodyHtml}
    <p style="color:#7a7a85;font-size:12px;margin-top:28px;border-top:1px solid #e2e4e9;padding-top:14px">
      You received this because of an account on ${escapeHtml(env.APP_NAME)}.
    </p>
  </div></body></html>`;
}

function button(href: string, label: string): string {
  return `<p><a href="${escapeHtml(href)}" style="display:inline-block;background:#4f46e5;color:#fff;padding:11px 20px;border-radius:8px;text-decoration:none;font-weight:600">${escapeHtml(label)}</a></p>`;
}

export function buildVerificationEmail(name: string, token: string): Omit<MailPayload, 'to'> {
  const link = `${env.PUBLIC_URL}/api/v1/auth/verify-email?token=${encodeURIComponent(token)}`;
  return {
    subject: `Verify your ${env.APP_NAME} account`,
    text: `Hi ${name},\n\nConfirm your email address to finish setting up your account:\n${link}\n\nThe link expires in 24 hours. If you did not create this account, you can ignore this email.`,
    html: layout(
      `Welcome, ${name}`,
      `<p>Confirm your email address to finish setting up your account.</p>
       ${button(link, 'Verify email')}
       <p style="color:#7a7a85;font-size:13px">The link expires in 24 hours. If you did not create this account, you can ignore this email.</p>`,
    ),
  };
}

export function buildPasswordResetEmail(name: string, code: string): Omit<MailPayload, 'to'> {
  return {
    subject: `Reset your ${env.APP_NAME} password`,
    text: `Hi ${name},\n\nUse this code to reset your password: ${code}\n\nIt expires in 30 minutes. If you did not request this, you can ignore this email.`,
    html: layout(
      'Reset your password',
      `<p>Hi ${escapeHtml(name)}, use this code to reset your password:</p>
       <p style="font-size:28px;letter-spacing:6px;font-weight:700;margin:18px 0">${escapeHtml(code)}</p>
       <p style="color:#7a7a85;font-size:13px">It expires in 30 minutes. If you did not request this, you can ignore this email.</p>`,
    ),
  };
}

export function buildAccountDeletedEmail(name: string): Omit<MailPayload, 'to'> {
  return {
    subject: `Your ${env.APP_NAME} account has been deleted`,
    text: `Hi ${name},\n\nYour account and the data linked to it have been deleted, as you asked. You will not receive any more emails from us.\n\nIf you did not ask for this, reply to this email straight away.`,
    html: layout(
      'Your account has been deleted',
      `<p>Hi ${escapeHtml(name)}, your account and the data linked to it have been deleted, as you asked. You will not receive any more emails from us.</p>
       <p style="color:#7a7a85;font-size:13px">If you did not ask for this, reply to this email straight away.</p>`,
    ),
  };
}

export async function sendVerificationEmail(to: string, name: string, token: string): Promise<void> {
  await sendMail({ to, ...buildVerificationEmail(name, token) });
}

export async function sendPasswordResetEmail(to: string, name: string, code: string): Promise<void> {
  await sendMail({ to, ...buildPasswordResetEmail(name, code) });
}

export async function sendAccountDeletedEmail(to: string, name: string): Promise<void> {
  await sendMail({ to, ...buildAccountDeletedEmail(name) });
}
