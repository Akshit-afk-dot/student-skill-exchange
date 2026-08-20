import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import calendar from 'dayjs/plugin/calendar';
import type { MatchReason, SkillLevel } from '../types';

dayjs.extend(relativeTime);
dayjs.extend(calendar);

export const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const WEEKDAY_FULL = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export const LEVEL_LABEL: Record<SkillLevel, string> = {
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
  EXPERT: 'Expert',
};

export function formatDate(iso: string): string {
  return dayjs(iso).format('D MMM YYYY');
}

export function formatTime(iso: string): string {
  return dayjs(iso).format('h:mm A');
}

export function formatDateTime(iso: string): string {
  return dayjs(iso).format('D MMM, h:mm A');
}

/** "Today at 6:00 PM" / "Tomorrow at ..." near the present, absolute further out. */
export function formatSessionWhen(iso: string): string {
  return dayjs(iso).calendar(null, {
    sameDay: '[Today at] h:mm A',
    nextDay: '[Tomorrow at] h:mm A',
    nextWeek: 'dddd [at] h:mm A',
    lastDay: '[Yesterday at] h:mm A',
    lastWeek: '[Last] dddd [at] h:mm A',
    sameElse: 'D MMM [at] h:mm A',
  });
}

export function timeAgo(iso: string): string {
  return dayjs(iso).fromNow();
}

/** Short relative stamp for chat rows: time today, weekday this week, date beyond. */
export function chatTimestamp(iso: string): string {
  const then = dayjs(iso);
  const now = dayjs();
  if (then.isSame(now, 'day')) return then.format('h:mm A');
  if (now.diff(then, 'day') < 7) return then.format('ddd');
  return then.format('D MMM');
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest === 0) return `${hours} hr${hours === 1 ? '' : 's'}`;
  return `${hours}h ${rest}m`;
}

export function formatHours(minutes: number): string {
  return `${(minutes / 60).toFixed(1)}h`;
}

export function plural(count: number, singular: string, pluralForm?: string): string {
  return `${count} ${count === 1 ? singular : (pluralForm ?? `${singular}s`)}`;
}

export function slotLabel(slot: { day: number; start: string; end: string }): string {
  return `${WEEKDAY_NAMES[slot.day] ?? '?'} ${slot.start}–${slot.end}`;
}

/**
 * Turns a machine-readable match reason into a sentence.
 * `skillNames` maps skill ids to names so the copy can be specific.
 */
export function reasonText(reason: MatchReason, skillNames: Map<string, string>): string {
  const names = (reason.skillIds ?? [])
    .map((id) => skillNames.get(id))
    .filter((n): n is string => Boolean(n));
  const list = formatList(names);

  switch (reason.code) {
    case 'TWO_WAY_EXCHANGE':
      return 'A two-way exchange — you can each teach the other';
    case 'TEACHES_WHAT_YOU_WANT':
      return list ? `Teaches ${list}, which you want to learn` : 'Teaches something you want to learn';
    case 'WANTS_WHAT_YOU_TEACH':
      return list ? `Wants to learn ${list}, which you teach` : 'Wants to learn something you teach';
    case 'STRONG_AVAILABILITY_OVERLAP':
      return `${formatHours(reason.value ?? 0)} of overlapping free time each week`;
    case 'HIGHLY_RATED':
      return `Highly rated at ${(reason.value ?? 0).toFixed(1)} stars`;
    case 'SAME_COLLEGE':
      return 'Studies at your college';
    case 'NEARBY':
      return `Only ${(reason.value ?? 0).toFixed(1)} km away`;
    case 'EXPERIENCED_TEACHER':
      return 'Teaches at the right level for you';
    default:
      return '';
  }
}

/** "A", "A and B", "A, B and C" */
export function formatList(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0] as string;
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** Colour tone for a session status chip. */
export function statusTone(status: string): 'neutral' | 'primary' | 'success' | 'warning' | 'danger' {
  switch (status) {
    case 'COMPLETED':
      return 'success';
    case 'CONFIRMED':
      return 'primary';
    case 'SCHEDULED':
      return 'warning';
    case 'CANCELLED':
    case 'NO_SHOW':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function statusLabel(status: string): string {
  return status
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
