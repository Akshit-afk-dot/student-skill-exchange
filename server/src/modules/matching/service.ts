import { Types } from 'mongoose';
import { env } from '../../config/env';
import {
  Connection,
  LearningRequest,
  Skill,
  User,
  UserSkill,
  type IUser,
} from '../../models';
import { ApiError } from '../../utils/errors';
import { paginate, type Paginated } from '../../utils/pagination';
import { blockedEitherWay } from '../blocks/service';
import { publicUser, type PublicUser } from '../users/serializer';
import {
  computeMatchScore,
  type MatchProfile,
  type MatchReason,
  type MatchWeights,
  type ProfileSkill,
} from './scoring';

/**
 * Ceiling on how many candidate students are scored in one request.
 *
 * Scoring is O(candidates) in application memory. At the scale this platform targets
 * (a college, or a handful of them) the candidate set after skill-overlap filtering is
 * far below this. The cap is what stops a pathological profile — someone who lists
 * thirty popular skills — from turning one request into a full-collection scan. Beyond
 * this scale the same scoring function would move to a scheduled job writing a
 * precomputed match table; see docs/MATCHING.md.
 */
const CANDIDATE_CAP = 500;

export const weightsFromEnv = (): MatchWeights => ({
  skill: env.MATCH_W_SKILL,
  availability: env.MATCH_W_AVAILABILITY,
  experience: env.MATCH_W_EXPERIENCE,
  rating: env.MATCH_W_RATING,
  location: env.MATCH_W_LOCATION,
  exchangeBonus: env.MATCH_EXCHANGE_BONUS,
  maxDistanceKm: env.MATCH_MAX_DISTANCE_KM,
});

type UserRow = IUser & { _id: Types.ObjectId };

function toMatchProfile(user: UserRow, skills: Array<{ skill: Types.ObjectId; type: string; level: string; priority: number }>): MatchProfile {
  const teaches: ProfileSkill[] = [];
  const learns: ProfileSkill[] = [];

  for (const s of skills) {
    const entry: ProfileSkill = {
      skillId: String(s.skill),
      level: s.level as ProfileSkill['level'],
      priority: s.priority,
    };
    if (s.type === 'TEACH') teaches.push(entry);
    else learns.push(entry);
  }

  const profile: MatchProfile = {
    id: String(user._id),
    teaches,
    learns,
    availability: user.availability ?? [],
    ratingSum: user.ratingSum ?? 0,
    ratingCount: user.ratingCount ?? 0,
    teachingMode: user.teachingMode,
  };
  if (user.college) profile.college = user.college;
  if (user.city) profile.city = user.city;
  if (user.location?.coordinates) profile.coordinates = user.location.coordinates;
  return profile;
}

export interface MatchCandidate extends PublicUser {
  matchScore: number;
  matchPercent: number;
  twoWay: boolean;
  breakdown: Record<string, number>;
  reasons: MatchReason[];
  /** Skill names resolved for display, so the client needs no second round trip. */
  theyTeachYouWant: Array<{ id: string; name: string; level: string }>;
  youTeachTheyWant: Array<{ id: string; name: string; level: string }>;
  overlapMinutes: number;
  distanceKm?: number;
}

export interface RecommendationOptions {
  page: number;
  limit: number;
  /** Restrict to reciprocal exchanges only. */
  twoWayOnly?: boolean;
  /** Drop candidates below this score, 0..1. */
  minScore?: number;
  skill?: string;
}

/**
 * Ranked learning partners for a student.
 *
 * Candidate generation is the cheap half: only students who sit on at least one side of
 * a skill overlap are considered, which the (skill, type) index answers directly.
 * Scoring is then applied to that much smaller set.
 */
