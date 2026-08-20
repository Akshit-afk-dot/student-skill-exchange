import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

/**
 * Comma-separated list -> trimmed string array. Empty string yields [].
 */
const csv = z
  .string()
  .default('')
  .transform((v) =>
    v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );

const bool = z
  .string()
  .default('false')
  .transform((v) => ['1', 'true', 'yes', 'on'].includes(v.toLowerCase()));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  APP_NAME: z.string().default('Student Skill Exchange'),
  /** Public base URL of this API, used to build absolute links in emails. */
  PUBLIC_URL: z.string().default('http://localhost:4000'),

  MONGO_URI: z.string().default('mongodb://127.0.0.1:27017/student-skill-exchange'),

  JWT_ACCESS_SECRET: z.string().min(1).default('dev-access-secret-change-me'),
  JWT_REFRESH_SECRET: z.string().min(1).default('dev-refresh-secret-change-me'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

  /** Allowed browser origins for the admin dashboard. Mobile apps send no Origin. */
  CORS_ORIGINS: csv,

  BCRYPT_ROUNDS: z.coerce.number().int().min(8).max(15).default(12),

  /** Matching weights. Must sum to 1 (validated below). */
  MATCH_W_SKILL: z.coerce.number().min(0).max(1).default(0.4),
  MATCH_W_AVAILABILITY: z.coerce.number().min(0).max(1).default(0.2),
  MATCH_W_EXPERIENCE: z.coerce.number().min(0).max(1).default(0.15),
  MATCH_W_RATING: z.coerce.number().min(0).max(1).default(0.15),
  MATCH_W_LOCATION: z.coerce.number().min(0).max(1).default(0.1),
  /** Multiplier applied to skill compatibility when the exchange runs both ways. */
  MATCH_EXCHANGE_BONUS: z.coerce.number().min(1).max(2).default(1.25),
  /** Beyond this distance (km) a location score decays to 0. */
  MATCH_MAX_DISTANCE_KM: z.coerce.number().positive().default(50),

  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  /** Directory used by the local-disk storage driver when Cloudinary is absent. */
  UPLOAD_DIR: z.string().default('uploads'),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(5),

  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),

  GOOGLE_CLIENT_IDS: csv,

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_SECURE: bool,
  MAIL_FROM: z.string().default('Student Skill Exchange <no-reply@example.com>'),

  /** Seeded on first boot so the admin dashboard is reachable. */
  ADMIN_EMAIL: z.string().optional(),
  ADMIN_PASSWORD: z.string().optional(),

  /** Disable background cron (used by tests). */
  ENABLE_JOBS: z.string().default('true').transform((v) => v !== 'false'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const detail = parsed.error.issues
    .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('\n');
  throw new Error(`Invalid environment configuration:\n${detail}`);
}

export const env = parsed.data;

export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

/**
 * The five weights are documented as percentages in the project spec, so they are
 * configurable — but a set that does not sum to 1 silently rescales every score and
 * makes results incomparable between deployments. Fail loudly instead.
 */
const weightSum =
  env.MATCH_W_SKILL +
  env.MATCH_W_AVAILABILITY +
  env.MATCH_W_EXPERIENCE +
  env.MATCH_W_RATING +
  env.MATCH_W_LOCATION;

if (Math.abs(weightSum - 1) > 1e-6) {
  throw new Error(
    `Matching weights must sum to 1.0, got ${weightSum.toFixed(4)}. ` +
      'Check MATCH_W_SKILL / _AVAILABILITY / _EXPERIENCE / _RATING / _LOCATION.',
  );
}

/**
 * Secrets have working defaults so `npm run dev` works on a fresh clone, but shipping
 * those defaults to production would let anyone mint a valid token.
 */
if (isProd) {
  const weak: string[] = [];
  if (env.JWT_ACCESS_SECRET.startsWith('dev-')) weak.push('JWT_ACCESS_SECRET');
  if (env.JWT_REFRESH_SECRET.startsWith('dev-')) weak.push('JWT_REFRESH_SECRET');
  if (env.JWT_ACCESS_SECRET.length < 32) weak.push('JWT_ACCESS_SECRET (min 32 chars)');
  if (env.JWT_REFRESH_SECRET.length < 32) weak.push('JWT_REFRESH_SECRET (min 32 chars)');
  if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
    weak.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ');
  }
  if (weak.length) {
    throw new Error(`Refusing to start in production with insecure secrets: ${weak.join(', ')}`);
  }
}

export const storageDriver: 'cloudinary' | 'local' =
  env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET
    ? 'cloudinary'
    : 'local';

export const pushEnabled = Boolean(
  env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY,
);

export const mailEnabled = Boolean(env.SMTP_HOST && env.SMTP_PORT);

export const googleAuthEnabled = env.GOOGLE_CLIENT_IDS.length > 0;
