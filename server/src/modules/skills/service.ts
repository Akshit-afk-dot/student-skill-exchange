import { Types } from 'mongoose';
import {
  Skill,
  SkillCategory,
  UserSkill,
  skillMatchKey,
  skillSlug,
  type ISkill,
  type SkillDoc,
} from '../../models';
import type { SkillLevel, UserSkillType } from '../../types/domain';
import { ApiError } from '../../utils/errors';
import { paginate, type Paginated } from '../../utils/pagination';
import { assessSkillName, tidySkillName, type NameProblem } from './quality';

/**
 * How many different students must list a new skill before it joins the shared catalogue
 * without an admin. Three people independently typing the same name is good evidence it
 * is a real skill; one or two could be a joke between friends.
 */
export const COMMUNITY_APPROVAL_STUDENTS = 3;

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

/**
 * Searches the shared catalogue. Skills still in review are left out: a student who added
 * one has it on their own list, but nobody else is offered it until it is approved. Admins
 * review those through `/admin/skills`.
 */
export async function searchSkills(input: SearchSkillsInput): Promise<Paginated<SkillView>> {
  const filter: Record<string, unknown> = { approved: true };
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
    Skill.find({ approved: true, teachCount: { $gt: 0 } })
      .populate<{ category: PopulatedCategory }>('category', 'name')
      .sort({ teachCount: -1 })
      .limit(limit)
      .lean(),
    Skill.find({ approved: true, learnCount: { $gt: 0 } })
      .populate<{ category: PopulatedCategory }>('category', 'name')
      .sort({ learnCount: -1 })
      .limit(limit)
      .lean(),
  ]);
  return { mostTaught: mostTaught.map(toView), mostWanted: mostWanted.map(toView) };
}

/* ---------- New skills: the catalogue checks ---------- */

/**
 * The verdict on a name a student wants to add, from `checkSkillName`:
 *
 * - `EXISTING`: it already is a catalogue skill, by name or alias ("JS" is JavaScript).
 * - `SUGGESTION`: probably a catalogue skill: a typo of one (`TYPO`, "Pyhton"), or a
 *   narrower wording of one (`BROADER`, "Advanced Excel", where the level says "advanced").
 *   The student can still keep their own name.
 * - `NEW`: it can be added. `name` is the tidied name it will get, and `students` how many
 *   have already added it while it waits for review.
 * - `INVALID`: it cannot be added, with a message saying why.
 */
export type SkillNameCheck =
  | { status: 'EXISTING'; skill: SkillView }
  | { status: 'SUGGESTION'; name: string; kind: 'TYPO' | 'BROADER'; suggestion: SkillView }
  | { status: 'NEW'; name: string; students: number }
  | { status: 'INVALID'; problem: NameProblem | 'REMOVED'; message: string };

/** Words that narrow a skill without making it a different one. */
const LEADING_MODIFIERS = [
  'introduction to', 'intro to', 'fundamentals of', 'basics of', 'basic', 'beginner',
  'beginners', 'intermediate', 'advanced', 'professional', 'practical',
].map((m) => m.split(' '));
const TRAILING_MODIFIERS = [
  'for beginners', 'for kids', 'basics', 'fundamentals', 'classes', 'class', 'lessons',
  'lesson', 'tutoring', 'tuition', 'coaching', 'course', 'training', 'skills', 'skill',
  'programming', 'language', 'playing', 'development', 'practice', 'tips',
].map((m) => m.split(' '));

/** The name with those modifiers removed ("Advanced Excel" → "excel"), or null if it had none. */
function withoutModifiers(name: string): string | null {
  let words = name.toLowerCase().split(/\s+/);
  let stripped = false;
  for (let changed = true; changed && words.length > 1; ) {
    changed = false;
    for (const parts of LEADING_MODIFIERS) {
      if (words.length > parts.length && parts.every((part, i) => words[i] === part)) {
        words = words.slice(parts.length);
        changed = stripped = true;
      }
    }
    for (const parts of TRAILING_MODIFIERS) {
      const start = words.length - parts.length;
      if (start > 0 && parts.every((part, i) => words[start + i] === part)) {
        words = words.slice(0, start);
        changed = stripped = true;
      }
    }
  }
  return stripped ? words.join(' ') : null;
}

