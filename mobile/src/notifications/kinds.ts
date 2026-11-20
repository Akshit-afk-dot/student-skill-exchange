import type { Ionicons } from '@expo/vector-icons';
import type { Tone } from '../components/ui';

/**
 * What each kind of notification looks like, and which switch controls it.
 *
 * One table for the notification centre, the in-app banner and Settings, so the same
 * event always wears the same icon and colour. Colours follow the app's meanings: green
 * for something that went right, gold for rewards, amber for account warnings, the brand
 * for everything routine. Red is never used: nothing here is an error.
 */

/** Matches NOTIFICATION_CATEGORIES on the server and the Android channel ids. */
export type NotificationCategory = 'messages' | 'requests' | 'reminders' | 'sessions' | 'achievements' | 'account';

/** The categories a student can switch off. Account notices always arrive. */
export type OptionalCategory = Exclude<NotificationCategory, 'account'>;

export type IconName = keyof typeof Ionicons.glyphMap;

export interface Kind {
  icon: IconName;
  tone: Tone;
  category: NotificationCategory;
}

const FALLBACK: Kind = { icon: 'notifications', tone: 'primary', category: 'account' };

const KINDS: Record<string, Kind> = {
  MESSAGE_RECEIVED: { icon: 'chatbubble', tone: 'primary', category: 'messages' },
  REQUEST_RECEIVED: { icon: 'person-add', tone: 'primary', category: 'requests' },
  REQUEST_ACCEPTED: { icon: 'swap-horizontal', tone: 'success', category: 'requests' },
  REQUEST_REJECTED: { icon: 'close', tone: 'neutral', category: 'requests' },
  NEW_MATCH: { icon: 'sparkles', tone: 'primary', category: 'requests' },
  SESSION_REMINDER: { icon: 'alarm', tone: 'primary', category: 'reminders' },
  SESSION_SCHEDULED: { icon: 'calendar-clear', tone: 'primary', category: 'sessions' },
  SESSION_CANCELLED: { icon: 'calendar-clear', tone: 'neutral', category: 'sessions' },
  SESSION_COMPLETED: { icon: 'checkmark-done', tone: 'success', category: 'sessions' },
  REVIEW_RECEIVED: { icon: 'star', tone: 'reward', category: 'achievements' },
  BADGE_EARNED: { icon: 'trophy', tone: 'reward', category: 'achievements' },
  MODERATION_NOTICE: { icon: 'shield-half', tone: 'warning', category: 'account' },
};

export function kindOf(type: string | undefined): Kind {
  return (type && KINDS[type]) || FALLBACK;
}

/**
 * The categories as a student sees them, in Settings and as Android channels. The order
 * is the order of importance.
 *
 * Android importance: messages, requests and reminders may pop up over what you are
 * doing (HIGH), session changes only sound (DEFAULT), achievements arrive silently (LOW).
 * Google's guide reserves HIGH for "time-critical information the user must know, or act
 * on, immediately", and a reminder for something in the next hour is exactly that.
 *
 * Vibration is a pattern per channel (off/on pairs in ms, starting with a delay), so a
 * phone in a pocket says what arrived before it is taken out. Each echoes the in-app
 * haptic for the same event: two light knocks for a message, a knock-knock-and-landing for a
 * request, three even beats for a reminder. A channel's vibration is fixed once the phone
 * has created it, so changing one means a new channel id.
 */
export interface CategoryInfo {
  id: NotificationCategory;
  label: string;
  description: string;
  icon: IconName;
  importance: 'high' | 'default' | 'low';
  vibration: number[] | null;
}

export const CATEGORIES: readonly CategoryInfo[] = [
  {
    id: 'messages',
    label: 'Messages',
    description: 'New messages from the students you’re talking to',
    icon: 'chatbubble',
    importance: 'high',
    vibration: [0, 40, 110, 40],
  },
  {
    id: 'requests',
    label: 'Requests',
    description: 'Someone wants to learn from you, or accepts your request',
    icon: 'person-add',
    importance: 'high',
    vibration: [0, 40, 110, 40, 160, 90],
  },
  {
    id: 'reminders',
    label: 'Session reminders',
    description: 'Shortly before a session starts',
    icon: 'alarm',
    importance: 'high',
    vibration: [0, 60, 140, 60, 140, 60],
  },
  {
    id: 'sessions',
    label: 'Session changes',
    description: 'Sessions booked, moved, cancelled or completed',
    icon: 'calendar-clear',
    importance: 'default',
    vibration: [0, 60],
  },
  {
    id: 'achievements',
    label: 'Reviews and badges',
    description: 'Ratings you receive and badges you earn',
    icon: 'trophy',
    importance: 'low',
    vibration: null,
  },
  {
    id: 'account',
    label: 'Account and safety',
    description: 'Notices from moderators about your account',
    icon: 'shield-half',
    importance: 'default',
    vibration: [0, 60, 120, 60],
  },
];

export const OPTIONAL_CATEGORIES = CATEGORIES.filter(
  (c): c is CategoryInfo & { id: OptionalCategory } => c.id !== 'account',
);
