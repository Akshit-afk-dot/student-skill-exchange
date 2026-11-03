import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import { env } from '../config/env';
import {
  BADGES,
  TEACHING_MODES,
  USER_ROLES,
  USER_STATUSES,
  type Badge,
  type TeachingMode,
  type UserRole,
  type UserStatus,
} from '../types/domain';

/** A recurring weekly availability window, e.g. Tuesday 18:00-20:00. */
export interface AvailabilitySlot {
  /** 0 = Sunday .. 6 = Saturday */
  day: number;
  /** "HH:mm", 24-hour, in the user's IANA timezone. */
  start: string;
  end: string;
}

export interface UserStats {
  sessionsTaught: number;
  sessionsLearned: number;
  minutesTaught: number;
  minutesLearned: number;
  points: number;
  streakDays: number;
  longestStreak: number;
  lastActiveOn?: string;
}

export interface IUser {
  name: string;
  email: string;
  passwordHash?: string;
  googleId?: string;
  role: UserRole;
  status: UserStatus;

  college?: string;
  department?: string;
  year?: number;
  bio?: string;
  profileImage?: string;
  languages: string[];

  availability: AvailabilitySlot[];
  timezone: string;
  teachingMode: TeachingMode;

  city?: string;
  location?: { type: 'Point'; coordinates: [number, number] };

  ratingSum: number;
  ratingCount: number;
  ratingAvg: number;

  stats: UserStats;
  badges: Badge[];

  emailVerified: boolean;
  /** When the student agreed to the terms and privacy policy at sign-up. */
  termsAcceptedAt?: Date;
  emailVerificationTokenHash?: string;
  emailVerificationExpires?: Date;
  passwordResetTokenHash?: string;
  passwordResetExpires?: Date;

  isOnline: boolean;
  lastSeenAt?: Date;
  pushTokens: string[];

  suspendedUntil?: Date;
  moderationNote?: string;

  createdAt: Date;
  updatedAt: Date;
}

export interface IUserMethods {
  verifyPassword(plain: string): Promise<boolean>;
  isSuspended(): boolean;
}

export type UserDoc = HydratedDocument<IUser, IUserMethods>;
export type UserModel = Model<IUser, {}, IUserMethods>;

const availabilitySchema = new Schema<AvailabilitySlot>(
  {
    day: { type: Number, required: true, min: 0, max: 6 },
    start: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    end: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  },
  { _id: false },
);

const userSchema = new Schema<IUser, UserModel, IUserMethods>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    // select:false keeps the hash out of every ordinary query result by default.
    passwordHash: { type: String, select: false },
    googleId: { type: String, sparse: true, index: true },
    role: { type: String, enum: USER_ROLES, default: 'STUDENT', index: true },
    status: { type: String, enum: USER_STATUSES, default: 'ACTIVE', index: true },

    college: { type: String, trim: true, maxlength: 140, index: true },
    department: { type: String, trim: true, maxlength: 140 },
    year: { type: Number, min: 1, max: 8 },
    bio: { type: String, trim: true, maxlength: 1000 },
    profileImage: { type: String },
    languages: { type: [String], default: ['English'] },

    availability: { type: [availabilitySchema], default: [] },
    timezone: { type: String, default: 'Asia/Kolkata' },
    teachingMode: { type: String, enum: TEACHING_MODES, default: 'BOTH' },

    city: { type: String, trim: true, maxlength: 120 },
    location: {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: {
        type: [Number],
        validate: {
          validator: (v: number[]) =>
            v.length === 2 &&
            typeof v[0] === 'number' &&
            typeof v[1] === 'number' &&
            v[0] >= -180 &&
            v[0] <= 180 &&
            v[1] >= -90 &&
            v[1] <= 90,
          message: 'coordinates must be [longitude, latitude] within valid ranges',
        },
      },
    },

    ratingSum: { type: Number, default: 0, min: 0 },
    ratingCount: { type: Number, default: 0, min: 0 },
    // Denormalised so listings can sort/filter on rating without a join.
    ratingAvg: { type: Number, default: 0, min: 0, max: 5, index: true },

    stats: {
      sessionsTaught: { type: Number, default: 0 },
      sessionsLearned: { type: Number, default: 0 },
      minutesTaught: { type: Number, default: 0 },
      minutesLearned: { type: Number, default: 0 },
      points: { type: Number, default: 0, index: true },
      streakDays: { type: Number, default: 0 },
      longestStreak: { type: Number, default: 0 },
      lastActiveOn: { type: String },
    },
    badges: { type: [String], enum: BADGES, default: [] },

    emailVerified: { type: Boolean, default: false },
    termsAcceptedAt: { type: Date },
    emailVerificationTokenHash: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },

    isOnline: { type: Boolean, default: false },
    lastSeenAt: { type: Date },
    pushTokens: { type: [String], default: [], select: false },

    suspendedUntil: { type: Date },
    moderationNote: { type: String, maxlength: 500 },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.passwordHash;
        delete ret.emailVerificationTokenHash;
        delete ret.emailVerificationExpires;
        delete ret.passwordResetTokenHash;
        delete ret.passwordResetExpires;
        delete ret.pushTokens;
        delete ret.__v;
        return ret;
      },
    },
  },
);

// Geo queries for "students near me" require a 2dsphere index.
userSchema.index({ location: '2dsphere' });
// Text search over the profile blurb powers the people-search box.
userSchema.index({ name: 'text', bio: 'text', college: 'text' });
userSchema.index({ status: 1, role: 1, createdAt: -1 });

userSchema.methods.verifyPassword = async function (plain: string): Promise<boolean> {
  if (!this.passwordHash) return false;
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.methods.isSuspended = function (): boolean {
  if (this.status === 'BANNED') return true;
  if (this.status !== 'SUSPENDED') return false;
  // A suspension with no end date is indefinite; one with a past end date has lapsed.
  return !this.suspendedUntil || this.suspendedUntil.getTime() > Date.now();
};

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, env.BCRYPT_ROUNDS);
}

export const User = model<IUser, UserModel>('User', userSchema);

export type UserId = Types.ObjectId;