export async function getRecommendations(
  userId: string,
  options: RecommendationOptions,
): Promise<Paginated<MatchCandidate>> {
  const me = await User.findById(userId).lean<UserRow>();
  if (!me) throw ApiError.notFound('Account not found');

  const myId = new Types.ObjectId(userId);
  const mySkills = await UserSkill.find({ user: myId }).lean();

  const myTeachIds = mySkills.filter((s) => s.type === 'TEACH').map((s) => s.skill);
  const myLearnIds = mySkills.filter((s) => s.type === 'LEARN').map((s) => s.skill);

  if (myTeachIds.length === 0 && myLearnIds.length === 0) {
    // Nothing to match on yet. An empty page is the honest answer; the client shows
    // the "add your skills" prompt rather than a list of irrelevant strangers.
    return paginate([], 0, options);
  }

  const overlapClauses: Record<string, unknown>[] = [];
  if (myLearnIds.length > 0) {
    overlapClauses.push({ skill: { $in: myLearnIds }, type: 'TEACH' });
  }
  if (myTeachIds.length > 0) {
    overlapClauses.push({ skill: { $in: myTeachIds }, type: 'LEARN' });
  }
  if (options.skill) {
    // A skill filter narrows to people who teach that specific skill.
    overlapClauses.length = 0;
    overlapClauses.push({ skill: new Types.ObjectId(options.skill), type: 'TEACH' });
  }

  const [candidateRows, connections, pendingRequests] = await Promise.all([
    UserSkill.aggregate<{ _id: Types.ObjectId }>([
      { $match: { $or: overlapClauses, user: { $ne: myId } } },
      { $group: { _id: '$user' } },
      { $limit: CANDIDATE_CAP },
    ]),
    Connection.find({ participants: myId, active: true }).select('participants').lean(),
    LearningRequest.find({
      status: 'PENDING',
      $or: [{ sender: myId }, { receiver: myId }],
    })
      .select('sender receiver')
      .lean(),
  ]);

  // Already-connected students and open requests belong on other screens; showing them
  // as "recommended" would invite duplicate requests the unique index then rejects.
  const excluded = new Set<string>([userId]);
  for (const c of connections) {
    for (const p of c.participants) excluded.add(String(p));
  }
  for (const r of pendingRequests) {
    excluded.add(String(r.sender));
    excluded.add(String(r.receiver));
  }
  // A block in either direction removes the pair from each other's recommendations.
  for (const id of await blockedEitherWay(userId)) excluded.add(String(id));

  const candidateIds = candidateRows
    .map((row) => row._id)
    .filter((id) => !excluded.has(String(id)));

  if (candidateIds.length === 0) return paginate([], 0, options);

  const [candidates, candidateSkills] = await Promise.all([
    User.find({ _id: { $in: candidateIds }, status: 'ACTIVE', role: 'STUDENT' }).lean<UserRow[]>(),
    UserSkill.find({ user: { $in: candidateIds } }).lean(),
  ]);

  const skillsByUser = new Map<string, typeof candidateSkills>();
  for (const s of candidateSkills) {
    const key = String(s.user);
    const list = skillsByUser.get(key);
    if (list) list.push(s);
    else skillsByUser.set(key, [s]);
  }

  const myProfile = toMatchProfile(me, mySkills);
  const weights = weightsFromEnv();

  const scored = candidates.map((candidate) => {
    const profile = toMatchProfile(candidate, skillsByUser.get(String(candidate._id)) ?? []);
    return { candidate, result: computeMatchScore(myProfile, profile, weights) };
  });

  let filtered = scored.filter((s) => s.result.score > 0);
  if (options.twoWayOnly) filtered = filtered.filter((s) => s.result.twoWay);
  if (options.minScore !== undefined) {
    filtered = filtered.filter((s) => s.result.score >= options.minScore!);
  }

  // Reciprocal exchanges outrank one-way matches at equal score, which is the whole
  // premise of the platform.
  filtered.sort((a, b) => {
    if (a.result.twoWay !== b.result.twoWay) return a.result.twoWay ? -1 : 1;
    return b.result.score - a.result.score;
  });

  const total = filtered.length;
  const start = (options.page - 1) * options.limit;
  const pageRows = filtered.slice(start, start + options.limit);

  // Resolve names once for everything on this page.
  const skillIds = new Set<string>();
  for (const row of pageRows) {
    for (const p of row.result.inbound) skillIds.add(p.skillId);
    for (const p of row.result.outbound) skillIds.add(p.skillId);
  }
  const skillDocs = await Skill.find({ _id: { $in: [...skillIds] } })
    .select('name')
    .lean();
  const skillNames = new Map(skillDocs.map((s) => [String(s._id), s.name]));

  const items: MatchCandidate[] = pageRows.map(({ candidate, result }) => {
    const item: MatchCandidate = {
      ...publicUser(candidate),
      matchScore: Number(result.score.toFixed(4)),
      matchPercent: Math.round(result.score * 100),
      twoWay: result.twoWay,
      breakdown: {
        skill: Number(result.breakdown.skill.toFixed(3)),
        availability: Number(result.breakdown.availability.toFixed(3)),
        experience: Number(result.breakdown.experience.toFixed(3)),
        rating: Number(result.breakdown.rating.toFixed(3)),
        location: Number(result.breakdown.location.toFixed(3)),
      },
      reasons: result.reasons,
      theyTeachYouWant: result.inbound.map((p) => ({
        id: p.skillId,
        name: skillNames.get(p.skillId) ?? 'Unknown skill',
        level: p.teacherLevel,
      })),
      youTeachTheyWant: result.outbound.map((p) => ({
        id: p.skillId,
        name: skillNames.get(p.skillId) ?? 'Unknown skill',
        level: p.teacherLevel,
      })),
      overlapMinutes: result.overlapMinutes,
    };
    if (result.distanceKm !== undefined) item.distanceKm = result.distanceKm;
    return item;
  });

  return paginate(items, total, options);
}

