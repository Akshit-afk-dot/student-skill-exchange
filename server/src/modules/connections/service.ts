import { Types } from 'mongoose';
import { Connection, Conversation, pairKeyOf } from '../../models';
import { ApiError } from '../../utils/errors';
import { paginate, type Paginated } from '../../utils/pagination';

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

export async function listConnections(
  userId: string,
  page: number,
  limit: number,
): Promise<Paginated<ConnectionView>> {
  const filter = { participants: new Types.ObjectId(userId), active: true };
  const skip = (page - 1) * limit;

  const [rows, total] = await Promise.all([
    Connection.find(filter)
      .populate<{
        participants: Array<{
          _id: Types.ObjectId;
          name: string;
          profileImage?: string;
          college?: string;
          department?: string;
          ratingAvg: number;
          isOnline: boolean;
        }>;
      }>('participants', 'name profileImage college department ratingAvg isOnline')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Connection.countDocuments(filter),
  ]);

  const items: ConnectionView[] = rows.map((row) => {
    const other = row.participants.find((p) => String(p._id) !== userId) ?? row.participants[0];
    const view: ConnectionView = {
      id: String(row._id),
      student: {
        id: String(other?._id ?? ''),
        name: other?.name ?? 'Unknown student',
        rating: Number((other?.ratingAvg ?? 0).toFixed(2)),
        isOnline: other?.isOnline ?? false,
      },
      connectedAt: new Date(row.createdAt).toISOString(),
    };
    if (row.conversation) view.conversationId = String(row.conversation);
    if (other?.profileImage) view.student.profileImage = other.profileImage;
    if (other?.college) view.student.college = other.college;
    if (other?.department) view.student.department = other.department;
    return view;
  });

  return paginate(items, total, { page, limit });
}

/**
 * Ends a connection.
 *
 * The record is deactivated rather than deleted so past sessions and reviews keep their
 * context, and so the pair can reconnect later without tripping the unique index.
 * Message history stays intact but `chat.sendMessage` will refuse new messages.
 */
export async function removeConnection(connectionId: string, userId: string): Promise<void> {
  if (!Types.ObjectId.isValid(connectionId)) throw ApiError.badRequest('Invalid connection id');

  const connection = await Connection.findOne({
    _id: connectionId,
    participants: new Types.ObjectId(userId),
  });
  if (!connection) throw ApiError.notFound('Connection not found');

  connection.active = false;
  await connection.save();
}

export async function isConnected(a: string, b: string): Promise<boolean> {
  return Boolean(await Connection.exists({ pairKey: pairKeyOf(a, b), active: true }));
}

export async function getConversationFor(
  userId: string,
  otherId: string,
): Promise<string | null> {
  const conversation = await Conversation.findOne({ pairKey: pairKeyOf(userId, otherId) })
    .select('_id')
    .lean();
  return conversation ? String(conversation._id) : null;
}
