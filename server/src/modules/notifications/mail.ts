import nodemailer, { type Transporter } from 'nodemailer';
import { env, mailEnabled } from '../../config/env';
import { logger } from '../../config/logger';

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!mailEnabled) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
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

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#f6f7f9;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:28px">
    <h1 style="font-size:18px;margin:0 0 16px">${title}</h1>
    ${bodyHtml}
    <p style="color:#7a7a85;font-size:12px;margin-top:28px">${env.APP_NAME}</p>
  </div></body></html>`;
}

export async function sendVerificationEmail(to: string, name: string, token: string): Promise<void> {
  const link = `${env.PUBLIC_URL}/api/v1/auth/verify-email?token=${token}`;
  await sendMail({
    to,
    subject: `Verify your ${env.APP_NAME} account`,
    text: `Hi ${name},\n\nConfirm your email address to finish setting up your account:\n${link}\n\nThe link expires in 24 hours.`,
    html: layout(
      `Welcome, ${name}`,
      `<p>Confirm your email address to finish setting up your account.</p>
       <p><a href="${link}" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">Verify email</a></p>
       <p style="color:#7a7a85;font-size:13px">The link expires in 24 hours.</p>`,
    ),
  });
}

export async function sendPasswordResetEmail(
  to: string,
  name: string,
  token: string,
): Promise<void> {
  await sendMail({
    to,
    subject: `Reset your ${env.APP_NAME} password`,
    text: `Hi ${name},\n\nUse this code to reset your password: ${token}\n\nIt expires in 30 minutes. If you did not request this, you can ignore this email.`,
    html: layout(
      'Reset your password',
      `<p>Use this code to reset your password:</p>
       <p style="font-size:26px;letter-spacing:5px;font-weight:600">${token}</p>
       <p style="color:#7a7a85;font-size:13px">It expires in 30 minutes. If you did not request this, you can ignore this email.</p>`,
    ),
  });
}
