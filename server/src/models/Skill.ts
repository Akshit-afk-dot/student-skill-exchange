import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { SKILL_CATEGORIES, type SkillCategoryName } from '../types/domain';

export interface ISkillCategory {
  name: SkillCategoryName;
  slug: string;
  icon?: string;
  order: number;
}

const skillCategorySchema = new Schema<ISkillCategory>(
  {
    name: { type: String, enum: SKILL_CATEGORIES, required: true, unique: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    icon: { type: String },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const SkillCategory = model<ISkillCategory>('SkillCategory', skillCategorySchema);

export const SKILL_APPROVALS = ['CATALOGUE', 'ADMIN', 'COMMUNITY'] as const;
export type SkillApproval = (typeof SKILL_APPROVALS)[number];

export interface ISkill {
  name: string;
  /** Lowercased name; the uniqueness key so "React native" and "react native" cannot both exist. */
  slug: string;
  category: Types.ObjectId;
  description?: string;
  /** Free-text aliases matched during search, e.g. "js" -> "JavaScript". */
  aliases: string[];
  /**
   * In the shared catalogue: searchable and browsable by everyone. A skill a student adds
   * starts unapproved. It is usable by the students who list it straight away, but nobody
   * else finds it until it is approved.
   */
  approved: boolean;
  /** Who approved it: the seeded catalogue, an admin, or enough students listing it. */
  approvedVia?: SkillApproval;
  /** Set when a moderator removes the skill. Its name can then not be added again. */
  rejectedAt?: Date;
  rejectReason?: string;
  /** Denormalised counters powering "most popular skill" analytics. */
  teachCount: number;
  learnCount: number;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type SkillDoc = HydratedDocument<ISkill>;

const skillSchema = new Schema<ISkill>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    category: { type: Schema.Types.ObjectId, ref: 'SkillCategory', required: true, index: true },
    description: { type: String, maxlength: 500 },
    aliases: { type: [String], default: [] },
    approved: { type: Boolean, default: true, index: true },
    approvedVia: { type: String, enum: SKILL_APPROVALS },
    rejectedAt: { type: Date },
    rejectReason: { type: String, maxlength: 300 },
    teachCount: { type: Number, default: 0 },
    learnCount: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

skillSchema.index({ name: 'text', aliases: 'text', description: 'text' });
skillSchema.index({ teachCount: -1 });
skillSchema.index({ learnCount: -1 });

export const Skill = model<ISkill>('Skill', skillSchema);

/**
 * Canonical slug for a skill name. Shared by seeding, creation and search.
 *
 * The symbols that carry meaning in skill names are spelled out first, so "C++", "C#" and
 * "C" get three different slugs rather than all collapsing to "c". Accents are folded
 * ("Español" is "espanol").
 */
export function skillSlug(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\+/g, ' plus ')
    .replace(/#/g, ' sharp ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * The key two names are compared by when looking for duplicates: the slug without its
 * separators, so "Node.js", "NodeJS" and "node js" are one skill, and without a plural s,
 * so "Guitars" is "Guitar". Short keys keep their s ("CSS", "AWS"), as do words that end
 * in "ss" ("Chess").
 */
export function skillMatchKey(name: string): string {
  const compact = skillSlug(name).replace(/-/g, '');
  return compact.length > 4 && compact.endsWith('s') && !compact.endsWith('ss')
    ? compact.slice(0, -1)
    : compact;
}
