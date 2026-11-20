/**
 * Small writing helpers for notification text.
 *
 * Notifications are read at a glance, often on a lock screen, so their text follows the
 * platform guidance (Apple HIG "Notifications", Android "Notifications" design guide):
 * a short title that says who or what, a body that does not repeat it, sentence case, no
 * app name. Times are written in the reader's own time zone, never the server's.
 */

const FALLBACK_TIME_ZONE = 'Asia/Kolkata';

function parts(date: Date, timeZone: string, options: Intl.DateTimeFormatOptions) {
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat('en-GB', { ...options, timeZone });
  } catch {
    formatter = new Intl.DateTimeFormat('en-GB', { ...options, timeZone: FALLBACK_TIME_ZONE });
  }
  const out: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {};
  for (const part of formatter.formatToParts(date)) out[part.type] = part.value;
  return out;
}

/** "5:00 pm" in the reader's time zone. */
export function formatTime(date: Date, timeZone: string): string {
  const p = parts(date, timeZone, { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${p.hour}:${p.minute} ${(p.dayPeriod ?? '').toLowerCase()}`.trim();
}

/**
 * "Thu 20 Nov, 5:00 pm" in the reader's time zone, with the year only when it is not the
 * current one.
 *
 * Always absolute, never "today" or "tomorrow": the same text is kept in the notification
 * centre, where "tomorrow" would be wrong by the time it is read.
 */
export function formatWhen(date: Date, timeZone: string, now: Date = new Date()): string {
  const p = parts(date, timeZone, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const thisYear = parts(now, timeZone, { year: 'numeric' }).year;
  const day = `${p.weekday} ${p.day} ${p.month}${p.year !== thisYear ? ` ${p.year}` : ''}`;
  return `${day}, ${formatTime(date, timeZone)}`;
}

/** Where a session happens, in a few words: "Online", "At Library, room 2", "In person". */
export function sessionPlace(mode: string, location?: string | null): string {
  if (mode === 'ONLINE') return 'Online';
  return location?.trim() ? `At ${clip(location, 40)}` : 'In person';
}

/** "in 25 minutes", rounded the way a person would say it. */
export function startsIn(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m <= 1) return 'now';
  if (m >= 50) return 'in about an hour';
  if (m >= 10) return `in ${Math.round(m / 5) * 5} minutes`;
  return `in ${m} minutes`;
}

/** A rating as five stars, filled to the score: 4 becomes "★★★★☆". */
export function stars(rating: number): string {
  const n = Math.max(0, Math.min(5, Math.round(rating)));
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

/** The first word of a name, for places where the full name would crowd the line. */
export function firstName(name: string | undefined | null): string {
  return (name ?? '').trim().split(/\s+/)[0] || 'Someone';
}

/**
 * Shortens text at a word boundary, for quoting someone inside a sentence. Notification
 * bodies are otherwise left whole: the phone truncates them itself and shows the rest when
 * the notification is expanded.
 */
export function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:!?-]+$/, '')}…`;
}
