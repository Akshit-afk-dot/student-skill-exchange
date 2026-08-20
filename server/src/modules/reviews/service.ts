import { Types } from 'mongoose';
import { Review, Session, User, type ReviewDoc } from '../../models';
import { POINTS } from '../../types/domain';
import { ApiError } from '../../utils/errors';
import { paginate, type Paginated } from '../../utils/pagination';
import { awardPoints, evaluateBadges } from '../gamification/service';
import { notify } from '../notifications/service';
import { recalculateRating } from '../users/service';

/** Window during which an author may still edit or withdraw their review. */
const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface CreateReviewInput {
  sessionId: string;
  rating: number;
  comment?: string;
}

/**
 * Leaves a review for the other participant of a completed session.
 *
 * Reviews are anchored to a session rather than to a user, which is what stops rating
 * farming: you cannot review someone you never actually studied with, and the unique
 * (session, reviewer) index caps it at one review each per session.
 */
export async function createReview(
  reviewerId: string,
  input: CreateReviewInput,
): Promise<ReviewDoc> {
  if (!Types.ObjectId.isValid(input.sessionId)) throw ApiError.badRequest('Invalid session id');

  const session = await Session.findById(input.sessionId);
  if (!session) throw ApiError.notFound('Session not found');

  const isTeacher = String(session.teacher) === reviewerId;
  const isLearner = String(session.learner) === reviewerId;
  if (!isTeacher && !isLearner) throw ApiError.forbidden('You were not part of this session');

  if (session.status !== 'COMPLETED') {
    throw ApiError.badRequest('You can only review a session once both students mark it complete');
  }

  const revieweeId = isTeacher ? session.learner : session.teacher;

  let review: ReviewDoc;
  try {
    review = await Review.create({
      session: session._id,
      reviewer: reviewerId,
      reviewee: revieweeId,
      skill: session.skill,
      rating: input.rating,
      comment: input.comment,
    });
  } catch (err) {
    if (typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000) {
      throw ApiError.conflict('You have already reviewed this session');
    }
    throw err;
  }

  await recalculateRating(revieweeId);
  await awardPoints(reviewerId, POINTS.REVIEW_GIVEN);
  if (input.rating === 5) await awardPoints(revieweeId, POINTS.FIVE_STAR_RECEIVED);
  await evaluateBadges(revieweeId);

  const reviewer = await User.findById(reviewerId).select('name').lean();
  await notify({
    user: revieweeId,
    type: 'REVIEW_RECEIVED',
    title: `${input.rating}-star review received`,
    body: `${reviewer?.name ?? 'A student'} rated your session${input.comment ? `: "${input.comment.slice(0, 80)}"` : ''}`,
    data: { reviewId: String(review._id), screen: 'Reviews' },
  });

  return review;
}

export async function listForUser(
  userId: string,
  page: number,
  limit: number,
): Promise<Paginated<unknown>> {
  if (!Types.ObjectId.isValid(userId)) throw ApiError.badRequest('Invalid user id');

  const filter = { reviewee: new Types.ObjectId(userId), hidden: false };
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Review.find(filter)
      .populate('reviewer', 'name profileImage college')
      .populate('skill', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Review.countDocuments(filter),
  ]);

  return paginate(items, total, { page, limit });
}

export async function listWritten(
  reviewerId: string,
  page: number,
  limit: number,
): Promise<Paginated<unknown>> {
  const filter = { reviewer: new Types.ObjectId(reviewerId) };
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Review.find(filter)
      .populate('reviewee', 'name profileImage')
      .populate('skill', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Review.countDocuments(filter),
  ]);

  return paginate(items, total, { page, limit });
}

/** Completed sessions the caller has not reviewed yet. */
export async function pendingReviews(userId: string): Promise<unknown[]> {
  const uid = new Types.ObjectId(userId);

  const completed = await Session.find({
    status: 'COMPLETED',
    $or: [{ teacher: uid }, { learner: uid }],
  })
    .populate('teacher', 'name profileImage')
    .populate('learner', 'name profileImage')
    .populate('skill', 'name')
    .sort({ completedAt: -1 })
    .limit(50)
    .lean();

  if (completed.length === 0) return [];

  const reviewed = await Review.find({
    reviewer: uid,
    session: { $in: completed.map((s) => s._id) },
  })
    .select('session')
    .lean();

  const done = new Set(reviewed.map((r) => String(r.session)));
  return completed.filter((s) => !done.has(String(s._id)));
}

export async function updateReview(
  reviewId: string,
  reviewerId: string,
  patch: { rating?: number; comment?: string },
): Promise<ReviewDoc> {
  const review = await Review.findOne({ _id: reviewId, reviewer: reviewerId });
  if (!review) throw ApiError.notFound('Review not found');

  if (Date.now() - review.createdAt.getTime() > EDIT_WINDOW_MS) {
    throw ApiError.forbidden('Reviews can only be edited within 24 hours of posting');
  }

  if (patch.rating !== undefined) review.rating = patch.rating;
  if (patch.comment !== undefined) review.comment = patch.comment;
  await review.save();

  await recalculateRating(review.reviewee);
  return review;
}

export async function deleteReview(reviewId: string, reviewerId: string): Promise<void> {
  const review = await Review.findOne({ _id: reviewId, reviewer: reviewerId });
  if (!review) throw ApiError.notFound('Review not found');

  if (Date.now() - review.createdAt.getTime() > EDIT_WINDOW_MS) {
    throw ApiError.forbidden('Reviews can only be withdrawn within 24 hours of posting');
  }

  const revieweeId = review.reviewee;
  await review.deleteOne();
  await recalculateRating(revieweeId);
}
