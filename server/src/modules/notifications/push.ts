import { env, pushEnabled } from '../../config/env';
import { logger } from '../../config/logger';
import { Notification, User } from '../../models';
import {
  NOTIFICATION_CATEGORY,
  type NotificationCategory,
  type NotificationType,
} from '../../types/domain';

/**
 * Push delivery through Expo's push service.
 *
 * Expo holds the Firebase (Android) and Apple (iOS) credentials and forwards each message
 * to the right one, so this server needs no secret of its own and one token format covers
 * both platforms. Every notification is also stored and sent over the socket
 * (service.ts); push is what reaches a phone whose app is closed.
 *
 * Docs: https://docs.expo.dev/push-notifications/sending-notifications/
 */

const SEND_URL = 'https://exp.host/--/api/v2/push/send';
const RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';

/** An Expo push token: `ExponentPushToken[...]` (or the newer `ExpoPushToken[...]`). */
export const EXPO_PUSH_TOKEN = /^Expo(nent)?PushToken\[[^\]\s]{8,200}\]$/;

/** Signed in on more phones than this, the oldest stops getting pushes. */
export const MAX_PUSH_TOKENS = 10;

/**
 * How each category behaves on the phone.
 *
 * - channelId: the Android channel the app creates at start-up (same ids as the
 *   categories). It sets importance, sound and vibration, and the student can change it in
 *   the phone's settings.
 * - icon: the small status-bar icon on Android, a white symbol for the kind of event. The
 *   app's build adds these drawables (mobile/plugins/withNotificationIcons.js).
 * - priority: "high" may wake a sleeping Android phone, so only for things that cannot
 *   wait.
 * - interruptionLevel (iOS): reminders are "time-sensitive" because they are about the
 *   next hour, which is exactly what Apple reserves that level for. Achievements are
 *   "passive": nice to know, never worth lighting up the screen.
 * - relevanceScore (iOS): which notification iOS features in a summary.
 * - ttl: how long an undelivered push is worth delivering. A week-old "new message" is
 *   still useful; reminders get an exact expiry instead (their session's start).
 */
interface Delivery {
  channelId: NotificationCategory;
  icon: string;
  priority: 'default' | 'normal' | 'high';
  sound: boolean;
  interruptionLevel: 'active' | 'passive' | 'time-sensitive';
  relevanceScore: number;
  ttlSeconds: number;
}

const DAY = 24 * 60 * 60;

export const DELIVERY: Record<NotificationCategory, Delivery> = {
  messages: {
    channelId: 'messages',
    icon: 'notification_messages',
    priority: 'high',
    sound: true,
    interruptionLevel: 'active',
    relevanceScore: 0.9,
    ttlSeconds: 3 * DAY,
  },
  requests: {
    channelId: 'requests',
    icon: 'notification_requests',
    priority: 'high',
    sound: true,
    interruptionLevel: 'active',
    relevanceScore: 0.8,
    ttlSeconds: 7 * DAY,
  },
  reminders: {
    channelId: 'reminders',
    icon: 'notification_reminders',
    priority: 'high',
    sound: true,
    interruptionLevel: 'time-sensitive',
    relevanceScore: 1,
    ttlSeconds: 2 * 60 * 60,
  },
  sessions: {
    channelId: 'sessions',
    icon: 'notification_sessions',
    priority: 'default',
    sound: true,
    interruptionLevel: 'active',
    relevanceScore: 0.6,
    ttlSeconds: 3 * DAY,
  },
  achievements: {
    channelId: 'achievements',
    icon: 'notification_achievements',
    priority: 'default',
    sound: false,
    interruptionLevel: 'passive',
    relevanceScore: 0.3,
    ttlSeconds: 7 * DAY,
  },
  account: {
    channelId: 'account',
    icon: 'notification_icon',
    priority: 'high',
    sound: true,
    interruptionLevel: 'active',
    relevanceScore: 0.7,
    ttlSeconds: 7 * DAY,
  },
};

/** One message in Expo's request format. Only the fields this app uses. */
export interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  data: Record<string, string>;
  channelId: string;
  icon: string;
  priority: Delivery['priority'];
  sound?: 'default';
  badge: number;
  interruptionLevel: Delivery['interruptionLevel'];
  relevanceScore: number;
  ttl?: number;
  expiration?: number;
  threadId?: string;
  tag?: string;
  collapseId?: string;
}

