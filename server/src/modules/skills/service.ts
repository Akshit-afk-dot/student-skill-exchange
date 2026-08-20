import { Types } from 'mongoose';
import {
  Skill,
  SkillCategory,
  UserSkill,
  skillSlug,
  type ISkill,
  type SkillDoc,
} from '../../models';
import type { SkillLevel, UserSkillType } from '../../types/domain';
import { ApiError } from '../../utils/errors';
import { paginate, type Paginated } from '../../utils/pagination';

export interface SkillView {
  id: string;
  name: string;
  slug: string;
  category: { id: string; name: string } | null;
  description?: string;
  approved: boolean;
  teachCount: number;
  learnCount: number;
  createdAt: string;
}

type PopulatedCategory = { _id: Types.ObjectId; name: string };

/** A skill row whose `category` may or may not have been populated by the caller. */
type SkillRow = Omit<ISkill, 'category'> & {
  _id: Types.ObjectId;
  category: Types.ObjectId | PopulatedCategory;
};

function toView(skill: SkillRow): SkillView {
  const raw = skill.category as unknown;
  const category =
    raw && typeof raw === 'object' && 'name' in raw
      ? { id: String((raw as PopulatedCategory)._id), name: (raw as PopulatedCategory).name }
      : null;

  const view: SkillView = {
    id: String(skill._id),
    name: skill.name,
    slug: skill.slug,
    category,
    approved: skill.approved,
    teachCount: skill.teachCount,
    learnCount: skill.learnCount,
    createdAt: new Date(skill.createdAt).toISOString(),
  };
  if (skill.description) view.description = skill.description;
  return view;
}

export async function listCategories(): Promise<Array<{ id: string; name: string; slug: string; icon?: string }>> {
  const categories = await SkillCategory.find().sort({ order: 1, name: 1 }).lean();
  return categories.map((c) => {
    const out: { id: string; name: string; slug: string; icon?: string } = {
      id: String(c._id),
      name: c.name,
      slug: c.slug,
    };
    if (c.icon) out.icon = c.icon;
    return out;
  });
}

export interface SearchSkillsInput {
  q?: string;
  category?: string;
  page: number;
  limit: number;
}

