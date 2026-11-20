import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useSyncExternalStore } from 'react';
import { Linking, Platform } from 'react-native';
import { auth as authApi } from '../api/endpoints';
import { palettes } from '../theme';
import { prefs } from '../utils/prefs';
import { CATEGORIES } from './kinds';
import type { NotificationData } from './open';

/**
 * The phone's side of push notifications: Android channels, permission, the push token,
 * the app-icon badge and the notification tray.
 *
 * Push only exists on a phone. On the web build every function here is a quiet no-op,
 * and the in-app banner (which runs on the socket) still works.
 */

export const pushSupported = Platform.OS === 'ios' || Platform.OS === 'android';

/**
 * - unsupported: the web build.
 * - undetermined: never asked. Asking shows the system prompt.
 * - denied: said no, but the system will still show its prompt again (Android allows this).
 * - blocked: said no for good. Only the phone's Settings can turn it back on.
 * - granted: on.
 */
export type PushPermission = 'unsupported' | 'undetermined' | 'denied' | 'blocked' | 'granted';

interface PushState {
  permission: PushPermission;
  /** Set when this phone could not be registered for push (no network, or a build without Firebase). */
  registrationError: string | null;
}

let state: PushState = { permission: pushSupported ? 'undetermined' : 'unsupported', registrationError: null };
const listeners = new Set<() => void>();

function setState(patch: Partial<PushState>): void {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

export function usePushState(): PushState {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => state,
    () => state,
  );
}

export function pushPermission(): PushPermission {
  return state.permission;
}

const IMPORTANCE = {
  high: Notifications.AndroidImportance.HIGH,
  default: Notifications.AndroidImportance.DEFAULT,
  low: Notifications.AndroidImportance.LOW,
} as const;

let prepared = false;

/**
 * Runs once at start-up. Creates the Android channels before anything is asked or sent
 * (Android 13 shows no permission prompt until a channel exists, and drops a push aimed
 * at a channel that does not), and tells the system not to draw pushes while the app is
 * open: the in-app banner shows them instead, styled like the rest of the app.
 */
export async function preparePush(): Promise<void> {
  if (!pushSupported || prepared) return;
  prepared = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: false,
      shouldSetBadge: true,
    }),
  });

  if (Platform.OS === 'android') {
    await Promise.all(
      CATEGORIES.map((category) =>
        Notifications.setNotificationChannelAsync(category.id, {
          name: category.label,
          description: category.description,
          importance: IMPORTANCE[category.importance],
          enableVibrate: category.vibration !== null,
          ...(category.vibration ? { vibrationPattern: category.vibration } : {}),
          lightColor: palettes.light.primary,
          // Reviews and badges are good news, not something to count on the app icon.
          showBadge: category.id !== 'achievements',
        }).catch(() => null),
      ),
    );
  }

  await refreshPermission();
}

/** Reads the current permission from the system, which the student may have changed in Settings. */
export async function refreshPermission(): Promise<PushPermission> {
  if (!pushSupported) return 'unsupported';
  try {
    const result = await Notifications.getPermissionsAsync();
    const permission: PushPermission = result.granted
      ? 'granted'
      : result.status === 'undetermined'
        ? 'undetermined'
        : result.canAskAgain
          ? 'denied'
          : 'blocked';
    if (permission !== state.permission) setState({ permission });
    return permission;
  } catch {
    return state.permission;
  }
}

/** Shows the system's permission prompt, then registers the phone if the answer is yes. */
export async function requestPushPermission(): Promise<PushPermission> {
  if (!pushSupported) return 'unsupported';
  try {
    await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
  } catch {
    // Fall through: the refresh below reports whatever the system now says.
  }
  const permission = await refreshPermission();
  if (permission === 'granted') await registerForPush();
  return permission;
}

/** For a "blocked" permission: the phone's settings page for this app. */
export function openPhoneSettings(): void {
  void Linking.openSettings().catch(() => undefined);
}

const TOKEN_KEY = 'sse.push.token';
let registered: string | null = null;

/**
 * Sends this phone's push token to the server, with the phone's time zone so notification
 * times read in the student's own. Safe to call on every launch: the token can change,
 * and the server de-duplicates it.
 */
export async function registerForPush(): Promise<void> {
  if (!pushSupported || state.permission !== 'granted') return;
  if (!Device.isDevice) {
    setState({ registrationError: 'Push notifications need a real phone, not a simulator.' });
    return;
  }
  try {
    const projectId =
      (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId ??
      Constants.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    let timezone: string | undefined;
    try {
      timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
    } catch {
      timezone = undefined;
    }
    await authApi.registerPushToken(token, timezone);
    registered = token;
    await prefs.set(TOKEN_KEY, token);
    if (state.registrationError) setState({ registrationError: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (__DEV__) console.warn('Push registration failed:', message);
    setState({ registrationError: message });
  }
}

/**
 * Called before signing out, while the session can still prove who it is: this phone
 * stops receiving the student's notifications, and the tray and badge are cleared.
 */
export async function unregisterForPush(): Promise<void> {
  if (!pushSupported) return;
  const token = registered ?? (await prefs.get(TOKEN_KEY));
  registered = null;
  if (token) await authApi.unregisterPushToken(token).catch(() => undefined);
  await Notifications.dismissAllNotificationsAsync().catch(() => undefined);
  await Notifications.setBadgeCountAsync(0).catch(() => undefined);
}

/** The app icon's badge: the number of unread notifications, kept in step with the app. */
export function setAppBadge(count: number): void {
  if (!pushSupported) return;
  void Notifications.setBadgeCountAsync(Math.max(0, count)).catch(() => undefined);
}

/**
 * A push's payload. Expo puts it in `content.data`; on Android a push that the system
 * drew while the app was closed can carry it as JSON in the raw message instead.
 */
export function dataOf(notification: Notifications.Notification): NotificationData {
  const content = notification.request.content.data as NotificationData | null;
  if (content && Object.keys(content).length > 0) return content;
  const trigger = notification.request.trigger as { remoteMessage?: { data?: Record<string, string> } } | null;
  const raw = trigger?.remoteMessage?.data;
  if (raw?.body) {
    try {
      return JSON.parse(raw.body) as NotificationData;
    } catch {
      // Not JSON: fall through to the raw fields.
    }
  }
  return (raw ?? {}) as NotificationData;
}

/**
 * Removes notifications from the tray once they are no longer news, such as a chat's
 * messages once that chat is open (Android's guide: "If an earlier notification is
 * stale, dismiss it").
 */
export async function dismissFromTray(match: (data: NotificationData) => boolean): Promise<void> {
  if (!pushSupported) return;
  try {
    const shown = await Notifications.getPresentedNotificationsAsync();
    await Promise.all(
      shown
        .filter((n) => match(dataOf(n)))
        .map((n) => Notifications.dismissNotificationAsync(n.request.identifier)),
    );
  } catch {
    // Best effort.
  }
}