export interface ExpoTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

/** Sends a batch and returns one ticket per message, in order. Swappable for tests. */
export type PushTransport = (messages: ExpoMessage[]) => Promise<ExpoTicket[]>;

export interface PushInput {
  notificationId: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, string>;
  /** Android: replaces a notification already showing with the same tag. */
  tag?: string;
  /** Groups notifications together in the tray. */
  threadId?: string;
  /** Replaces on both platforms, and coalesces pushes still in transit. */
  collapseId?: string;
  /** Past this moment an undelivered push is dropped. */
  expiresAt?: Date;
}

function headers(): Record<string, string> {
  const out: Record<string, string> = {
    accept: 'application/json',
    'accept-encoding': 'gzip, deflate',
    'content-type': 'application/json',
  };
  if (env.EXPO_ACCESS_TOKEN) out.authorization = `Bearer ${env.EXPO_ACCESS_TOKEN}`;
  return out;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * POSTs to Expo, retrying twice with backoff on the failures Expo says are temporary
 * (429 and 5xx, or no response at all). Anything else is a real error and is not retried.
 */
async function postToExpo<T>(url: string, body: unknown): Promise<T> {
  const delays = [1_000, 4_000];
  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    if (attempt > 0) await sleep(delays[attempt - 1] ?? 4_000);
    const last = attempt === delays.length;

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      // No response at all (network, timeout): worth another try.
      if (last) throw err;
      continue;
    }

    if (res.ok) return (await res.json()) as T;
    const temporary = res.status === 429 || res.status >= 500;
    if (!temporary || last) {
      throw new Error(`Expo push ${res.status}: ${(await res.text()).slice(0, 300)}`);
    }
  }
  throw new Error('Expo push: out of retries');
}

const expoTransport: PushTransport = async (messages) => {
  const tickets: ExpoTicket[] = [];
  // Expo accepts at most 100 messages per request.
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    const res = await postToExpo<{ data?: ExpoTicket[]; errors?: unknown[] }>(SEND_URL, chunk);
    if (!res.data) throw new Error(`Expo push rejected the request: ${JSON.stringify(res.errors).slice(0, 300)}`);
    tickets.push(...res.data);
  }
  return tickets;
};

let transport: PushTransport | null = pushEnabled ? expoTransport : null;

/** Tests swap in a fake; null turns push off. */
export function setPushTransport(next: PushTransport | null): void {
  transport = next;
}

/*
 * Receipts. A ticket only says Expo accepted the message; the receipt, ready some minutes
 * later, says whether Apple or Google took it. "DeviceNotRegistered" there means the app
 * was uninstalled or notifications were turned off, and Expo asks senders to stop using
 * that token. Kept in memory: losing them on a restart only delays that clean-up until
 * the next push to the same phone fails at the ticket stage.
 */
interface PendingReceipt {
  userId: string;
  token: string;
  sentAt: number;
}
const pendingReceipts = new Map<string, PendingReceipt>();
const MAX_PENDING_RECEIPTS = 10_000;

async function forgetToken(userId: string, token: string, reason: string): Promise<void> {
  await User.updateOne({ _id: userId }, { $pull: { pushTokens: token } });
  logger.info({ userId, reason }, 'Removed a push token the phone no longer accepts');
}

async function handleTickets(userId: string, messages: ExpoMessage[], tickets: ExpoTicket[]): Promise<void> {
  for (let i = 0; i < messages.length; i += 1) {
    const ticket = tickets[i];
    const token = messages[i]?.to;
    if (!ticket || !token) continue;
    if (ticket.status === 'ok' && ticket.id) {
      if (pendingReceipts.size < MAX_PENDING_RECEIPTS) {
        pendingReceipts.set(ticket.id, { userId, token, sentAt: Date.now() });
      }
    } else if (ticket.details?.error === 'DeviceNotRegistered') {
      await forgetToken(userId, token, 'ticket');
    } else if (ticket.status === 'error') {
      logger.warn({ userId, error: ticket.details?.error, message: ticket.message }, 'Push rejected by Expo');
    }
  }
}

/**
 * Checks receipts that are at least 15 minutes old (Expo's advice) and drops tokens for
 * phones that no longer accept pushes. Run by the jobs scheduler.
 */