/**
 * Edit distance, counting a swap of two neighbouring letters as one edit ("Pyhton" is one
 * edit from "Python"). Stops early once the answer exceeds `max`.
 */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, d[i - 2]![j - 2]! + 1);
      }
      d[i]![j] = value;
      rowMin = Math.min(rowMin, value);
    }
    if (rowMin > max) return max + 1;
  }
  return d[a.length]![b.length]!;
}

interface IndexedSkill {
  view: SkillView;
  /** Match keys of the name and every alias. */
  keys: string[];
  popularity: number;
}

/** Every approved skill with its match keys. A few hundred small rows, read per check. */
async function catalogueIndex(): Promise<IndexedSkill[]> {
  const [rows, categories] = await Promise.all([
    Skill.find({ approved: true })
      .select('name slug category description aliases approved teachCount learnCount createdAt')
      .lean(),
    SkillCategory.find().select('name').lean(),
  ]);
  const categoryById = new Map(categories.map((c) => [String(c._id), { _id: c._id, name: c.name }]));
  return rows.map((row) => ({
    view: toView({ ...row, category: categoryById.get(String(row.category)) ?? row.category }),
    keys: [...new Set([row.name, ...row.aliases].map(skillMatchKey))].filter(Boolean),
    popularity: row.teachCount + row.learnCount,
  }));
}

/**
 * The catalogue skill a key is most likely a typo of: one edit away for keys of five
 * letters or more, two for nine or more, and starting with the same letter (typos rarely
 * hit the first one). Shorter names are too close to each other to guess at ("Ruby",
 * "Rugby"). Ties go to the more popular skill.
 */
function closestSkill(index: IndexedSkill[], key: string): IndexedSkill | undefined {
  const allowed = key.length >= 9 ? 2 : key.length >= 5 ? 1 : 0;
  if (allowed === 0) return undefined;
  let best: IndexedSkill | undefined;
  let bestDistance = allowed + 1;
  for (const skill of index) {
    for (const candidate of skill.keys) {
      if (candidate.length < 5 || candidate[0] !== key[0]) continue;
      const distance = editDistance(key, candidate, allowed);
      if (distance < bestDistance || (distance === bestDistance && best && skill.popularity > best.popularity)) {
        best = skill;
        bestDistance = distance;
      }
    }
  }
  return best;
}

/**
 * Checks a name a student wants to add, against the rules for names and then against the
 * catalogue. See `SkillNameCheck` for the verdicts, and `quality.ts` for the rules.
 *
 * `allowSimilar` is the student saying "no, I really mean this": it skips the suggestion,
 * but never the rules.
 */
export async function checkSkillName(
  raw: string,
  options: { allowSimilar?: boolean } = {},
): Promise<SkillNameCheck> {
  const index = await catalogueIndex();

  // Already in the catalogue, under this name or an alias. Checked before the rules so a
  // curated short name ("C", "R") is never refused.
  const key = skillMatchKey(tidySkillName(raw));
  const existing = key ? index.find((skill) => skill.keys.includes(key)) : undefined;
  if (existing) return { status: 'EXISTING', skill: existing.view };

  const verdict = assessSkillName(raw);
  if (!verdict.ok) return { status: 'INVALID', problem: verdict.problem, message: verdict.message };
  const { name } = verdict;

  const known = await Skill.findOne({ slug: skillSlug(name) }).select('name rejectedAt').lean();
  if (known?.rejectedAt) {
    return {
      status: 'INVALID',
      problem: 'REMOVED',
      message: 'Moderators removed this skill from the app, so it can\'t be added again.',
    };
  }

  if (!options.allowSimilar) {
    const base = withoutModifiers(name);
    const baseKey = base ? skillMatchKey(base) : '';
    const broader = baseKey ? index.find((skill) => skill.keys.includes(baseKey)) : undefined;
    if (broader) return { status: 'SUGGESTION', name, kind: 'BROADER', suggestion: broader.view };

    const typo = closestSkill(index, key) ?? (baseKey ? closestSkill(index, baseKey) : undefined);
    if (typo) return { status: 'SUGGESTION', name, kind: 'TYPO', suggestion: typo.view };
  }

  // Other students may already have added it and be waiting on review.
  if (known) {
    const students = (await UserSkill.distinct('user', { skill: known._id })).length;
    return { status: 'NEW', name: known.name, students };
  }
  return { status: 'NEW', name, students: 0 };
}

