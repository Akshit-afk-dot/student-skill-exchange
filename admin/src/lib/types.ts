export interface AdminUser {
  _id: string;
  name: string;
  email: string;
  role: 'STUDENT' | 'ADMIN';
  status: 'ACTIVE' | 'SUSPENDED' | 'BANNED';
  college?: string;
  department?: string;
  year?: number;
  profileImage?: string;
  emailVerified: boolean;
  isOnline: boolean;
  ratingAvg: number;
  ratingCount: number;
  suspendedUntil?: string;
  moderationNote?: string;
  stats: {
    sessionsTaught: number;
    sessionsLearned: number;
    points: number;
    streakDays: number;
  };
  createdAt: string;
}

export interface DashboardStats {
  users: {
    total: number;
    active: number;
    suspended: number;
    banned: number;
    newThisWeek: number;
    newThisMonth: number;
    onlineNow: number;
    verified: number;
  };
  sessions: {
    total: number;
    completed: number;
    scheduled: number;
    cancelled: number;
    completionRate: number;
    totalHoursExchanged: number;
  };
  requests: { total: number; pending: number; accepted: number; acceptanceRate: number };
  community: {
    connections: number;
    messages: number;
    reviews: number;
    averageRating: number;
    openReports: number;
  };
  skills: { total: number; unapproved: number; categories: number };
  growth: Array<{ date: string; signups: number }>;
  topSkills: {
    mostTaught: Array<{ name: string; count: number }>;
    mostWanted: Array<{ name: string; count: number }>;
  };
}

export type ReportReason =
  | 'SPAM'
  | 'HARASSMENT'
  | 'FAKE_PROFILE'
  | 'INAPPROPRIATE_CONTENT'
  | 'SUSPICIOUS_BEHAVIOUR'
  | 'OTHER';

export type ModerationAction =
  | 'NONE'
  | 'WARNING'
  | 'CONTENT_REMOVED'
  | 'SUSPENDED'
  | 'BANNED';

export interface AdminReport {
  _id: string;
  reporter: Pick<AdminUser, '_id' | 'name' | 'email' | 'profileImage'> | null;
  reportedUser:
    | (Pick<AdminUser, '_id' | 'name' | 'email' | 'profileImage' | 'status'> & {
        ratingAvg: number;
      })
    | null;
  reason: ReportReason;
  description?: string;
  relatedMessage?: { _id: string; body: string; createdAt: string } | null;
  status: 'OPEN' | 'REVIEWING' | 'RESOLVED' | 'DISMISSED';
  actionTaken: ModerationAction;
  resolutionNote?: string;
  handledBy?: { _id: string; name: string } | null;
  handledAt?: string;
  createdAt: string;
}

/** Shape returned by GET /skills — note `id`, not `_id`. */
export interface AdminSkill {
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

export interface AuditEntry {
  _id: string;
  actor: { _id: string; name: string; email: string } | null;
  action: string;
  targetType: string;
  targetId?: string;
  meta: Record<string, unknown>;
  ip?: string;
  createdAt: string;
}

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: 'STUDENT' | 'ADMIN';
}
