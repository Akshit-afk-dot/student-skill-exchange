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

export interface ISkill {
  name: string;
  /** Lowercased name; the uniqueness key so "React native" and "react native" cannot both exist. */
  slug: string;
  category: Types.ObjectId;
  description?: string;
  /** Free-text aliases matched during search, e.g. "js" -> "JavaScript". */
  aliases: string[];
  /** Admin-approved. User-proposed skills start unapproved and are still usable. */
  approved: boolean;
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

/** Canonical slug for a skill name. Shared by seeding, creation and search. */
export function skillSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
