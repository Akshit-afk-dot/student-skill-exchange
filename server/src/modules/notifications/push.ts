import { env, pushEnabled } from '../../config/env';
import { logger } from '../../config/logger';
import { User } from '../../models';

/**
 * Firebase Cloud Messaging wrapper.
 *
 * firebase-admin is loaded lazily and only when credentials exist, so the server boots
 * (and the test suite runs) with no Firebase project attached. Push is an enhancement;
 * every notification is also persisted in the database and delivered over the socket.
 */

type Messaging = {
  sendEachForMulticast(message: {
    tokens: string[];
    notification: { title: string; body: string };
    data?: Record<string, string>;
  }): Promise<{ responses: Array<{ success: boolean; error?: { code: string } }> }>;
};

let messaging: Messaging | null = null;
let initialised = false;

function getMessaging(): Messaging | null {
  if (initialised) return messaging;
  initialised = true;

  if (!pushEnabled) {
    logger.info('FCM credentials absent — push notifications disabled');
    return null;
  }

  try {
    // Loaded lazily via require so the (large) SDK is never pulled in when push is off.
    // firebase-admin v13+ exposes a modular API from these sub-paths.
    const { initializeApp, getApps, cert } = require('firebase-admin/app') as typeof import('firebase-admin/app');
    const { getMessaging } = require('firebase-admin/messaging') as typeof import('firebase-admin/messaging');

    const existing = getApps();
    const app =
      existing.length > 0 && existing[0]
        ? existing[0]
        : initializeApp({
            credential: cert({
              projectId: env.FIREBASE_PROJECT_ID!,
              clientEmail: env.FIREBASE_CLIENT_EMAIL!,
              // Private keys arrive from .env with literal backslash-n sequences,
              // which must be turned back into real newlines before the SDK parses them.
              privateKey: env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
            }),
          });

    messaging = getMessaging(app) as unknown as Messaging;
    logger.info('FCM initialised');
  } catch (err) {
    logger.error({ err }, 'Failed to initialise FCM — push notifications disabled');
    messaging = null;
  }
  return messaging;
}

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Delivers a push to every device registered to a user and prunes tokens the service
 * reports as dead, so the token list cannot grow stale forever.
 */
export async function sendPush(userId: string, payload: PushPayload): Promise<void> {
  const fcm = getMessaging();
  if (!fcm) return;

  const user = await User.findById(userId).select('+pushTokens').lean();
  const tokens = user?.pushTokens ?? [];
  if (tokens.length === 0) return;

  try {
    const result = await fcm.sendEachForMulticast({
      tokens,
      notification: { title: payload.title, body: payload.body },
      data: payload.data ?? {},
    });

    const dead: string[] = [];
    result.responses.forEach((response, index) => {
      const token = tokens[index];
      if (!token || response.success) return;
      const code = response.error?.code ?? '';
      if (
        code.includes('registration-token-not-registered') ||
        code.includes('invalid-argument') ||
        code.includes('invalid-registration-token')
      ) {
        dead.push(token);
      }
    });

    if (dead.length > 0) {
      await User.updateOne({ _id: userId }, { $pull: { pushTokens: { $in: dead } } });
      logger.debug({ userId, removed: dead.length }, 'Pruned dead push tokens');
    }
  } catch (err) {
    logger.error({ err, userId }, 'Push delivery failed');
  }
}

export async function registerPushToken(userId: string, token: string): Promise<void> {
  // $addToSet keeps the list free of duplicates when an app reinstalls.
  await User.updateOne({ _id: userId }, { $addToSet: { pushTokens: token } });
}

export async function unregisterPushToken(userId: string, token: string): Promise<void> {
  await User.updateOne({ _id: userId }, { $pull: { pushTokens: token } });
}
