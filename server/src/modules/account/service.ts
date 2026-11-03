import { Types } from 'mongoose';
import { logger } from '../../config/logger';
import {
  Block,
  Connection,
  Conversation,
  LearningRequest,
  Message,
  Notification,
  RefreshToken,
  Report,
  Review,
  Session,
  Skill,
  User,
  UserSkill,
  type UserDoc,
} from '../../models';
import { ApiError } from '../../utils/errors';
import { notify } from '../notifications/service';
import { deleteFile, keyFromUrl } from '../uploads/storage';
import { recalculateRating } from '../users/service';

/**
 * Confirms that the person deleting an account owns it.
 *
 * A valid session alone is not enough for something irreversible — an unlocked phone
 * would do — so an account with a password must re-enter it. A Google-only account has
 * no password to ask for, and its session is the proof. Administrators cannot delete
 * themselves this way, so the dashboard cannot be locked out by accident.
 *
 * Failures are 400s, never 401s: the mobile client treats a 401 as an expired session
 * and signs the user out, which would be a strange answer to a mistyped password.
 */
export async function assertCanDelete(user: UserDoc, password: string | undefined): Promise<void> {
  if (user.role === 'ADMIN') {
    throw ApiError.forbidden('Administrator accounts cannot be deleted from the app');
  }
  const withHash = await User.findById(user._id).select('+passwordHash');
  if (!withHash?.passwordHash) return;

  if (!password) {
    throw new ApiError(400, 'PASSWORD_REQUIRED', 'Enter your password to delete your account');
  }
  if (!(await withHash.verifyPassword(password))) {
    throw new ApiError(400, 'INVALID_PASSWORD', 'That password is incorrect');
  }
}

/**
 * Permanently deletes a student and everything that only exists because of them.
 *
 * What other students keep is decided per collection:
 * - Conversations, messages and connections with the student are removed, since half
 *   of each belongs to the person who asked for deletion.
 * - Reviews they wrote stop counting toward anyone's rating, which is recalculated.
 * - Partners with upcoming sessions are told the session is off rather than finding
 *   it silently gone from their calendar.
 * - Running totals (skill teach/learn counts) are reduced by their contribution.
 *
 * Mongo transactions need a replica set, which local and test databases are not, so the
 * steps run in sequence and the user document goes last: if anything fails part-way,
 * the account still exists and a retry finishes the job.
 */
export async function deleteAccount(userId: string): Promise<{ email: string; name: string } | null> {
  const id = new Types.ObjectId(userId);
  const user = await User.findById(id).lean();
  if (!user) return null;

  // Skill counters: undo this student's contribution before the rows go.
  const skillCounts = await UserSkill.aggregate<{ _id: { skill: Types.ObjectId; type: string }; n: number }>([
    { $match: { user: id } },
    { $group: { _id: { skill: '$skill', type: '$type' }, n: { $sum: 1 } } },
  ]);
  await Promise.all(
    skillCounts.map((row) =>
      Skill.updateOne(
        { _id: row._id.skill },
        { $inc: { [row._id.type === 'TEACH' ? 'teachCount' : 'learnCount']: -row.n } },
      ),
    ),
  );
  await UserSkill.deleteMany({ user: id });

  // Ratings: reviews this student wrote stop counting toward anyone's average.
  const reviewees = (await Review.distinct('reviewee', { reviewer: id })) as Types.ObjectId[];
  await Review.deleteMany({ $or: [{ reviewer: id }, { reviewee: id }] });
  for (const reviewee of reviewees) await recalculateRating(reviewee);

  // Upcoming sessions: tell each partner before the session disappears.
  const upcoming = await Session.find({
    $or: [{ teacher: id }, { learner: id }],
    status: { $in: ['SCHEDULED', 'CONFIRMED'] },
    scheduledAt: { $gt: new Date() },
  })
    .select('teacher learner')
    .lean();
  for (const session of upcoming) {
    const partner = session.teacher.equals(id) ? session.learner : session.teacher;
    await notify({
      user: partner,
      type: 'SESSION_CANCELLED',
      title: 'Session cancelled',
      body: 'An upcoming session was cancelled because the other student deleted their account.',
      data: { screen: 'MySessions' },
    });
  }
  await Session.deleteMany({ $or: [{ teacher: id }, { learner: id }] });

  // Conversations, including files either side attached, then the links between them.
  const conversationIds = (await Conversation.distinct('_id', { participants: id })) as Types.ObjectId[];
  const attachments = await Message.find({
    conversation: { $in: conversationIds },
    'attachment.url': { $exists: true },
  })
    .select('attachment.url')
    .lean();
  await Message.deleteMany({ conversation: { $in: conversationIds } });
  await Conversation.deleteMany({ _id: { $in: conversationIds } });
  await Connection.deleteMany({ participants: id });
  await LearningRequest.deleteMany({ $or: [{ sender: id }, { receiver: id }] });

  await Promise.all([
    Block.deleteMany({ $or: [{ blocker: id }, { blocked: id }] }),
    Notification.deleteMany({ user: id }),
    RefreshToken.deleteMany({ user: id }),
    Report.deleteMany({ $or: [{ reporter: id }, { reportedUser: id }] }),
    Skill.updateMany({ createdBy: id }, { $unset: { createdBy: 1 } }),
  ]);

  // Stored files last before the account: a failed delete here only leaves an orphan.
  const fileUrls = [user.profileImage, ...attachments.map((m) => m.attachment?.url)].filter(
    (url): url is string => Boolean(url),
  );
  for (const url of fileUrls) {
    const key = keyFromUrl(url);
    if (key) await deleteFile(key);
  }

  await User.deleteOne({ _id: id });
  // The id only: the point of the request is that we stop holding their details.
  logger.info({ userId }, 'Account deleted at the owner’s request');

  return { email: user.email, name: user.name };
}
