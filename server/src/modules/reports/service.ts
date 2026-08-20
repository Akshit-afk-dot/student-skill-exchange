import { Types } from 'mongoose';
import { Report, User, type ReportDoc } from '../../models';
import type { ReportReason } from '../../types/domain';
import { ApiError } from '../../utils/errors';
import { paginate, type Paginated } from '../../utils/pagination';

export interface CreateReportInput {
  reportedUserId: string;
  reason: ReportReason;
  description?: string;
  relatedMessageId?: string;
  relatedSessionId?: string;
  relatedReviewId?: string;
}

/**
 * Files a safety report against another student.
 *
 * A partial unique index allows only one open report per (reporter, target) pair, so a
 * single user cannot bury the moderation queue under duplicates of the same complaint.
 */
export async function createReport(
  reporterId: string,
  input: CreateReportInput,
): Promise<ReportDoc> {
  if (reporterId === input.reportedUserId) {
    throw ApiError.badRequest('You cannot report yourself');
  }

  const reported = await User.findById(input.reportedUserId).select('_id').lean();
  if (!reported) throw ApiError.notFound('Student not found');

  try {
    return await Report.create({
      reporter: reporterId,
      reportedUser: reported._id,
      reason: input.reason,
      description: input.description,
      relatedMessage: input.relatedMessageId,
      relatedSession: input.relatedSessionId,
      relatedReview: input.relatedReviewId,
      status: 'OPEN',
    });
  } catch (err) {
    if (typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000) {
      throw ApiError.conflict(
        'You already have an open report against this student. Our team is reviewing it.',
      );
    }
    throw err;
  }
}

export async function listMine(
  reporterId: string,
  page: number,
  limit: number,
): Promise<Paginated<unknown>> {
  const filter = { reporter: new Types.ObjectId(reporterId) };
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Report.find(filter)
      .populate('reportedUser', 'name profileImage')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Report.countDocuments(filter),
  ]);

  return paginate(items, total, { page, limit });
}
