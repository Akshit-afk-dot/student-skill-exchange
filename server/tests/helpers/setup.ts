/**
 * Runs before every test file. Pins the environment so `src/config/env.ts` validates
 * successfully without a .env file present, and so tests never touch a real service.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-value-that-is-long-enough';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-value-that-is-long-enough';
process.env.ENABLE_JOBS = 'false';
process.env.LOG_LEVEL = 'silent';
// bcrypt at 12 rounds costs ~250ms per hash; the tests do not need that margin.
process.env.BCRYPT_ROUNDS = '8';
// Tests never send real email, whatever server/.env says. This also keeps the email
// verification requirement (which follows SMTP) off unless a test switches it on.
process.env.SMTP_HOST = '';
