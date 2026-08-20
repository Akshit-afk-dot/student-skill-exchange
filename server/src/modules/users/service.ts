import mongoose, { type PipelineStage, Types } from 'mongoose';
import { Review, Skill, User, UserSkill, type IUser, type UserDoc } from '../../models';
import { ApiError } from '../../utils/errors';
import { paginate, type Paginated } from '../../utils/pagination';
import { publicUser, type PublicUser } from './serializer';
import type { SearchUsersInput, UpdateProfileInput } from './validators';

export async function getUserOrFail(id: string): Promise<UserDoc> {
  if (!Types.ObjectId.isValid(id)) throw ApiError.badRequest('Invalid user id');
  const user = await User.findById(id);
  if (!user || user.status === 'BANNED') throw ApiError.notFound('Student not found');
  return user;
}

export async function updateProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<UserDoc> {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('Account not found');

  // Assign only the keys actually present, so an omitted field is left untouched
  // rather than being overwritten with undefined.
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      (user as unknown as Record<string, unknown>)[key] = value;
    }
  }
  await user.save();
  return user;
}

export async function updateLocation(
  userId: string,
  longitude: number,
  latitude: number,
  city?: string,
): Promise<UserDoc> {
  const update: Record<string, unknown> = {
    // GeoJSON order is [longitude, latitude] — the reverse of how coordinates are
    // usually spoken, and the most common source of silently wrong distances.
    location: { type: 'Point', coordinates: [longitude, latitude] },
  };
  if (city) update.city = city;

  const user = await User.findByIdAndUpdate(userId, { $set: update }, { returnDocument: 'after' });
  if (!user) throw ApiError.notFound('Account not found');
  return user;
}

export interface UserSkillSummary {
  id: string;
  skill: { id: string; name: string; category: string };
  level: string;
  yearsOfExperience?: number;
  description?: string;
  priority: number;
}

export interface UserProfileDetail extends PublicUser {
  teaches: UserSkillSummary[];
  learns: UserSkillSummary[];
  reviewSummary: { count: number; average: number; distribution: Record<string, number> };
}

/** Full profile payload backing the Student Profile screen. */
export async function getProfileDetail(id: string): Promise<UserProfileDetail> {
  const user = await getUserOrFail(id);

  const [skills, reviewAgg] = await Promise.all([
    UserSkill.find({ user: user._id })
      .populate<{ skill: { _id: Types.ObjectId; name: string; category: Types.ObjectId } }>(
        'skill',
        'name category',
      )
      .lean(),
    Review.aggregate<{ _id: number; count: number }>([
      { $match: { reviewee: user._id, hidden: false } },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
    ]),
  ]);

  const distribution: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
  let count = 0;
  let total = 0;
  for (const row of reviewAgg) {
    distribution[String(row._id)] = row.count;
    count += row.count;
    total += row._id * row.count;
  }

  const toSummary = (s: (typeof skills)[number]): UserSkillSummary => {
    const summary: UserSkillSummary = {
      id: String(s._id),
      skill: {
        id: String(s.skill?._id ?? ''),
        name: s.skill?.name ?? 'Unknown skill',
        category: String(s.skill?.category ?? ''),
      },
      level: s.level,
      priority: s.priority,
    };
    if (s.yearsOfExperience !== undefined) summary.yearsOfExperience = s.yearsOfExperience;
    if (s.description) summary.description = s.description;
    return summary;
  };

  return {
    ...publicUser(user),
    teaches: skills.filter((s) => s.type === 'TEACH').map(toSummary),
    learns: skills.filter((s) => s.type === 'LEARN').map(toSummary),
    reviewSummary: {
      count,
      average: count > 0 ? Number((total / count).toFixed(2)) : 0,
      distribution,
    },
  };
}

export interface SearchResultUser extends PublicUser {
  distanceKm?: number;
  /** Present when the search was filtered by skill: the level they teach it at. */
  matchedSkillLevel?: string;
}

/**
 * Skill discovery search.
 *
 * Built as one aggregation so filtering, counting and pagination happen inside Mongo.
 * `$geoNear` must be the first stage in a pipeline, which shapes the branching below:
 * when a geo filter is present it leads and absorbs the other user predicates; otherwise
 * a plain `$match` does.
 */
