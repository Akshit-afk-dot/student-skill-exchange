import { notifications as notificationsApi } from '../api/endpoints';
import { navigationRef } from '../navigation/ref';

/** A notification's payload: where it leads, and who caused it. Always strings. */
export type NotificationData = Record<string, string | undefined>;

interface Me {
  id: string;
  name: string;
}

let pending: { data: NotificationData; title?: string } | null = null;

/**
 * Opens the screen a notification is about. Shared by the notification centre, the
 * in-app banner and a tapped push, so all three land in the same place.
 *
 * Returns false when there is nowhere to go (an unknown screen), so the caller can
 * leave the student where they are.
 */
function navigate(data: NotificationData, me: Me | null, title?: string): boolean {
  switch (data.screen) {
    case 'Chat':
      if (!data.conversationId) return false;
      navigationRef.navigate('Chat', {
        conversationId: data.conversationId,
        partnerName: data.partnerName || data.actorName || title || 'Chat',
        partnerId: data.partnerId ?? data.actorId ?? '',
      });
      return true;
    case 'SessionDetails':
      if (!data.sessionId) return false;
      navigationRef.navigate('SessionDetails', { sessionId: data.sessionId });
      return true;
    case 'Reviews':
      // "Session complete" opens the session, where the rating button is; a review you
      // received opens the reviews about you.
      if (data.sessionId) {
        navigationRef.navigate('SessionDetails', { sessionId: data.sessionId });
        return true;
      }
      if (!me) return false;
      navigationRef.navigate('Reviews', { userId: me.id, userName: me.name });
      return true;
    case 'LearningRequests':
      navigationRef.navigate('LearningRequests');
      return true;
    case 'MySessions':
      navigationRef.navigate('MySessions');
      return true;
    case 'Badges':
      navigationRef.navigate('Badges');
      return true;
    case 'Settings':
      navigationRef.navigate('Settings');
      return true;
    case 'MySkills':
      navigationRef.navigate('MySkills');
      return true;
    default:
      return false;
  }
}

/**
 * Opens a notification: marks it read (it has been dealt with) and goes where it points.
 * Before the app's screens exist (a cold start from a tapped push, or still signing in),
 * the destination is held until `openPendingNotification` runs.
 */
export function openNotification(data: NotificationData, me: Me | null, title?: string): boolean {
  if (data.notificationId) void notificationsApi.markRead([data.notificationId]).catch(() => undefined);
  if (!navigationRef.isReady() || !me) {
    pending = { data, title };
    return true;
  }
  return navigate(data, me, title);
}

/** Goes to a destination held from before the screens were ready. */
export function openPendingNotification(me: Me): void {
  if (!pending || !navigationRef.isReady()) return;
  const { data, title } = pending;
  pending = null;
  navigate(data, me, title);
}
