/**
 * Sends one email using the SMTP settings in server/.env, to prove they work before
 * they go anywhere near production.
 *
 *   npm run mail:test -- you@example.com
 *
 * Unlike the app's own sending, this fails loudly: a wrong password or blocked port is
 * exactly what it exists to surface.
 */
import { env, mailEnabled } from '../config/env';
import { sendTestMail } from '../modules/notifications/mail';

async function main(): Promise<void> {
  const to = process.argv[2];
  if (!to) {
    console.error('Usage: npm run mail:test -- you@example.com');
    process.exit(1);
  }
  if (!mailEnabled) {
    console.error(
      'SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and MAIL_FROM in server/.env.',
    );
    process.exit(1);
  }

  console.log(`Sending a test email to ${to} via ${env.SMTP_HOST}:${env.SMTP_PORT}, from ${env.MAIL_FROM}`);
  await sendTestMail(to);
  console.log('Sent. Check the inbox, and the spam folder if it is not there within a minute.');
}

main().catch((err: unknown) => {
  console.error('Failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
