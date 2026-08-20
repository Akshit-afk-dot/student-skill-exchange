import { env } from '../config/env';
import { logger } from '../config/logger';
import { Skill, SkillCategory, User, hashPassword, skillSlug } from '../models';
import { CATEGORY_META, SKILL_CATALOG } from './catalog';

/**
 * Idempotent first-boot setup.
 *
 * Runs on every start and only fills gaps, so redeploying never duplicates categories
 * or resets an admin password. Safe to run against a populated database.
 */
export async function ensureSeedData(): Promise<void> {
  await ensureCategories();
  await ensureSkills();
  await ensureAdmin();
}

async function ensureCategories(): Promise<void> {
  const existing = await SkillCategory.countDocuments();
  if (existing >= CATEGORY_META.length) return;

  for (const meta of CATEGORY_META) {
    await SkillCategory.updateOne(
      { name: meta.name },
      {
        $setOnInsert: {
          name: meta.name,
          slug: meta.name.toLowerCase(),
          icon: meta.icon,
          order: meta.order,
        },
      },
      { upsert: true },
    );
  }
  logger.info({ count: CATEGORY_META.length }, 'Skill categories ensured');
}

async function ensureSkills(): Promise<void> {
  const categories = await SkillCategory.find().lean();
  const byName = new Map(categories.map((c) => [c.name, c._id]));

  let created = 0;
  for (const [categoryName, skills] of Object.entries(SKILL_CATALOG)) {
    const categoryId = byName.get(categoryName as keyof typeof SKILL_CATALOG);
    if (!categoryId) continue;

    for (const name of skills) {
      const result = await Skill.updateOne(
        { slug: skillSlug(name) },
        {
          $setOnInsert: {
            name,
            slug: skillSlug(name),
            category: categoryId,
            approved: true,
          },
        },
        { upsert: true },
      );
      if (result.upsertedCount > 0) created += 1;
    }
  }

  if (created > 0) logger.info({ created }, 'Catalogue skills seeded');
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
