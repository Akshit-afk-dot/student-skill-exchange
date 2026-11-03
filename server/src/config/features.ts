import { mailEnabled } from './env';

/**
 * Whether students must verify their email before sending requests and messages.
 *
 * Tied to mail being configured: without SMTP no verification email can arrive, so
 * enforcing it would lock every new student out. Kept as a function so tests can
 * switch it on without a mail server.
 */
export function emailVerificationRequired(): boolean {
  return mailEnabled;
}