/**
 * The skill a student's typed name stands for, creating it if it is new.
 *
 * Students may add skills the catalogue does not have: refusing would make the app
 * useless for anything niche. A new skill must pass `checkSkillName`, and starts unapproved:
 * usable by the students who list it, hidden from everyone else until it is approved.
 */
export async function findOrCreateSkill(
  rawName: string,
  categoryId: string,
  createdBy?: string,
  options: { allowSimilar?: boolean } = {},
): Promise<SkillDoc> {
  const check = await checkSkillName(rawName, options);

  if (check.status === 'INVALID') {
    throw new ApiError(422, 'SKILL_NAME_REJECTED', check.message, { skillName: check.message });
  }
  if (check.status === 'SUGGESTION') {
    const suggested = check.suggestion.name;
    const message =
      check.kind === 'BROADER'
        ? `"${suggested}" is already a skill. Pick it from the list and set your level instead.`
        : `Did you mean "${suggested}"? Pick it from the list instead.`;
    throw new ApiError(409, 'SKILL_SUGGESTION', message, {
      skillName: message,
      suggestionId: check.suggestion.id,
      suggestionName: suggested,
    });
  }
  if (check.status === 'EXISTING') {
    const found = await Skill.findById(check.skill.id);
    if (!found) throw ApiError.notFound('Skill not found');
    return found;
  }

  const slug = skillSlug(check.name);
  const pending = await Skill.findOne({ slug });
  if (pending) return pending;

  const category = await SkillCategory.findById(categoryId);
  if (!category) throw ApiError.badRequest('Unknown skill category');

  try {
    return await Skill.create({
      name: check.name,
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
  /** The student keeps their own name after being offered a similar catalogue skill. */
  allowSimilar?: boolean;
}

const counterField = (type: UserSkillType) => (type === 'TEACH' ? 'teachCount' : 'learnCount');

export async function addUserSkill(userId: string, input: AddUserSkillInput) {
  let skill: SkillDoc;

  if (input.skillId) {
    const found = await Skill.findById(input.skillId);
    if (!found || found.rejectedAt) throw ApiError.notFound('Skill not found');
    skill = found;
  } else if (input.skillName && input.categoryId) {
    skill = await findOrCreateSkill(input.skillName, input.categoryId, userId, {
      allowSimilar: input.allowSimilar ?? false,
    });
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
  if (!skill.approved) await approveIfEndorsed(skill._id);

  return created.populate('skill', 'name category slug approved');
}

/**
 * Approves a skill in review once enough different students list it (teaching or
 * learning), so a genuinely popular new skill joins the catalogue without waiting on an
 * admin. A skill moderators removed is never brought back this way.
 */
async function approveIfEndorsed(skillId: Types.ObjectId): Promise<void> {
  const students = await UserSkill.distinct('user', { skill: skillId });
  if (students.length < COMMUNITY_APPROVAL_STUDENTS) return;
  await Skill.updateOne(
    { _id: skillId, approved: false, rejectedAt: null },
    { $set: { approved: true, approvedVia: 'COMMUNITY' } },
  );
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
  return doc.populate('skill', 'name category slug approved');
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
    .populate<{ skill: { _id: Types.ObjectId; name: string; slug: string; approved: boolean } }>(
      'skill',
      'name slug category approved',
    )
    .sort({ type: 1, priority: -1, createdAt: 1 })
    .lean();
}
