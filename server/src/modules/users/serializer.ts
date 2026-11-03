import type { IUser, UserDoc } from '../../models';

type UserLike = UserDoc | (IUser & { _id: unknown });

/**
 * The shape of a user as seen by *other* students.
 *
 * Serialisation is explicit rather than "the document minus a deny-list", so a field
 * added to the schema later is private until someone deliberately exposes it here.
 */
export interface PublicUser {
  id: string;
  name: string;
  college?: string;
  department?: string;
  year?: number;
  bio?: string;
  profileImage?: string;
  languages: string[];
  teachingMode: string;
  timezone: string;
  city?: string;
  availability: Array<{ day: number; start: string; end: string }>;
  rating: { average: number; count: number };
  stats: {
    sessionsTaught: number;
    sessionsLearned: number;
    points: number;
    streakDays: number;
  };
  badges: string[];
  isOnline: boolean;
  /** True once the student has confirmed their email address. */
  verified: boolean;
  lastSeenAt?: string;
  createdAt: string;
}

export function publicUser(user: UserLike): PublicUser {
  const out: PublicUser = {
    id: String(user._id),
    name: user.name,
    languages: user.languages ?? [],
    teachingMode: user.teachingMode,
    timezone: user.timezone,
    availability: (user.availability ?? []).map((a) => ({
      day: a.day,
      start: a.start,
      end: a.end,
    })),
    rating: {
      average: Number((user.ratingAvg ?? 0).toFixed(2)),
      count: user.ratingCount ?? 0,
    },
    stats: {
      sessionsTaught: user.stats?.sessionsTaught ?? 0,
      sessionsLearned: user.stats?.sessionsLearned ?? 0,
      points: user.stats?.points ?? 0,
      streakDays: user.stats?.streakDays ?? 0,
    },
    badges: user.badges ?? [],
    isOnline: user.isOnline ?? false,
    verified: user.emailVerified === true,
    createdAt: new Date(user.createdAt).toISOString(),
  };

  if (user.college) out.college = user.college;
  if (user.department) out.department = user.department;
  if (user.year) out.year = user.year;
  if (user.bio) out.bio = user.bio;
  if (user.profileImage) out.profileImage = user.profileImage;
  if (user.city) out.city = user.city;
  // Precise coordinates are never exposed; only the city label and derived distances are.
  if (user.lastSeenAt) out.lastSeenAt = new Date(user.lastSeenAt).toISOString();

  return out;
}

export interface SelfUser extends PublicUser {
  email: string;
  role: string;
  status: string;
  emailVerified: boolean;
  hasPassword: boolean;
  coordinates?: [number, number];
  stats: PublicUser['stats'] & {
    minutesTaught: number;
    minutesLearned: number;
    longestStreak: number;
  };
}

/** The richer view a student gets of their own account. */
export function selfUser(user: UserDoc): SelfUser {
  const base = publicUser(user);
  const out: SelfUser = {
    ...base,
    email: user.email,
    role: user.role,
    status: user.status,
    emailVerified: user.emailVerified,
    // Tells the client whether to offer "change password" or "set a password".
    hasPassword: Boolean(user.passwordHash),
    stats: {
      ...base.stats,
      minutesTaught: user.stats?.minutesTaught ?? 0,
      minutesLearned: user.stats?.minutesLearned ?? 0,
      longestStreak: user.stats?.longestStreak ?? 0,
    },
  };
  if (user.location?.coordinates) out.coordinates = user.location.coordinates;
  return out;
}
