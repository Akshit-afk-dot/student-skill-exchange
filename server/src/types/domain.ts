/** Shared domain vocabulary. Kept in one place so models, validators and the client agree. */

export const SKILL_LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'] as const;
export type SkillLevel = (typeof SKILL_LEVELS)[number];

/** Ordinal rank used by the experience component of the match score. */
export const LEVEL_RANK: Record<SkillLevel, number> = {
  BEGINNER: 1,
  INTERMEDIATE: 2,
  ADVANCED: 3,
  EXPERT: 4,
};

export const USER_SKILL_TYPES = ['TEACH', 'LEARN'] as const;
export type UserSkillType = (typeof USER_SKILL_TYPES)[number];

export const SKILL_CATEGORIES = [
  'Programming',
  'Design',
  'Languages',
  'Music',
  'Photography',
  'Business',
  'Academics',
  'Communication',
  'Sports',
  'Other',
] as const;
export type SkillCategoryName = (typeof SKILL_CATEGORIES)[number];

export const USER_ROLES = ['STUDENT', 'ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ['ACTIVE', 'SUSPENDED', 'BANNED'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const REQUEST_STATUSES = ['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'EXPIRED'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const SESSION_STATUSES = [
  'SCHEDULED',
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const SESSION_MODES = ['ONLINE', 'OFFLINE'] as const;
export type SessionMode = (typeof SESSION_MODES)[number];

export const TEACHING_MODES = ['ONLINE', 'OFFLINE', 'BOTH'] as const;
export type TeachingMode = (typeof TEACHING_MODES)[number];

export const MESSAGE_TYPES = ['TEXT', 'IMAGE', 'FILE', 'SYSTEM'] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];

export const REPORT_REASONS = [
  'SPAM',
  'HARASSMENT',
  'FAKE_PROFILE',
  'INAPPROPRIATE_CONTENT',
  'SUSPICIOUS_BEHAVIOUR',
  'OTHER',
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_STATUSES = ['OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const MODERATION_ACTIONS = [
  'NONE',
  'WARNING',
  'CONTENT_REMOVED',
  'SUSPENDED',
  'BANNED',
] as const;
export type ModerationAction = (typeof MODERATION_ACTIONS)[number];

export const NOTIFICATION_TYPES = [
  'REQUEST_RECEIVED',
  'REQUEST_ACCEPTED',
  'REQUEST_REJECTED',
  'MESSAGE_RECEIVED',
  'SESSION_SCHEDULED',
  'SESSION_REMINDER',
  'SESSION_CANCELLED',
  'SESSION_COMPLETED',
  'REVIEW_RECEIVED',
  'NEW_MATCH',
  'BADGE_EARNED',
  'MODERATION_NOTICE',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const BADGES = [
  'TOP_MENTOR',
  'LEARNING_STREAK',
  'HIGHLY_RATED',
  'KNOWLEDGE_SHARER',
  'COMMUNITY_HELPER',
  'FIRST_SESSION',
  'POLYGLOT',
] as const;
export type Badge = (typeof BADGES)[number];

export const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

/** Points awarded by the gamification engine. */
export const POINTS = {
  SESSION_TAUGHT: 25,
  SESSION_LEARNED: 10,
  REVIEW_GIVEN: 5,
  FIVE_STAR_RECEIVED: 15,
  STREAK_DAY: 2,
  PROFILE_COMPLETED: 20,
} as const;