export async function searchSkills(input: SearchSkillsInput): Promise<Paginated<SkillView>> {
  const filter: Record<string, unknown> = {};
  if (input.category) filter.category = new Types.ObjectId(input.category);
  if (input.q) {
    // Prefix-anchored so typing "pyt" surfaces "Python": a text index would only match
    // whole terms, which is wrong for an as-you-type picker.
    const rx = new RegExp(`^${input.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
    filter.$or = [{ name: rx }, { aliases: rx }];
  }

  const skip = (input.page - 1) * input.limit;
  const [rows, total] = await Promise.all([
    Skill.find(filter)
      .populate<{ category: PopulatedCategory }>('category', 'name')
      .sort({ teachCount: -1, name: 1 })
      .skip(skip)
      .limit(input.limit)
      .lean(),
    Skill.countDocuments(filter),
  ]);

  return paginate(rows.map(toView), total, { page: input.page, limit: input.limit });
}

export async function popularSkills(limit = 10): Promise<{
  mostTaught: SkillView[];
  mostWanted: SkillView[];
}> {
  const [mostTaught, mostWanted] = await Promise.all([
    Skill.find({ teachCount: { $gt: 0 } })
      .populate<{ category: PopulatedCategory }>('category', 'name')
      .sort({ teachCount: -1 })
      .limit(limit)
      .lean(),
    Skill.find({ learnCount: { $gt: 0 } })
      .populate<{ category: PopulatedCategory }>('category', 'name')
      .sort({ learnCount: -1 })
      .limit(limit)
      .lean(),
  ]);
  return { mostTaught: mostTaught.map(toView), mostWanted: mostWanted.map(toView) };
}

/**
 * Finds an existing skill by canonical slug or creates it.
 *
 * Students may introduce skills the catalogue does not have yet — blocking that would
 * make the app useless for anything niche. New entries are flagged unapproved so an
 * admin can merge duplicates later, but remain immediately usable.
 */
export async function findOrCreateSkill(
  name: string,
  categoryId: string,
  createdBy?: string,
): Promise<SkillDoc> {
  const slug = skillSlug(name);
  if (!slug) throw ApiError.badRequest('Skill name must contain letters or numbers');

  const existing = await Skill.findOne({ slug });
  if (existing) return existing;

  const category = await SkillCategory.findById(categoryId);
  if (!category) throw ApiError.badRequest('Unknown skill category');

  try {
    return await Skill.create({
      name: name.trim(),
      slug,
      category: category._id,
      approved: false,
      createdBy,
    });
  } catch (err) {
    // Two students can propose the same skill concurrently; the unique slug index
    // catches the loser, which then reads the winner's row.
    const raced = await Skill.findOne({ slug });
    if (raced) return raced;
    throw err;
  }
}

export interface AddUserSkillInput {
  skillId?: string;
  skillName?: string;
  categoryId?: string;
  type: UserSkillType;
  level: SkillLevel;
  yearsOfExperience?: number;
  description?: string;
  priority?: number;
}

const counterField = (type: UserSkillType) => (type === 'TEACH' ? 'teachCount' : 'learnCount');

export async function addUserSkill(userId: string, input: AddUserSkillInput) {
  let skill: SkillDoc | null = null;

  if (input.skillId) {
    skill = await Skill.findById(input.skillId);
    if (!skill) throw ApiError.notFound('Skill not found');
  } else if (input.skillName && input.categoryId) {
    skill = await findOrCreateSkill(input.skillName, input.categoryId, userId);
  } else {
    throw ApiError.badRequest('Provide either skillId, or skillName together with categoryId');
  }

  const existing = await UserSkill.findOne({ user: userId, skill: skill._id, type: input.type });
  if (existing) {
    throw ApiError.conflict(
      `${skill.name} is already on your ${input.type === 'TEACH' ? 'teaching' : 'learning'} list`,
    );
  }

  const created = await UserSkill.create({
    user: userId,
    skill: skill._id,
    type: input.type,
    level: input.level,
    yearsOfExperience: input.yearsOfExperience,
    description: input.description,
    priority: input.priority ?? 1,
  });

  await Skill.updateOne({ _id: skill._id }, { $inc: { [counterField(input.type)]: 1 } });

  return created.populate('skill', 'name category slug');
}

export async function updateUserSkill(
  userId: string,
  userSkillId: string,
  patch: { level?: SkillLevel; yearsOfExperience?: number; description?: string; priority?: number },
) {
  const doc = await UserSkill.findOne({ _id: userSkillId, user: userId });
  if (!doc) throw ApiError.notFound('Skill entry not found');

  if (patch.level !== undefined) doc.level = patch.level;
  if (patch.yearsOfExperience !== undefined) doc.yearsOfExperience = patch.yearsOfExperience;
  if (patch.description !== undefined) doc.description = patch.description;
  if (patch.priority !== undefined) doc.priority = patch.priority;

  await doc.save();
  return doc.populate('skill', 'name category slug');
}

export async function removeUserSkill(userId: string, userSkillId: string): Promise<void> {
  const doc = await UserSkill.findOneAndDelete({ _id: userSkillId, user: userId });
  if (!doc) throw ApiError.notFound('Skill entry not found');

  // Keep the denormalised counters honest, without letting them go negative if a
  // decrement ever runs twice.
  await Skill.updateOne(
    { _id: doc.skill, [counterField(doc.type)]: { $gt: 0 } },
    { $inc: { [counterField(doc.type)]: -1 } },
  );
}

export async function listUserSkills(userId: string) {
  return UserSkill.find({ user: userId })
    .populate<{ skill: { _id: Types.ObjectId; name: string; slug: string } }>(
      'skill',
      'name slug category',
    )
    .sort({ type: 1, priority: -1, createdAt: 1 })
    .lean();
}
