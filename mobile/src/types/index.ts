export type SkillLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
export type UserSkillType = 'TEACH' | 'LEARN';
export type TeachingMode = 'ONLINE' | 'OFFLINE' | 'BOTH';
export type SessionMode = 'ONLINE' | 'OFFLINE';
export type SessionStatus = 'SCHEDULED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
export type RequestStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED';
export type ReportReason =
  | 'SPAM'
  | 'HARASSMENT'
  | 'FAKE_PROFILE'
  | 'INAPPROPRIATE_CONTENT'
  | 'SUSPICIOUS_BEHAVIOUR'
  | 'OTHER';

export const SKILL_LEVELS: SkillLevel[] = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'];

export interface AvailabilitySlot {
  day: number;
  start: string;
  end: string;
}

export interface PublicUser {
  id: string;
  name: string;
  college?: string;
  department?: string;
  year?: number;
  bio?: string;
  profileImage?: string;
  languages: string[];
  teachingMode: TeachingMode;
  timezone: string;
  city?: string;
  availability: AvailabilitySlot[];
  rating: { average: number; count: number };
  stats: { sessionsTaught: number; sessionsLearned: number; points: number; streakDays: number };
  badges: string[];
  isOnline: boolean;
  lastSeenAt?: string;
  createdAt: string;
}

export interface SelfUser extends PublicUser {
  email: string;
  role: 'STUDENT' | 'ADMIN';
  status: string;
  emailVerified: boolean;
  hasPassword: boolean;
  coordinates?: [number, number];
  stats: PublicUser['stats'] & {
    minutesTaught: number;
    minutesLearned: number;
    longestStreak: number;
  };
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessExpiresIn: string;
  refreshExpiresAt: string;
}

export interface Skill {
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

export interface SkillCategory {
  id: string;
  name: string;
  slug: string;
  icon?: string;
}

export interface UserSkillEntry {
  _id: string;
  skill: { _id: string; name: string; slug?: string };
  type: UserSkillType;
  level: SkillLevel;
  yearsOfExperience?: number;
  description?: string;
  priority: number;
}

export interface UserSkillSummary {
  id: string;
  skill: { id: string; name: string; category: string };
  level: SkillLevel;
  yearsOfExperience?: number;
  description?: string;
  priority: number;
}

export interface ProfileDetail extends PublicUser {
  teaches: UserSkillSummary[];
  learns: UserSkillSummary[];
  reviewSummary: { count: number; average: number; distribution: Record<string, number> };
}

export type MatchReasonCode =
  | 'TWO_WAY_EXCHANGE'
  | 'TEACHES_WHAT_YOU_WANT'
  | 'WANTS_WHAT_YOU_TEACH'
  | 'STRONG_AVAILABILITY_OVERLAP'
  | 'HIGHLY_RATED'
  | 'SAME_COLLEGE'
  | 'NEARBY'
  | 'EXPERIENCED_TEACHER';

export interface MatchReason {
  code: MatchReasonCode;
  skillIds?: string[];
  value?: number;
}

export interface MatchCandidate extends PublicUser {
  matchScore: number;
  matchPercent: number;
  twoWay: boolean;
  breakdown: Record<string, number>;
  reasons: MatchReason[];
  theyTeachYouWant: Array<{ id: string; name: string; level: SkillLevel }>;
  youTeachTheyWant: Array<{ id: string; name: string; level: SkillLevel }>;
  overlapMinutes: number;
  distanceKm?: number;
}

export interface SearchResultUser extends PublicUser {
  distanceKm?: number;
  matchedSkillLevel?: SkillLevel;
}

export interface LearningRequest {
  _id: string;
  sender: PublicUserRef;
  receiver: PublicUserRef;
  skill: { _id: string; name: string };
  offeredSkill?: { _id: string; name: string };
  message: string;
  status: RequestStatus;
  createdAt: string;
  respondedAt?: string;
}

export interface PublicUserRef {
  _id: string;
  name: string;
  profileImage?: string;
  college?: string;
  ratingAvg?: number;
  ratingCount?: number;
  isOnline?: boolean;
}

export interface ConnectionView {
  id: string;
  conversationId?: string;
  student: {
    id: string;
    name: string;
    profileImage?: string;
    college?: string;
    department?: string;
    rating: number;
    isOnline: boolean;
  };
  connectedAt: string;
}

export interface ConversationView {
  id: string;
  participant: {
    id: string;
    name: string;
    profileImage?: string;
    college?: string;
    isOnline: boolean;
    lastSeenAt?: string;
  };
  lastMessage?: { body: string; at: string; type: string };
  unread: number;
  updatedAt: string;
}

export interface ChatMessage {
  _id: string;
  conversation: string;
  sender: PublicUserRef | string;
  receiver: string;
  body: string;
  type: 'TEXT' | 'IMAGE' | 'FILE' | 'SYSTEM';
  attachment?: { url: string; mimeType: string; size: number; name?: string };
  readAt?: string;
  createdAt: string;
}

export interface LearningSession {
  _id: string;
  teacher: PublicUserRef;
  learner: PublicUserRef;
  skill: { _id: string; name: string };
  scheduledAt: string;
  endsAt?: string;
  durationMinutes: number;
  mode: SessionMode;
  meetingLink?: string;
  location?: string;
  notes?: string;
  status: SessionStatus;
  completedBy: string[];
  completedAt?: string;
  cancelReason?: string;
}

export interface CalendarEntry {
  id: string;
  title: string;
  scheduledAt: string;
  endsAt: string;
  durationMinutes: number;
  status: SessionStatus;
  mode: SessionMode;
  role: 'teacher' | 'learner';
  partner: { id: string; name: string; profileImage?: string };
}

export interface Review {
  _id: string;
  session: string;
  reviewer: PublicUserRef;
  reviewee: PublicUserRef | string;
  skill: { _id: string; name: string };
  rating: number;
  comment?: string;
  createdAt: string;
}

export interface AppNotification {
  _id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, string>;
  read: boolean;
  createdAt: string;
}

export interface LeaderboardEntry {
  rank: number;
  id: string;
  name: string;
  profileImage?: string;
  college?: string;
  points: number;
  sessionsTaught: number;
  rating: number;
  badges: string[];
}

export interface BadgeInfo {
  badge: string;
  label: string;
  description: string;
  earned?: boolean;
}

export interface LearningAnalytics {
  minutesTaught: number;
  minutesLearned: number;
  hoursTaught: number;
  hoursLearned: number;
  sessionsTaught: number;
  sessionsLearned: number;
  skillsTeaching: number;
  skillsLearning: number;
  points: number;
  streakDays: number;
  longestStreak: number;
  rating: { average: number; count: number };
  badges: BadgeInfo[];
  recentActivity: Array<{ date: string; sessions: number; minutes: number }>;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}