/** Score one specific pairing — used by the profile screen's "why this match" panel. */
export async function explainMatch(viewerId: string, otherId: string): Promise<MatchCandidate> {
  if (viewerId === otherId) throw ApiError.badRequest('Cannot match a student with themselves');

  const [me, other] = await Promise.all([
    User.findById(viewerId).lean<UserRow>(),
    User.findById(otherId).lean<UserRow>(),
  ]);
  if (!me) throw ApiError.notFound('Account not found');
  if (!other || other.status === 'BANNED') throw ApiError.notFound('Student not found');

  const [mySkills, theirSkills] = await Promise.all([
    UserSkill.find({ user: me._id }).lean(),
    UserSkill.find({ user: other._id }).lean(),
  ]);

  const result = computeMatchScore(
    toMatchProfile(me, mySkills),
    toMatchProfile(other, theirSkills),
    weightsFromEnv(),
  );

  const ids = [...result.inbound, ...result.outbound].map((p) => p.skillId);
  const skillDocs = await Skill.find({ _id: { $in: ids } })
    .select('name')
    .lean();
  const skillNames = new Map(skillDocs.map((s) => [String(s._id), s.name]));

  const item: MatchCandidate = {
    ...publicUser(other),
    matchScore: Number(result.score.toFixed(4)),
    matchPercent: Math.round(result.score * 100),
    twoWay: result.twoWay,
    breakdown: {
      skill: Number(result.breakdown.skill.toFixed(3)),
      availability: Number(result.breakdown.availability.toFixed(3)),
      experience: Number(result.breakdown.experience.toFixed(3)),
      rating: Number(result.breakdown.rating.toFixed(3)),
      location: Number(result.breakdown.location.toFixed(3)),
    },
    reasons: result.reasons,
    theyTeachYouWant: result.inbound.map((p) => ({
      id: p.skillId,
      name: skillNames.get(p.skillId) ?? 'Unknown skill',
      level: p.teacherLevel,
    })),
    youTeachTheyWant: result.outbound.map((p) => ({
      id: p.skillId,
      name: skillNames.get(p.skillId) ?? 'Unknown skill',
      level: p.teacherLevel,
    })),
    overlapMinutes: result.overlapMinutes,
  };
  if (result.distanceKm !== undefined) item.distanceKm = result.distanceKm;
  return item;
}
