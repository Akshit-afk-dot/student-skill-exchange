import { Types } from 'mongoose';
import { Session, User, UserSkill, type UserDoc } from '../../models';
import { BADGES, POINTS, type Badge } from '../../types/domain';
import { paginate, type Paginated } from '../../utils/pagination';
import { notify } from '../notifications/service';

/** Local calendar day as YYYY-MM-DD, used as the streak key. */
export function dayKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

export async function awardPoints(userId: string | Types.ObjectId, points: number): Promise<void> {
  if (points === 0) return;
  await User.updateOne({ _id: userId }, { $inc: { 'stats.points': points } });
}

/**
 * Advances the learning streak for a day of activity.
 *
 * Consecutive days extend the streak, a same-day repeat is a no-op, and any gap resets
 * it to 1. The longest streak is kept separately so a reset does not erase the record.
 */
export async function touchStreak(userId: string | Types.ObjectId): Promise<number> {
  const user = await User.findById(userId).select('stats');
  if (!user) return 0;

  const today = dayKey();
  const last = user.stats.lastActiveOn;

  let streak: number;
  if (!last) {
    streak = 1;
  } else {
    const gap = daysBetween(last, today);
    if (gap === 0) return user.stats.streakDays; // already counted today
    streak = gap === 1 ? user.stats.streakDays + 1 : 1;
  }

  user.stats.streakDays = streak;
  user.stats.lastActiveOn = today;
  if (streak > user.stats.longestStreak) user.stats.longestStreak = streak;
  user.stats.points += POINTS.STREAK_DAY;
  await user.save();

  return streak;
}

interface BadgeRule {
  badge: Badge;
  label: string;
  description: string;
  test(ctx: BadgeContext): boolean;
}

interface BadgeContext {
  user: UserDoc;
  distinctSkillsTaught: number;
}

/** Badge criteria, kept declarative so the rules can be listed in the UI. */
export const BADGE_RULES: BadgeRule[] = [
  {
    badge: 'FIRST_SESSION',
    label: 'First Session',
    description: 'Complete your first learning session',
    test: ({ user }) => user.stats.sessionsTaught + user.stats.sessionsLearned >= 1,
  },
  {
    badge: 'TOP_MENTOR',
    label: 'Top Mentor',
    description: 'Teach 10 sessions while holding a 4.5+ rating',
    test: ({ user }) => user.stats.sessionsTaught >= 10 && user.ratingAvg >= 4.5,
  },
  {
    badge: 'LEARNING_STREAK',
    label: 'Learning Streak',
    description: 'Stay active 7 days in a row',
    test: ({ user }) => user.stats.longestStreak >= 7,
  },
  {
    badge: 'HIGHLY_RATED',
    label: 'Highly Rated',
    description: 'Hold a 4.5+ average across at least 5 reviews',
    test: ({ user }) => user.ratingCount >= 5 && user.ratingAvg >= 4.5,
  },
  {
    badge: 'KNOWLEDGE_SHARER',
    label: 'Knowledge Sharer',
    description: 'Offer 3 or more skills to teach',
    test: ({ distinctSkillsTaught }) => distinctSkillsTaught >= 3,
  },
  {
    badge: 'COMMUNITY_HELPER',
    label: 'Community Helper',
    description: 'Earn 500 points',
    test: ({ user }) => user.stats.points >= 500,
  },
  {
    badge: 'POLYGLOT',
    label: 'Polyglot',
    description: 'List 3 or more languages you speak',
    test: ({ user }) => (user.languages?.length ?? 0) >= 3,
  },
];

/**
 * Evaluates every badge rule and awards the ones newly satisfied.
 * Badges are never revoked — a rating dip should not take back an earned achievement.
 */
