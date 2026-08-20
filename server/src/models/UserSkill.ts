import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { SKILL_LEVELS, USER_SKILL_TYPES, type SkillLevel, type UserSkillType } from '../types/domain';

export interface IUserSkill {
  user: Types.ObjectId;
  skill: Types.ObjectId;
  /** TEACH = "I can teach this"; LEARN = "I want to learn this". */
  type: UserSkillType;
  /** For TEACH this is the level held; for LEARN it is the level desired. */
  level: SkillLevel;
  yearsOfExperience?: number;
  description?: string;
  /** Learner-side priority, lets the matcher weight "most wanted" skills higher. */
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

export type UserSkillDoc = HydratedDocument<IUserSkill>;

const userSkillSchema = new Schema<IUserSkill>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    skill: { type: Schema.Types.ObjectId, ref: 'Skill', required: true, index: true },
    type: { type: String, enum: USER_SKILL_TYPES, required: true },
    level: { type: String, enum: SKILL_LEVELS, required: true },
    yearsOfExperience: { type: Number, min: 0, max: 50 },
    description: { type: String, maxlength: 300 },
    priority: { type: Number, default: 1, min: 1, max: 3 },
  },
  { timestamps: true },
);

// One row per (user, skill, direction): a user cannot list Python to teach twice,
// but may both teach and want to learn the same skill at a higher level.
userSkillSchema.index({ user: 1, skill: 1, type: 1 }, { unique: true });
// Drives the matcher's "who teaches X" lookup.
userSkillSchema.index({ skill: 1, type: 1, level: 1 });

export const UserSkill = model<IUserSkill>('UserSkill', userSkillSchema);
