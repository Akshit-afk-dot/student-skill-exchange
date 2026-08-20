import { Types } from 'mongoose';
import {
  AuditLog,
  Connection,
  LearningRequest,
  Message,
  Report,
  Review,
  Session,
  Skill,
  SkillCategory,
  User,
  UserSkill,
  skillSlug,
  type ReportDoc,
} from '../../models';
import type { ModerationAction, ReportStatus, UserStatus } from '../../types/domain';
import { ApiError } from '../../utils/errors';
import { paginate, type Paginated } from '../../utils/pagination';
import { notify } from '../notifications/service';
import { revokeAllForUser } from '../auth/tokens';
import { recalculateRating } from '../users/service';

export async function recordAudit(
  actorId: string,
  action: string,
  targetType: string,
  targetId?: string | Types.ObjectId,
  meta: Record<string, unknown> = {},
  ip?: string,
): Promise<void> {
  await AuditLog.create({ actor: actorId, action, targetType, targetId, meta, ip });
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

/** Everything on the admin dashboard, in one round trip. */
export async function dashboardStats(): Promise<DashboardStats> {
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const monthAgo = new Date(Date.now() - 30 * 86_400_000);

  const [
    userCounts,
    newThisWeek,
    newThisMonth,
    onlineNow,
    verified,
    sessionCounts,
    hoursAgg,
    requestCounts,
    connections,
    messages,
    reviewAgg,
    openReports,
    skillTotal,
    skillUnapproved,
    categories,
    growth,
    mostTaught,
    mostWanted,
  ] = await Promise.all([
    User.aggregate<{ _id: UserStatus; count: number }>([
      { $match: { role: 'STUDENT' } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    User.countDocuments({ role: 'STUDENT', createdAt: { $gte: weekAgo } }),
    User.countDocuments({ role: 'STUDENT', createdAt: { $gte: monthAgo } }),
    User.countDocuments({ isOnline: true }),
    User.countDocuments({ role: 'STUDENT', emailVerified: true }),
    Session.aggregate<{ _id: string; count: number }>([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Session.aggregate<{ minutes: number }>([
      { $match: { status: 'COMPLETED' } },
      { $group: { _id: null, minutes: { $sum: '$durationMinutes' } } },
    ]),
    LearningRequest.aggregate<{ _id: string; count: number }>([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Connection.countDocuments({ active: true }),
    Message.countDocuments({ deletedAt: null }),
    Review.aggregate<{ avg: number; count: number }>([
      { $match: { hidden: false } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]),
    Report.countDocuments({ status: { $in: ['OPEN', 'REVIEWING'] } }),
    Skill.countDocuments(),
    Skill.countDocuments({ approved: false }),
    SkillCategory.countDocuments(),
    User.aggregate<{ _id: string; signups: number }>([
      { $match: { role: 'STUDENT', createdAt: { $gte: monthAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          signups: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Skill.find({ teachCount: { $gt: 0 } }).sort({ teachCount: -1 }).limit(10).select('name teachCount').lean(),
    Skill.find({ learnCount: { $gt: 0 } }).sort({ learnCount: -1 }).limit(10).select('name learnCount').lean(),
  ]);

  const byStatus = (rows: Array<{ _id: string; count: number }>, key: string) =>
    rows.find((r) => r._id === key)?.count ?? 0;

  const totalUsers = userCounts.reduce((sum, r) => sum + r.count, 0);
  const totalSessions = sessionCounts.reduce((sum, r) => sum + r.count, 0);
  const completedSessions = byStatus(sessionCounts, 'COMPLETED');
  const totalRequests = requestCounts.reduce((sum, r) => sum + r.count, 0);
  const acceptedRequests = byStatus(requestCounts, 'ACCEPTED');

  return {
    users: {
      total: totalUsers,
      active: byStatus(userCounts, 'ACTIVE'),
      suspended: byStatus(userCounts, 'SUSPENDED'),
      banned: byStatus(userCounts, 'BANNED'),
      newThisWeek,
      newThisMonth,
      onlineNow,
      verified,
    },
    sessions: {
      total: totalSessions,
      completed: completedSessions,
      scheduled: byStatus(sessionCounts, 'SCHEDULED') + byStatus(sessionCounts, 'CONFIRMED'),
      cancelled: byStatus(sessionCounts, 'CANCELLED'),
      completionRate: totalSessions > 0 ? Number(((completedSessions / totalSessions) * 100).toFixed(1)) : 0,
      totalHoursExchanged: Number((((hoursAgg[0]?.minutes ?? 0) / 60)).toFixed(1)),
    },
    requests: {
      total: totalRequests,
      pending: byStatus(requestCounts, 'PENDING'),
      accepted: acceptedRequests,
      acceptanceRate: totalRequests > 0 ? Number(((acceptedRequests / totalRequests) * 100).toFixed(1)) : 0,
    },
    community: {
      connections,
      messages,
      reviews: reviewAgg[0]?.count ?? 0,
      averageRating: Number((reviewAgg[0]?.avg ?? 0).toFixed(2)),
      openReports,
    },
    skills: { total: skillTotal, unapproved: skillUnapproved, categories },
    growth: growth.map((g) => ({ date: g._id, signups: g.signups })),
    topSkills: {
      mostTaught: mostTaught.map((s) => ({ name: s.name, count: s.teachCount })),
      mostWanted: mostWanted.map((s) => ({ name: s.name, count: s.learnCount })),
    },
  };
}

export interface AdminUserFilters {
  q?: string;
  status?: UserStatus;
  college?: string;
  page: number;
  limit: number;
  sort: 'recent' | 'points' | 'rating' | 'name';
}

export async function listUsers(filters: AdminUserFilters): Promise<Paginated<unknown>> {
  const filter: Record<string, unknown> = {};
  if (filters.status) filter.status = filters.status;
  if (filters.college) filter.college = filters.college;
  if (filters.q) {
    const rx = new RegExp(filters.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { college: rx }];
  }

  const sort: Record<string, 1 | -1> =
    filters.sort === 'points'
      ? { 'stats.points': -1 }
      : filters.sort === 'rating'
        ? { ratingAvg: -1 }
        : filters.sort === 'name'
          ? { name: 1 }
          : { createdAt: -1 };

  const skip = (filters.page - 1) * filters.limit;
  const [items, total] = await Promise.all([
    User.find(filter).sort(sort).skip(skip).limit(filters.limit).lean(),
    User.countDocuments(filter),
  ]);

  return paginate(items, total, filters);
}

export interface ModerateUserInput {
  status: UserStatus;
  /** Days from now; omitted means indefinite. Only meaningful for SUSPENDED. */
  suspendDays?: number;
  reason?: string;
}

/**
 * Changes an account's standing.
 *
 * Suspending or banning also revokes every refresh token, so the offender is signed out
 * on their next access-token expiry rather than lingering for up to 30 days.
 */
export async function moderateUser(
  adminId: string,
  userId: string,
  input: ModerateUserInput,
  ip?: string,
) {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('Student not found');
  if (user.role === 'ADMIN') throw ApiError.forbidden('Administrator accounts cannot be moderated here');

  user.status = input.status;
  user.moderationNote = input.reason;
  user.suspendedUntil =
    input.status === 'SUSPENDED' && input.suspendDays
      ? new Date(Date.now() + input.suspendDays * 86_400_000)
      : undefined;
  await user.save();

  if (input.status !== 'ACTIVE') {
    await revokeAllForUser(userId);
  }

  await notify({
    user: user._id,
    type: 'MODERATION_NOTICE',
    title:
      input.status === 'ACTIVE'
        ? 'Your account has been reinstated'
        : input.status === 'SUSPENDED'
          ? 'Your account has been suspended'
          : 'Your account has been banned',
    body: input.reason ?? 'Contact support if you believe this was a mistake.',
    data: { screen: 'Settings' },
  });

  await recordAudit(adminId, `user.${input.status.toLowerCase()}`, 'User', userId, { ...input }, ip);
  return user;
}

export async function listReports(
  status: ReportStatus | undefined,
  page: number,
  limit: number,
): Promise<Paginated<unknown>> {
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Report.find(filter)
      .populate('reporter', 'name email profileImage')
      .populate('reportedUser', 'name email profileImage status ratingAvg')
      .populate('relatedMessage', 'body createdAt')
      .populate('handledBy', 'name')
      // Oldest open reports first: a moderation queue should be FIFO.
      .sort({ status: 1, createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Report.countDocuments(filter),
  ]);

  return paginate(items, total, { page, limit });
}

export interface ResolveReportInput {
  action: ModerationAction;
  resolutionNote?: string;
  suspendDays?: number;
  dismiss?: boolean;
}

/** Resolves a report and applies the chosen action to the reported account. */
export async function resolveReport(
  adminId: string,
  reportId: string,
  input: ResolveReportInput,
  ip?: string,
): Promise<ReportDoc> {
  const report = await Report.findById(reportId);
  if (!report) throw ApiError.notFound('Report not found');
  if (report.status === 'RESOLVED' || report.status === 'DISMISSED') {
    throw ApiError.conflict('This report has already been closed');
  }

  switch (input.action) {
    case 'SUSPENDED':
      await moderateUser(
        adminId,
        String(report.reportedUser),
        { status: 'SUSPENDED', suspendDays: input.suspendDays, reason: input.resolutionNote },
        ip,
      );
      break;
    case 'BANNED':
      await moderateUser(
        adminId,
        String(report.reportedUser),
        { status: 'BANNED', reason: input.resolutionNote },
        ip,
      );
      break;
    case 'CONTENT_REMOVED':
      if (report.relatedMessage) {
        await Message.updateOne(
          { _id: report.relatedMessage },
          { $set: { deletedAt: new Date(), body: '' } },
        );
      }
      if (report.relatedReview) {
        const review = await Review.findByIdAndUpdate(report.relatedReview, {
          $set: { hidden: true },
        });
        // A hidden review must stop counting toward the reviewee's average.
        if (review) await recalculateRating(review.reviewee);
      }
      break;
    case 'WARNING':
      await notify({
        user: report.reportedUser,
        type: 'MODERATION_NOTICE',
        title: 'A warning about your recent activity',
        body:
          input.resolutionNote ??
          'Another student reported your conduct. Please review the community guidelines.',
        data: { screen: 'Settings' },
      });
      break;
    case 'NONE':
      break;
  }

  report.status = input.dismiss ? 'DISMISSED' : 'RESOLVED';
  report.actionTaken = input.action;
  report.resolutionNote = input.resolutionNote;
  report.handledBy = new Types.ObjectId(adminId);
  report.handledAt = new Date();
  await report.save();

  await recordAudit(adminId, 'report.resolve', 'Report', reportId, { ...input }, ip);
  return report;
}

export async function claimReport(adminId: string, reportId: string): Promise<ReportDoc> {
  const report = await Report.findOneAndUpdate(
    { _id: reportId, status: 'OPEN' },
    { $set: { status: 'REVIEWING', handledBy: adminId } },
    { returnDocument: 'after' },
  );
  if (!report) throw ApiError.conflict('That report is not open, or someone already claimed it');
  return report;
}

export async function setReviewHidden(
  adminId: string,
  reviewId: string,
  hidden: boolean,
  ip?: string,
) {
  const review = await Review.findByIdAndUpdate(reviewId, { $set: { hidden } }, { returnDocument: 'after' });
  if (!review) throw ApiError.notFound('Review not found');

  await recalculateRating(review.reviewee);
  await recordAudit(adminId, hidden ? 'review.hide' : 'review.unhide', 'Review', reviewId, {}, ip);
  return review;
}

export async function approveSkill(adminId: string, skillId: string, ip?: string) {
  const skill = await Skill.findByIdAndUpdate(skillId, { $set: { approved: true } }, { returnDocument: 'after' });
  if (!skill) throw ApiError.notFound('Skill not found');
  await recordAudit(adminId, 'skill.approve', 'Skill', skillId, {}, ip);
  return skill;
}

export async function createSkill(
  adminId: string,
  input: { name: string; categoryId: string; description?: string; aliases?: string[] },
  ip?: string,
) {
  const category = await SkillCategory.findById(input.categoryId);
  if (!category) throw ApiError.badRequest('Unknown skill category');

  const slug = skillSlug(input.name);
  if (await Skill.exists({ slug })) throw ApiError.conflict('That skill already exists');

  const skill = await Skill.create({
    name: input.name.trim(),
    slug,
    category: category._id,
    description: input.description,
    aliases: input.aliases ?? [],
    approved: true,
    createdBy: adminId,
  });

  await recordAudit(adminId, 'skill.create', 'Skill', skill._id, { name: skill.name }, ip);
  return skill;
}

/**
 * Merges a duplicate skill into a canonical one.
 *
 * Every UserSkill row pointing at the duplicate is repointed, skipping rows that would
 * collide with an entry the user already has for the target, and the counters are
 * recomputed from the resulting rows rather than added together — addition would double
 * count exactly those skipped duplicates.
 */
export async function mergeSkills(
  adminId: string,
  sourceId: string,
  targetId: string,
  ip?: string,
) {
  if (sourceId === targetId) throw ApiError.badRequest('Cannot merge a skill into itself');

  const [source, target] = await Promise.all([Skill.findById(sourceId), Skill.findById(targetId)]);
  if (!source || !target) throw ApiError.notFound('Skill not found');

  const rows = await UserSkill.find({ skill: source._id }).lean();

  let moved = 0;
  let dropped = 0;
  for (const row of rows) {
    const clash = await UserSkill.exists({
      user: row.user,
      skill: target._id,
      type: row.type,
    });
    if (clash) {
      await UserSkill.deleteOne({ _id: row._id });
      dropped += 1;
    } else {
      await UserSkill.updateOne({ _id: row._id }, { $set: { skill: target._id } });
      moved += 1;
    }
  }

  const [teachCount, learnCount] = await Promise.all([
    UserSkill.countDocuments({ skill: target._id, type: 'TEACH' }),
    UserSkill.countDocuments({ skill: target._id, type: 'LEARN' }),
  ]);
  await Skill.updateOne({ _id: target._id }, { $set: { teachCount, learnCount } });
  await Skill.deleteOne({ _id: source._id });

  await recordAudit(
    adminId,
    'skill.merge',
    'Skill',
    target._id,
    { from: source.name, into: target.name, moved, dropped },
    ip,
  );

  return { target, moved, dropped };
}

export async function listAuditLog(page: number, limit: number): Promise<Paginated<unknown>> {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    AuditLog.find()
      .populate('actor', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments(),
  ]);
  return paginate(items, total, { page, limit });
}
