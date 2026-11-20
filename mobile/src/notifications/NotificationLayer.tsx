import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { notifications as notificationsApi } from '../api/endpoints';
import { RT, onEvent } from '../api/socket';
import { currentRoute } from '../navigation/ref';
import { useAuth } from '../store/auth';
import type { AppNotification } from '../types';
import { NotificationBanner, hideBanner, showBanner, type BannerItem } from './Banner';
import {
  dataOf,
  preparePush,
  pushSupported,
  refreshPermission,
  registerForPush,
  setAppBadge,
} from './device';
import { kindOf } from './kinds';
import { openNotification, openPendingNotification, type NotificationData } from './open';
import { NotificationPrompt } from './PermissionPrompt';

/**
 * Everything notifications do while a student is signed in. Mounted once, beside the
 * screens.
 *
 * - Registers this phone for push, and keeps the registration fresh.
 * - Opens the right screen when a push is tapped, including the one that launched the app.
 * - Shows the in-app banner for news that arrives while the app is open, over the socket or
 *   as a push, once each, and never for what the student is already looking at.
 * - Keeps the app icon's badge equal to the unread count.
 */
export function NotificationLayer() {
  const { user } = useAuth();
  const me = user ? { id: user.id, name: user.name } : null;
  const meRef = useRef(me);
  meRef.current = me;
  const prefsRef = useRef(user?.notificationPrefs);
  prefsRef.current = user?.notificationPrefs;

  const seen = useRef(new Set<string>());

  const syncBadge = useCallback(() => {
    void notificationsApi
      .unreadCount()
      .then((r) => setAppBadge(r.count))
      .catch(() => undefined);
  }, []);

  /** Shows a banner unless it repeats one, is switched off, or is already on screen. */
  const present = useCallback((item: BannerItem) => {
    if (!item.id || seen.current.has(item.id)) return;
    seen.current.add(item.id);
    if (seen.current.size > 200) seen.current = new Set([...seen.current].slice(-100));

    // A declined request sits quietly in the notification centre; it never interrupts.
    if (item.type === 'REQUEST_REJECTED') return;
    const category = kindOf(item.type).category;
    if (category !== 'account' && prefsRef.current?.[category] === false) return;
    if (isLookingAt(item)) return;

    showBanner(item);
  }, []);

  // Push setup, and a destination held from a tap that happened before sign-in finished.
  useEffect(() => {
    void (async () => {
      await preparePush();
      await registerForPush();
    })();
    if (meRef.current) openPendingNotification(meRef.current);
    syncBadge();
  }, [syncBadge]);

  // Taps on a push, including the one that cold-started the app.
  useEffect(() => {
    if (!pushSupported) return;
    const handle = (response: Notifications.NotificationResponse) => {
      if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
      const data = dataOf(response.notification);
      if (data.notificationId) seen.current.add(data.notificationId);
      hideBanner();
      openNotification(data, meRef.current, response.notification.request.content.title ?? undefined);
      void Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
    };
    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) handle(response);
      })
      .catch(() => undefined);
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    return () => sub.remove();
  }, []);

  // A push that arrives while the app is open. The system does not draw it (device.ts), so
  // it becomes a banner, unless the socket already delivered the same notification.
  useEffect(() => {
    if (!pushSupported) return;
    const sub = Notifications.addNotificationReceivedListener((notification) => {
      const data = dataOf(notification);
      const content = notification.request.content;
      present({
        id: data.notificationId ?? notification.request.identifier,
        type: data.type ?? '',
        title: content.title ?? '',
        body: content.body ?? '',
        data,
      });
      syncBadge();
    });
    return () => sub.remove();
  }, [present, syncBadge]);

  // The socket: the same notifications, usually a moment before the push.
  useEffect(() => {
    const offNew = onEvent<AppNotification>(RT.NOTIFICATION, (n) => {
      present({ id: n._id, type: n.type, title: n.title, body: n.body, data: n.data ?? {} });
      syncBadge();
    });
    const offRead = onEvent(RT.NOTIFICATION_READ, syncBadge);
    return () => {
      offNew();
      offRead();
    };
  }, [present, syncBadge]);

  // Back from the background: the badge may be stale, and notifications may have been
  // switched on in the phone's settings meanwhile.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      syncBadge();
      void refreshPermission().then((permission) => {
        if (permission === 'granted') void registerForPush();
      });
    });
    return () => sub.remove();
  }, [syncBadge]);

  return (
    <>
      <NotificationBanner
        onOpen={(item) => {
          openNotification({ ...item.data, notificationId: item.data.notificationId ?? item.id }, meRef.current, item.title);
        }}
      />
      <NotificationPrompt />
    </>
  );
}

/**
 * Whether the student is already looking at what a notification is about, in which case
 * a banner would only repeat the screen (Apple's Mail example: a new message in the open
 * mailbox is simply added to the list).
 */
function isLookingAt(item: BannerItem): boolean {
  const route = currentRoute();
  if (!route) return false;
  const data: NotificationData = item.data;
  switch (route.name) {
    case 'Notifications':
      return true;
    case 'Chat':
      return item.type === 'MESSAGE_RECEIVED' && route.params.conversationId === data.conversationId;
    case 'ChatsTab':
      return item.type === 'MESSAGE_RECEIVED';
    case 'LearningRequests':
      return item.type.startsWith('REQUEST_');
    case 'SessionDetails':
      return Boolean(data.sessionId) && route.params.sessionId === data.sessionId;
    default:
      return false;
  }
}