export async function searchUsers(
  viewerId: string | null,
  input: SearchUsersInput,
): Promise<Paginated<SearchResultUser>> {
  const userMatch: Record<string, unknown> = { status: 'ACTIVE', role: 'STUDENT' };
  if (viewerId) userMatch._id = { $ne: new Types.ObjectId(viewerId) };
  if (input.college) userMatch.college = new RegExp(`^${escapeRegex(input.college)}$`, 'i');
  if (input.language) userMatch.languages = input.language;
  if (input.minRating !== undefined) userMatch.ratingAvg = { $gte: input.minRating };
  if (input.onlineNow) userMatch.isOnline = true;
  if (input.mode) {
    // A student who accepts BOTH satisfies a request for either specific mode.
    userMatch.teachingMode = input.mode === 'BOTH' ? 'BOTH' : { $in: [input.mode, 'BOTH'] };
  }

  const hasGeo = input.longitude !== undefined && input.latitude !== undefined;
  const pipeline: PipelineStage[] = [];

  if (hasGeo) {
    pipeline.push({
      $geoNear: {
        near: { type: 'Point', coordinates: [input.longitude!, input.latitude!] },
        distanceField: 'distanceMeters',
        maxDistance: input.radiusKm * 1000,
        query: userMatch,
        spherical: true,
      },
    });
    // $text cannot coexist with $geoNear, so free text falls back to a regex here. The
    // geo stage has already narrowed the candidate set, so the scan is bounded.
    if (input.q) {
      const rx = new RegExp(escapeRegex(input.q), 'i');
      pipeline.push({ $match: { $or: [{ name: rx }, { college: rx }, { bio: rx }] } });
    }
  } else {
    // The indexed text search is preferred whenever geo is not in play.
    if (input.q) userMatch.$text = { $search: input.q };
    pipeline.push({ $match: userMatch });
  }

  if (input.skill) {
    const skillId = new Types.ObjectId(input.skill);
    pipeline.push({
      $lookup: {
        from: UserSkill.collection.name,
        let: { uid: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$user', '$$uid'] },
                  { $eq: ['$skill', skillId] },
                  { $eq: ['$type', 'TEACH'] },
                ],
              },
            },
          },
          { $project: { level: 1 } },
        ],
        as: 'matchedSkill',
      },
    });
    pipeline.push({ $match: { 'matchedSkill.0': { $exists: true } } });
    if (input.level?.length) {
      pipeline.push({ $match: { 'matchedSkill.level': { $in: input.level } } });
    }
  }

  const sortStage: Record<string, 1 | -1> =
    input.sort === 'rating'
      ? { ratingAvg: -1, ratingCount: -1 }
      : input.sort === 'sessions'
        ? { 'stats.sessionsTaught': -1 }
        : input.sort === 'recent'
          ? { createdAt: -1 }
          : hasGeo
            ? { distanceMeters: 1 }
            : { ratingAvg: -1, 'stats.points': -1 };

  const skip = (input.page - 1) * input.limit;

  // $facet runs both branches over the same filtered set, so the total is always
  // consistent with the page returned.
  pipeline.push({
    $facet: {
      items: [{ $sort: sortStage }, { $skip: skip }, { $limit: input.limit }],
      meta: [{ $count: 'total' }],
    },
  });

  const [result] = await User.aggregate<{
    items: Array<IUser & { _id: Types.ObjectId; distanceMeters?: number; matchedSkill?: Array<{ level: string }> }>;
    meta: Array<{ total: number }>;
  }>(pipeline);

  const rows = result?.items ?? [];
  const total = result?.meta?.[0]?.total ?? 0;

  const items: SearchResultUser[] = rows.map((row) => {
    const out: SearchResultUser = publicUser(row);
    if (typeof row.distanceMeters === 'number') {
      out.distanceKm = Number((row.distanceMeters / 1000).toFixed(2));
    }
    const level = row.matchedSkill?.[0]?.level;
    if (level) out.matchedSkillLevel = level;
    return out;
  });

  return paginate(items, total, { page: input.page, limit: input.limit });
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Recomputes a user's denormalised rating fields from their visible reviews. */
export async function recalculateRating(userId: string | Types.ObjectId): Promise<void> {
  const [agg] = await Review.aggregate<{ sum: number; count: number }>([
    { $match: { reviewee: new Types.ObjectId(String(userId)), hidden: false } },
    { $group: { _id: null, sum: { $sum: '$rating' }, count: { $sum: 1 } } },
  ]);

  const sum = agg?.sum ?? 0;
  const count = agg?.count ?? 0;
  await User.updateOne(
    { _id: userId },
    { $set: { ratingSum: sum, ratingCount: count, ratingAvg: count > 0 ? sum / count : 0 } },
  );
}

export interface DirectoryFacets {
  colleges: Array<{ value: string; count: number }>;
  languages: Array<{ value: string; count: number }>;
  topSkills: Array<{ id: string; name: string; teachCount: number }>;
}

/** Filter options for the Explore screen, derived from live data. */
export async function getDirectoryFacets(): Promise<DirectoryFacets> {
  const [colleges, languages, topSkills] = await Promise.all([
    User.aggregate<{ _id: string; count: number }>([
      { $match: { status: 'ACTIVE', college: { $nin: [null, ''] } } },
      { $group: { _id: '$college', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 30 },
    ]),
    User.aggregate<{ _id: string; count: number }>([
      { $match: { status: 'ACTIVE' } },
      { $unwind: '$languages' },
      { $group: { _id: '$languages', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]),
    Skill.find({ approved: true }).sort({ teachCount: -1 }).limit(20).lean(),
  ]);

  return {
    colleges: colleges.map((c) => ({ value: c._id, count: c.count })),
    languages: languages.map((l) => ({ value: l._id, count: l.count })),
    topSkills: topSkills.map((s) => ({
      id: String(s._id),
      name: s.name,
      teachCount: s.teachCount,
    })),
  };
}

export async function setOnlineStatus(userId: string, isOnline: boolean): Promise<void> {
  if (!mongoose.Types.ObjectId.isValid(userId)) return;
  await User.updateOne(
    { _id: userId },
    { $set: { isOnline, lastSeenAt: new Date() } },
  );
}
