import { Types } from 'mongoose';
import { Block, Connection, LearningRequest, User, pairKeyOf } from '../../models';
import { ApiError } from '../../utils/errors';

/** Everyone this student has blocked or been blocked by. Used to hide them from discovery. */
export async function blockedEitherWay(userId: string | Types.ObjectId): Promise<Types.ObjectId[]> {
  const id = new Types.ObjectId(String(userId));
  const rows = await Block.find({ $or: [{ blocker: id }, { blocked: id }] })
    .select('blocker blocked')
    .lean();
  return rows.map((row) => (row.blocker.equals(id) ? row.blocked : row.blocker));
}

/** Only the students this one chose to block. Used to hide their conversations. */
export async function blockedByUser(userId: string | Types.ObjectId): Promise<Types.ObjectId[]> {
  const rows = await Block.find({ blocker: userId }).select('blocked').lean();
  return rows.map((row) => row.blocked);
}

export async function isBlockedBetween(
  a: string | Types.ObjectId,
  b: string | Types.ObjectId,
): Promise<boolean> {
  const found = await Block.exists({
    $or: [
      { blocker: a, blocked: b },
      { blocker: b, blocked: a },
    ],
  });
  return Boolean(found);
}

export async function relationship(
  viewerId: string,
  otherId: string,
): Promise<{ blockedByMe: boolean; blockedMe: boolean }> {
  const rows = await Block.find({
    $or: [
      { blocker: viewerId, blocked: otherId },
      { blocker: otherId, blocked: viewerId },
    ],
  })
    .select('blocker')
    .lean();
  return {
    blockedByMe: rows.some((row) => String(row.blocker) === viewerId),
    blockedMe: rows.some((row) => String(row.blocker) === otherId),
  };
}

/**
 * Blocks a student.
 *
 * A block ends the relationship as well as preventing new contact: the connection that
 * gates chat and scheduling goes inactive, and requests still waiting between the two
 * are cancelled. Unblocking later does not restore the connection — they would need to
 * send a new request, which is the point.
 */
export async function blockUser(blockerId: string, targetId: string): Promise<void> {
  if (blockerId === targetId) throw ApiError.badRequest('You cannot block yourself');
  if (!(await User.exists({ _id: targetId }))) throw ApiError.notFound('Student not found');

  try {
    await Block.updateOne(
      { blocker: blockerId, blocked: targetId },
      { $setOnInsert: { blocker: blockerId, blocked: targetId } },
      { upsert: true },
    );
  } catch (err) {
    // Two taps racing on the upsert: the unique index means the block exists either way.
    if ((err as { code?: number }).code !== 11000) throw err;
  }

  await Promise.all([
    Connection.updateOne({ pairKey: pairKeyOf(blockerId, targetId) }, { $set: { active: false } }),
    LearningRequest.updateMany(
      {
        status: 'PENDING',
        $or: [
          { sender: blockerId, receiver: targetId },
          { sender: targetId, receiver: blockerId },
        ],
      },
      { $set: { status: 'CANCELLED' } },
    ),
  ]);
}

export async function unblockUser(blockerId: string, targetId: string): Promise<void> {
  await Block.deleteOne({ blocker: blockerId, blocked: targetId });
}

export interface BlockedStudent {
  id: string;
  name: string;
  college?: string;
  profileImage?: string;
  blockedAt: string;
}

export async function listBlocked(blockerId: string): Promise<BlockedStudent[]> {
  const rows = await Block.find({ blocker: blockerId })
    .sort({ createdAt: -1 })
    .populate<{ blocked: { _id: Types.ObjectId; name: string; college?: string; profileImage?: string } | null }>(
      'blocked',
      'name college profileImage',
    )
    .lean();

  return rows.flatMap((row) => {
    // A blocked account that was since deleted leaves nothing to show or unblock.
    if (!row.blocked) return [];
    const out: BlockedStudent = {
      id: String(row.blocked._id),
      name: row.blocked.name,
      blockedAt: new Date(row.createdAt).toISOString(),
    };
    if (row.blocked.college) out.college = row.blocked.college;
    if (row.blocked.profileImage) out.profileImage = row.blocked.profileImage;
    return [out];
  });
}
