import { Types } from 'mongoose';
import {
  Connection,
  Conversation,
  Message,
  User,
  type ConversationDoc,
  type IMessageAttachment,
  type MessageDoc,
} from '../../models';
import { RT, emitToUser } from '../../realtime/bus';
import type { MessageType } from '../../types/domain';
import { ApiError } from '../../utils/errors';
import { blockedByUser } from '../blocks/service';
import { paginate, type Paginated } from '../../utils/pagination';
import { notify } from '../notifications/service';

/** Loads a conversation only if the caller is one of its two participants. */
export async function assertMember(
  conversationId: string,
  userId: string,
): Promise<ConversationDoc> {
  if (!Types.ObjectId.isValid(conversationId)) throw ApiError.badRequest('Invalid conversation id');
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) throw ApiError.notFound('Conversation not found');

  const isMember = conversation.participants.some((p) => String(p) === userId);
  // 404 rather than 403: a non-member should not learn that this conversation exists.
  if (!isMember) throw ApiError.notFound('Conversation not found');

  return conversation;
}

export function otherParticipant(conversation: ConversationDoc, userId: string): Types.ObjectId {
  const other = conversation.participants.find((p) => String(p) !== userId);
  if (!other) throw ApiError.internal('Conversation is missing a second participant');
  return other;
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

export async function listConversations(
  userId: string,
  page: number,
  limit: number,
): Promise<Paginated<ConversationView>> {
  // Conversations with students the caller blocked drop out of their list. The other
  // side keeps theirs, but its inactive connection already stops any new message.
  const hidden = await blockedByUser(userId);
  const filter = { participants: { $all: [new Types.ObjectId(userId)], $nin: hidden } };
  const skip = (page - 1) * limit;

  const [rows, total] = await Promise.all([
    Conversation.find(filter)
      .populate<{ participants: Array<{ _id: Types.ObjectId; name: string; profileImage?: string; college?: string; isOnline: boolean; lastSeenAt?: Date }> }>(
        'participants',
        'name profileImage college isOnline lastSeenAt',
      )
      // Conversations with no messages yet sort by creation, which `updatedAt` covers.
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Conversation.countDocuments(filter),
  ]);

  const items: ConversationView[] = rows.map((row) => {
    const other = row.participants.find((p) => String(p._id) !== userId) ?? row.participants[0];
    const unreadMap = (row.unread ?? {}) as unknown as Record<string, number>;

    const view: ConversationView = {
      id: String(row._id),
      participant: {
        id: String(other?._id ?? ''),
        name: other?.name ?? 'Unknown student',
        isOnline: other?.isOnline ?? false,
      },
      unread: unreadMap[userId] ?? 0,
      updatedAt: new Date(row.updatedAt).toISOString(),
    };
    if (other?.profileImage) view.participant.profileImage = other.profileImage;
    if (other?.college) view.participant.college = other.college;
    if (other?.lastSeenAt) view.participant.lastSeenAt = new Date(other.lastSeenAt).toISOString();
    if (row.lastMessagePreview && row.lastMessageAt) {
      view.lastMessage = {
        body: row.lastMessagePreview,
        at: new Date(row.lastMessageAt).toISOString(),
        type: 'TEXT',
      };
    }
    return view;
  });

  return paginate(items, total, { page, limit });
}

/**
 * Message history, newest first.
 *
 * Paginated by `before` cursor rather than page number: a page-numbered chat log
 * shifts under the reader every time a new message arrives.
 */
export async function getMessages(
  conversationId: string,
  userId: string,
  options: { limit: number; before?: string },
): Promise<{ items: MessageDoc[]; hasMore: boolean; nextCursor?: string }> {
  await assertMember(conversationId, userId);

  const filter: Record<string, unknown> = { conversation: conversationId, deletedAt: null };
  if (options.before) {
    if (!Types.ObjectId.isValid(options.before)) throw ApiError.badRequest('Invalid cursor');
    // ObjectIds are monotonic by creation time, so they double as a stable cursor.
    filter._id = { $lt: new Types.ObjectId(options.before) };
  }

  // Fetch one extra row to detect whether another page exists.
  const rows = await Message.find(filter)
    .sort({ _id: -1 })
    .limit(options.limit + 1)
    .populate('sender', 'name profileImage')
    .lean();

  const hasMore = rows.length > options.limit;
  const items = (hasMore ? rows.slice(0, options.limit) : rows) as unknown as MessageDoc[];
  const last = items[items.length - 1];

  const result: { items: MessageDoc[]; hasMore: boolean; nextCursor?: string } = { items, hasMore };
  if (hasMore && last) result.nextCursor = String(last._id);
  return result;
}

export interface SendMessageInput {
  body?: string;
  type?: MessageType;
  attachment?: IMessageAttachment;
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  input: SendMessageInput,
): Promise<MessageDoc> {
  const conversation = await assertMember(conversationId, senderId);
  const receiverId = otherParticipant(conversation, senderId);

  // Chat is gated on an accepted request: without that gate the platform becomes a
  // channel for messaging strangers.
  const connected = await Connection.exists({ pairKey: conversation.pairKey, active: true });
  if (!connected) {
    throw ApiError.forbidden('You can only message students you are connected with');
  }

  const type = input.type ?? 'TEXT';
  const body = input.body?.trim() ?? '';
  if (type === 'TEXT' && !body) throw ApiError.badRequest('Message cannot be empty');
  if (type !== 'TEXT' && type !== 'SYSTEM' && !input.attachment) {
    throw ApiError.badRequest('An attachment is required for this message type');
  }

  const message = await Message.create({
    conversation: conversation._id,
    sender: senderId,
    receiver: receiverId,
    body,
    type,
    attachment: input.attachment,
    deliveredAt: new Date(),
  });

  const preview =
    type === 'TEXT' ? body.slice(0, 200) : type === 'IMAGE' ? '📷 Photo' : '📎 Attachment';

  await Conversation.updateOne(
    { _id: conversation._id },
    {
      $set: {
        lastMessage: message._id,
        lastMessageAt: message.createdAt,
        lastMessagePreview: preview,
      },
      // Only the recipient's counter moves; the sender has obviously read their own message.
      $inc: { [`unread.${String(receiverId)}`]: 1 },
    },
  );

  const populated = await message.populate('sender', 'name profileImage');
  emitToUser(String(receiverId), RT.MESSAGE_NEW, populated.toJSON());
  emitToUser(senderId, RT.MESSAGE_NEW, populated.toJSON());

  const sender = await User.findById(senderId).select('name').lean();
  await notify({
    user: receiverId,
    type: 'MESSAGE_RECEIVED',
    title: sender?.name ?? 'New message',
    body: preview,
    data: { conversationId: String(conversation._id), screen: 'Chat' },
  });

  return populated;
}

export async function markConversationRead(
  conversationId: string,
  userId: string,
): Promise<number> {
  const conversation = await assertMember(conversationId, userId);

  const result = await Message.updateMany(
    { conversation: conversation._id, receiver: userId, readAt: null },
    { $set: { readAt: new Date() } },
  );

  await Conversation.updateOne(
    { _id: conversation._id },
    { $set: { [`unread.${userId}`]: 0 } },
  );

  if (result.modifiedCount > 0) {
    // Lets the sender's UI flip its ticks without polling.
    emitToUser(String(otherParticipant(conversation, userId)), RT.MESSAGE_READ, {
      conversationId: String(conversation._id),
      readerId: userId,
      count: result.modifiedCount,
    });
  }

  return result.modifiedCount;
}

export async function totalUnread(userId: string): Promise<number> {
  return Message.countDocuments({ receiver: userId, readAt: null, deletedAt: null });
}

/** Soft-deletes a message. Only the author may remove their own message. */
export async function deleteMessage(messageId: string, userId: string): Promise<void> {
  const message = await Message.findById(messageId);
  if (!message) throw ApiError.notFound('Message not found');
  if (String(message.sender) !== userId) {
    throw ApiError.forbidden('You can only delete your own messages');
  }
  message.deletedAt = new Date();
  message.body = '';
  await message.save();
}