export async function evaluateBadges(userId: string | Types.ObjectId): Promise<Badge[]> {
  const user = await User.findById(userId);
  if (!user) return [];

  const distinctSkillsTaught = (
    await UserSkill.distinct('skill', { user: user._id, type: 'TEACH' })
  ).length;

  const ctx: BadgeContext = { user, distinctSkillsTaught };
  const held = new Set<Badge>(user.badges);
  const newlyEarned: Badge[] = [];

  for (const rule of BADGE_RULES) {
    if (!held.has(rule.badge) && rule.test(ctx)) newlyEarned.push(rule.badge);
  }

  if (newlyEarned.length > 0) {
    await User.updateOne({ _id: user._id }, { $addToSet: { badges: { $each: newlyEarned } } });
    for (const badge of newlyEarned) {
      const rule = BADGE_RULES.find((r) => r.badge === badge);
      await notify({
        user: user._id,
        type: 'BADGE_EARNED',
        title: `Badge earned: ${rule?.label ?? badge}`,
        body: rule?.description ?? 'You unlocked a new badge',
        data: { badge, screen: 'Badges' },
      });
    }
  }

  return newlyEarned;
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

export interface LeaderboardOptions {
  scope: 'global' | 'college';
  college?: string;
  page: number;
  limit: number;
}

export async function leaderboard(options: LeaderboardOptions): Promise<Paginated<LeaderboardEntry>> {
  const filter: Record<string, unknown> = { status: 'ACTIVE', role: 'STUDENT' };
  if (options.scope === 'college' && options.college) filter.college = options.college;

  const skip = (options.page - 1) * options.limit;
  const [rows, total] = await Promise.all([
    User.find(filter)
      .select('name profileImage college stats ratingAvg badges')
      // Points first, then teaching volume, so ties resolve on contribution.
      .sort({ 'stats.points': -1, 'stats.sessionsTaught': -1, _id: 1 })
      .skip(skip)
      .limit(options.limit)
      .lean(),
    User.countDocuments(filter),
  ]);

  const items: LeaderboardEntry[] = rows.map((row, index) => {
    const entry: LeaderboardEntry = {
      rank: skip + index + 1,
      id: String(row._id),
      name: row.name,
      points: row.stats?.points ?? 0,
      sessionsTaught: row.stats?.sessionsTaught ?? 0,
      rating: Number((row.ratingAvg ?? 0).toFixed(2)),
      badges: row.badges ?? [],
    };
    if (row.profileImage) entry.profileImage = row.profileImage;
    if (row.college) entry.college = row.college;
    return entry;
  });

  return paginate(items, total, options);
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
  badges: Array<{ badge: string; label: string; description: string; earned: boolean }>;
  recentActivity: Array<{ date: string; sessions: number; minutes: number }>;
}

/** Backs the Learning Analytics screen. */
export async function analyticsFor(userId: string): Promise<LearningAnalytics> {
  const uid = new Types.ObjectId(userId);
  const [user, skillCounts, activity] = await Promise.all([
    User.findById(uid).lean(),
    UserSkill.aggregate<{ _id: string; count: number }>([
      { $match: { user: uid } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
    ]),
    // Last 30 days of completed sessions, bucketed by day for the activity chart.
    Session.aggregate<{ _id: string; sessions: number; minutes: number }>([
      {
        $match: {
          status: 'COMPLETED',
          completedAt: { $gte: new Date(Date.now() - 30 * 86_400_000) },
          $or: [{ teacher: uid }, { learner: uid }],
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$completedAt' } },
          sessions: { $sum: 1 },
          minutes: { $sum: '$durationMinutes' },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const stats = user?.stats;
  const teachCount = skillCounts.find((s) => s._id === 'TEACH')?.count ?? 0;
  const learnCount = skillCounts.find((s) => s._id === 'LEARN')?.count ?? 0;
  const held = new Set(user?.badges ?? []);

  return {
    minutesTaught: stats?.minutesTaught ?? 0,
    minutesLearned: stats?.minutesLearned ?? 0,
    hoursTaught: Number(((stats?.minutesTaught ?? 0) / 60).toFixed(1)),
    hoursLearned: Number(((stats?.minutesLearned ?? 0) / 60).toFixed(1)),
    sessionsTaught: stats?.sessionsTaught ?? 0,
    sessionsLearned: stats?.sessionsLearned ?? 0,
    skillsTeaching: teachCount,
    skillsLearning: learnCount,
    points: stats?.points ?? 0,
    streakDays: stats?.streakDays ?? 0,
    longestStreak: stats?.longestStreak ?? 0,
    rating: {
      average: Number((user?.ratingAvg ?? 0).toFixed(2)),
      count: user?.ratingCount ?? 0,
    },
    badges: BADGE_RULES.map((rule) => ({
      badge: rule.badge,
      label: rule.label,
      description: rule.description,
      earned: held.has(rule.badge),
    })),
    recentActivity: activity.map((a) => ({
      date: a._id,
      sessions: a.sessions,
      minutes: a.minutes,
    })),
  };
}

export const ALL_BADGES = BADGES;
