import { mailEnabled } from './env';
import { mailDeliverable } from '../modules/notifications/mail';

/**
 * Whether students must verify their email before sending requests and messages.
 *
 * Only while mail is configured and actually reaching the SMTP server: otherwise no
 * verification email could arrive, and enforcing it would lock every new student out.
 * Kept as a function so tests can switch it on without a mail server.
 */
export function emailVerificationRequired(): boolean {
  return mailEnabled && mailDeliverable();
}
