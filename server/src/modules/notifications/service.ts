import type { Types } from 'mongoose';
import { logger } from '../../config/logger';
import { Notification } from '../../models';
import { RT, emitToUser } from '../../realtime/bus';
import type { NotificationType } from '../../types/domain';
import { sendPush } from './push';

export interface NotifyInput {
  user: string | Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, string>;
  /** Set false for low-value events that should not buzz a phone. */
  push?: boolean;
}

/**
 * Fan-out for a single user-facing event across all three channels:
 * persisted (notification centre), realtime (socket, if connected), push (FCM).
 *
 * Delivery is best-effort by design: a notification failure must never roll back the
 * action that produced it, so this never throws.
 */
export async function notify(input: NotifyInput): Promise<void> {
  const userId = String(input.user);
  try {
    const doc = await Notification.create({
      user: input.user,
      type: input.type,
      title: input.title,
      body: input.body,
      data: input.data ?? {},
    });

    emitToUser(userId, RT.NOTIFICATION, doc.toJSON());

    if (input.push !== false) {
      await sendPush(userId, {
        title: input.title,
        body: input.body,
        data: { type: input.type, ...(input.data ?? {}) },
      });
    }
  } catch (err) {
    logger.error({ err, userId, type: input.type }, 'Failed to deliver notification');
  }
}

/** Same as `notify`, for several recipients of the same event. */
export async function notifyMany(users: Array<string | Types.ObjectId>, rest: Omit<NotifyInput, 'user'>): Promise<void> {
  await Promise.all(users.map((user) => notify({ user, ...rest })));
}

export async function markRead(userId: string, ids: string[]): Promise<number> {
  const result = await Notification.updateMany(
    { user: userId, _id: { $in: ids }, read: false },
    { $set: { read: true, readAt: new Date() } },
  );
  return result.modifiedCount;
}

export async function markAllRead(userId: string): Promise<number> {
  const result = await Notification.updateMany(
    { user: userId, read: false },
    { $set: { read: true, readAt: new Date() } },
  );
  return result.modifiedCount;
}

export async function unreadCount(userId: string): Promise<number> {
  return Notification.countDocuments({ user: userId, read: false });
}
