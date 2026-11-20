import { env } from '../config/env';
import { logger } from '../config/logger';
import { Skill, SkillCategory, User, hashPassword, skillSlug } from '../models';
import { CATEGORY_META, catalogEntries } from './catalog';

/**
 * Idempotent first-boot setup.
 *
 * Runs on every start. It fills gaps and keeps the skill catalogue in step with
 * `catalog.ts`, so redeploying never duplicates categories or skills and never resets an
 * admin password. Safe to run against a populated database.
 */
export async function ensureSeedData(): Promise<void> {
  await ensureCategories();
  await refreshSkillSlugs();
  await ensureSkills();
  await ensureAdmin();
  await backfillHasPassword();
}

/**
 * Accounts created before `hasPassword` existed have a hash but no flag. Idempotent, and
 * after the first run it matches nothing.
 */
async function backfillHasPassword(): Promise<void> {
  await User.updateMany(
    { passwordHash: { $exists: true }, hasPassword: { $ne: true } },
    { $set: { hasPassword: true } },
  );
}

/**
 * Categories follow `CATEGORY_META`: missing ones are created, and the order and icon of
 * existing ones are brought in line, so a new category can slot in before "Other".
 */
async function ensureCategories(): Promise<void> {
  const now = new Date();
  const result = await SkillCategory.bulkWrite(
    CATEGORY_META.map((meta) => ({
      updateOne: {
        filter: { name: meta.name },
        update: {
          $set: { slug: skillSlug(meta.name), icon: meta.icon, order: meta.order },
          $setOnInsert: { createdAt: now, updatedAt: now },
        },
        upsert: true,
        // Mongoose would otherwise stamp updatedAt on every row at every boot.
        timestamps: false,
      },
    })),
    { ordered: false },
  );
  if (result.upsertedCount > 0) logger.info({ created: result.upsertedCount }, 'Skill categories added');
}

/**
 * Brings stored slugs in line with `skillSlug`. Slugs used to drop symbols, so "C++" was
 * stored as "c", the slug "C" now needs. Must run before the catalogue is applied, or the
 * catalogue's "C" would match the row that holds everyone's C++ and rename it.
 *
 * Only rows whose slug is out of date are touched; after the first run this changes
 * nothing. A row whose new slug is already taken keeps its old one, and still works.
 */
async function refreshSkillSlugs(): Promise<void> {
  const rows = await Skill.find().select('name slug').lean();
  const taken = new Set(rows.map((row) => row.slug));
  let changed = 0;
  for (const row of rows) {
    const slug = skillSlug(row.name);
    if (!slug || slug === row.slug) continue;
    if (taken.has(slug)) {
      logger.warn({ skill: row.name, from: row.slug, to: slug }, 'Skill slug left as is: the new slug is taken');
      continue;
    }
    await Skill.updateOne({ _id: row._id }, { $set: { slug } });
    taken.delete(row.slug);
    taken.add(slug);
    changed += 1;
  }
  if (changed > 0) logger.info({ changed }, 'Skill slugs updated');
}

/**
 * Applies the catalogue in one round trip. Every entry ends up approved, in its listed
 * category and under its listed name, with its aliases added. A student-added skill that
 * the catalogue now lists is adopted in place, so the students who added it keep it.
 * Existing aliases are never removed, and nothing outside the catalogue is touched.
 */
async function ensureSkills(): Promise<void> {
  const categories = await SkillCategory.find().select('name').lean();
  const byName = new Map(categories.map((c) => [c.name, c._id]));

  const now = new Date();
  const ops = catalogEntries().flatMap((entry) => {
    const category = byName.get(entry.category);
    if (!category) return [];
    return [
      {
        updateOne: {
          filter: { slug: skillSlug(entry.name) },
          update: {
            $set: { name: entry.name, category, approved: true, approvedVia: 'CATALOGUE' as const },
            $unset: { rejectedAt: 1 as const, rejectReason: 1 as const },
            $addToSet: { aliases: { $each: entry.aliases } },
            $setOnInsert: { createdAt: now, updatedAt: now },
          },
          upsert: true,
          // Without this Mongoose stamps updatedAt on every row, so every boot would
          // rewrite the whole catalogue. Rows change only when the catalogue does.
          timestamps: false,
        },
      },
    ];
  });

  const result = await Skill.bulkWrite(ops, { ordered: false });
  if (result.upsertedCount > 0 || result.modifiedCount > 0) {
    logger.info({ created: result.upsertedCount, updated: result.modifiedCount }, 'Skill catalogue applied');
  }
}

/**
 * Creates the bootstrap administrator when credentials are supplied and no admin exists.
 *
 * Deliberately does nothing if an admin is already present: the env vars are a
 * first-run convenience, not a mechanism for silently resetting a live account.
 */
async function ensureAdmin(): Promise<void> {
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) return;

  const existingAdmin = await User.findOne({ role: 'ADMIN' }).select('_id').lean();
  if (existingAdmin) return;

  if (env.ADMIN_PASSWORD.length < 8) {
    logger.error('ADMIN_PASSWORD must be at least 8 characters — skipping admin bootstrap');
    return;
  }

  const clash = await User.findOne({ email: env.ADMIN_EMAIL.toLowerCase() });
  if (clash) {
    clash.role = 'ADMIN';
    await clash.save();
    logger.info({ email: clash.email }, 'Existing account promoted to administrator');
    return;
  }

  await User.create({
    name: 'Administrator',
    email: env.ADMIN_EMAIL.toLowerCase(),
    passwordHash: await hashPassword(env.ADMIN_PASSWORD),
    role: 'ADMIN',
    emailVerified: true,
  });

  logger.info({ email: env.ADMIN_EMAIL }, 'Bootstrap administrator created');
}