export async function checkPushReceipts(now = Date.now()): Promise<void> {
  const due: string[] = [];
  for (const [id, pending] of pendingReceipts) {
    if (now - pending.sentAt > 24 * 60 * 60_000) pendingReceipts.delete(id); // Expo keeps them a day.
    else if (now - pending.sentAt >= 15 * 60_000 && due.length < 1000) due.push(id);
  }
  if (due.length === 0 || !transport) return;
  if (transport !== expoTransport) {
    for (const id of due) pendingReceipts.delete(id);
    return;
  }

  const res = await postToExpo<{ data?: Record<string, ExpoTicket> }>(RECEIPTS_URL, { ids: due });
  for (const id of due) {
    const pending = pendingReceipts.get(id);
    const receipt = res.data?.[id];
    pendingReceipts.delete(id);
    if (!pending || !receipt || receipt.status === 'ok') continue;
    if (receipt.details?.error === 'DeviceNotRegistered') {
      await forgetToken(pending.userId, pending.token, 'receipt');
    } else {
      logger.warn({ error: receipt.details?.error, message: receipt.message }, 'Push receipt reported an error');
    }
  }
}

/** Builds the Expo message for one phone. Pure, so the shape is testable. */
export function buildMessage(token: string, input: PushInput, badge: number): ExpoMessage {
  const delivery = DELIVERY[NOTIFICATION_CATEGORY[input.type]];
  const message: ExpoMessage = {
    to: token,
    title: input.title,
    body: input.body,
    data: { ...input.data, type: input.type, notificationId: input.notificationId },
    channelId: delivery.channelId,
    icon: delivery.icon,
    priority: delivery.priority,
    badge,
    interruptionLevel: delivery.interruptionLevel,
    relevanceScore: delivery.relevanceScore,
  };
  if (delivery.sound) message.sound = 'default';
  if (input.expiresAt) message.expiration = Math.floor(input.expiresAt.getTime() / 1000);
  else message.ttl = delivery.ttlSeconds;
  if (input.threadId) message.threadId = input.threadId;
  if (input.tag ?? input.collapseId) message.tag = input.tag ?? input.collapseId;
  if (input.collapseId) message.collapseId = input.collapseId;
  return message;
}

/**
 * Sends a notification to every phone the student is signed in on, unless they have
 * turned that kind of notification off. Never throws: push is best effort, and the
 * notification is already in the app either way.
 */
export async function sendPush(userId: string, input: PushInput): Promise<void> {
  if (!transport) return;
  try {
    const user = await User.findById(userId).select('+pushTokens notificationPrefs').lean();
    const tokens = (user?.pushTokens ?? []).filter((token) => EXPO_PUSH_TOKEN.test(token));
    if (!user || tokens.length === 0) return;

    const category = NOTIFICATION_CATEGORY[input.type];
    if (category !== 'account' && user.notificationPrefs?.[category] === false) return;

    // The app icon badge counts what is still unread, this notification included.
    const badge = await Notification.countDocuments({ user: userId, read: false });
    const messages = tokens.map((token) => buildMessage(token, input, badge));
    const tickets = await transport(messages);
    await handleTickets(userId, messages, tickets);
  } catch (err) {
    logger.error({ err, userId, type: input.type }, 'Push delivery failed');
  }
}

/**
 * Registers this phone for a student's pushes.
 *
 * A phone belongs to whoever signed in on it last, so the token is first taken off every
 * other account: otherwise the previous student's messages would keep arriving on it.
 * Newest last, capped, so a student who reinstalls often does not collect dead tokens.
 */
export async function registerPushToken(userId: string, token: string, timezone?: string): Promise<void> {
  await User.updateMany({ _id: { $ne: userId }, pushTokens: token }, { $pull: { pushTokens: token } });
  await User.updateOne({ _id: userId }, { $pull: { pushTokens: token } });
  await User.updateOne(
    { _id: userId },
    {
      $push: { pushTokens: { $each: [token], $slice: -MAX_PUSH_TOKENS } },
      // The phone knows the student's time zone; notification times are written in it.
      ...(timezone ? { $set: { timezone } } : {}),
    },
  );
}

export async function unregisterPushToken(userId: string, token: string): Promise<void> {
  await User.updateOne({ _id: userId }, { $pull: { pushTokens: token } });
}
