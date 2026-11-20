import type { Types } from 'mongoose';
import { logger } from '../../config/logger';
import { Notification, User } from '../../models';
import { RT, emitToUser } from '../../realtime/bus';
import type { NotificationType } from '../../types/domain';
import { sendPush } from './push';

export interface NotifyInput {
  user: string | Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  /**
   * Strings only. `screen` and an id say where opening it lands; `actorId`, `actorName`
   * and `actorImage` say who caused it, so the app can show their face.
   */
  data?: Record<string, string | undefined>;
  /** Set false for low-value events that should not buzz a phone. */
  push?: boolean;
  /** Android: a newer notification with the same tag replaces the one showing. */
  tag?: string;
  /** Stacks related notifications together in the tray. */
  threadId?: string;
  /** Replaces on both platforms: for updates where only the latest matters. */
  collapseId?: string;
  /** An undelivered push is dropped after this (a reminder for a session that started). */
  expiresAt?: Date;
}

/** Pushes still in flight. Only tests wait on these; requests never do. */
const inFlight = new Set<Promise<void>>();

/** Resolves once every push started so far has finished. For tests. */
export async function pushesSettled(): Promise<void> {
  while (inFlight.size > 0) await Promise.allSettled([...inFlight]);
}

/** The time zone a student's notification times are written in. */
export async function timeZoneOf(userId: string | Types.ObjectId): Promise<string> {
  const user = await User.findById(userId).select('timezone').lean();
  return user?.timezone || 'Asia/Kolkata';
}

/** Who caused a notification, as data the app can draw: a name, and a photo if they have one. */
export function actorData(actor: { _id: unknown; name?: string; profileImage?: string } | null | undefined) {
  if (!actor) return {};
  return {
    actorId: String(actor._id),
    actorName: actor.name ?? '',
    ...(actor.profileImage ? { actorImage: actor.profileImage } : {}),
  };
}

/**
 * Fan-out for a single user-facing event across all three channels:
 * persisted (notification centre), realtime (socket, if connected), push (Expo).
 *
 * Delivery is best-effort by design: a notification failure must never roll back the
 * action that produced it, so this never throws. Push is not awaited either: a slow
 * push service must not make sending a chat message slow.
 */
export async function notify(input: NotifyInput): Promise<void> {
  const userId = String(input.user);
  try {
    const data = Object.fromEntries(
      Object.entries(input.data ?? {}).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    );
    const doc = await Notification.create({
      user: input.user,
      type: input.type,
      title: input.title,
      body: input.body,
      data,
    });

    emitToUser(userId, RT.NOTIFICATION, doc.toJSON());

    if (input.push !== false) {
      const job = sendPush(userId, {
        notificationId: String(doc._id),
        type: input.type,
        title: input.title,
        body: input.body,
        data,
        tag: input.tag,
        threadId: input.threadId,
        collapseId: input.collapseId,
        expiresAt: input.expiresAt,
      }).finally(() => inFlight.delete(job));
      inFlight.add(job);
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
  if (result.modifiedCount > 0) emitToUser(userId, RT.NOTIFICATION_READ, { count: result.modifiedCount });
  return result.modifiedCount;
}

export async function markAllRead(userId: string): Promise<number> {
  const result = await Notification.updateMany(
    { user: userId, read: false },
    { $set: { read: true, readAt: new Date() } },
  );
  if (result.modifiedCount > 0) emitToUser(userId, RT.NOTIFICATION_READ, { count: result.modifiedCount });
  return result.modifiedCount;
}

/**
 * Clears a user's notifications about one thing once they have dealt with it: read the
 * chat, answered the request, confirmed the session, written the review. The app's
 * notification centre lists only what still needs attention, so this is what takes an
 * entry off it without the student having to dismiss it by hand.
 *
 * `data` narrows the match to the thing in question (a conversation, request or session).
 * Best-effort, like `notify`: a failure here must not fail the action that triggered it.
 */
export async function resolveNotifications(
  user: string | Types.ObjectId,
  types: NotificationType[],
  data: Record<string, string>,
): Promise<void> {
  const userId = String(user);
  try {
    const filter: Record<string, unknown> = { user: userId, read: false, type: { $in: types } };
    for (const [key, value] of Object.entries(data)) filter[`data.${key}`] = value;
    const result = await Notification.updateMany(filter, { $set: { read: true, readAt: new Date() } });
    if (result.modifiedCount > 0) emitToUser(userId, RT.NOTIFICATION_READ, { count: result.modifiedCount });
  } catch (err) {
    logger.error({ err, userId, types }, 'Failed to resolve notifications');
  }
}

export async function unreadCount(userId: string): Promise<number> {
  return Notification.countDocuments({ user: userId, read: false });
}
