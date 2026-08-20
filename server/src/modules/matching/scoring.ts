/**
 * Two-way skill-exchange scoring.
 *
 * This module is deliberately pure: no database, no I/O, no clock. Everything it needs
 * arrives as a `MatchProfile`, so the algorithm can be unit-tested exhaustively and
 * reasoned about in isolation — it is the core technical contribution of the project.
 *
 * Final score is a weighted sum of five components, each normalised to [0, 1]:
 *
 *     score = w_skill*skill + w_avail*availability + w_exp*experience
 *           + w_rating*rating + w_loc*location
 *
 * The weights default to the 40/20/15/15/10 split from the project spec and are
 * validated at startup to sum to 1, so the result is always in [0, 1].
 */

import { LEVEL_RANK, type SkillLevel, type TeachingMode } from '../../types/domain';
import type { AvailabilitySlot } from '../../models/User';

export interface ProfileSkill {
  skillId: string;
  level: SkillLevel;
  /** Learner-side importance, 1 (nice to have) .. 3 (top priority). Ignored for TEACH. */
  priority?: number;
}

export interface MatchProfile {
  id: string;
  teaches: ProfileSkill[];
  learns: ProfileSkill[];
  availability: AvailabilitySlot[];
  ratingSum: number;
  ratingCount: number;
  teachingMode: TeachingMode;
  college?: string;
  city?: string;
  /** [longitude, latitude] */
  coordinates?: [number, number];
}

export interface MatchWeights {
  skill: number;
  availability: number;
  experience: number;
  rating: number;
  location: number;
  /** Multiplier applied to skill compatibility when both directions are satisfied. */
  exchangeBonus: number;
  /** Distance at which the location score decays to its floor. */
  maxDistanceKm: number;
}

export const DEFAULT_WEIGHTS: MatchWeights = {
  skill: 0.4,
  availability: 0.2,
  experience: 0.15,
  rating: 0.15,
  location: 0.1,
  exchangeBonus: 1.25,
  maxDistanceKm: 50,
};

export interface SkillPairing {
  skillId: string;
  teacherLevel: SkillLevel;
  desiredLevel: SkillLevel;
  priority: number;
}

export interface MatchBreakdown {
  skill: number;
  availability: number;
  experience: number;
  rating: number;
  location: number;
}

export type MatchReasonCode =
  | 'TWO_WAY_EXCHANGE'
  | 'TEACHES_WHAT_YOU_WANT'
  | 'WANTS_WHAT_YOU_TEACH'
  | 'STRONG_AVAILABILITY_OVERLAP'
  | 'HIGHLY_RATED'
  | 'SAME_COLLEGE'
  | 'NEARBY'
  | 'EXPERIENCED_TEACHER';

export interface MatchReason {
  code: MatchReasonCode;
  /** Skill ids the reason refers to, where applicable. */
  skillIds?: string[];
  value?: number;
}

export interface MatchResult {
  /** Final weighted score in [0, 1]. */
  score: number;
  breakdown: MatchBreakdown;
  /** Skills *they* teach that *I* want to learn. */
  inbound: SkillPairing[];
  /** Skills *I* teach that *they* want to learn. */
  outbound: SkillPairing[];
  /** True when both directions are non-empty — a genuine exchange, not a one-way ask. */
  twoWay: boolean;
  /** Weekly overlapping availability, in minutes. */
  overlapMinutes: number;
  distanceKm?: number;
  /** Machine-readable explanation codes, rendered to text by the client. */
  reasons: MatchReason[];
}

const MINUTES_PER_DAY = 1440;
/** Prior for the Bayesian rating average: assume 3.5 stars with the weight of 3 reviews. */
const RATING_PRIOR_MEAN = 3.5;
const RATING_PRIOR_WEIGHT = 3;
/** Inbound (what I get) matters more than outbound (what I give) when ranking for me. */
const INBOUND_SHARE = 0.65;
const OUTBOUND_SHARE = 0.35;
/** Neutral value used when a signal is simply unknown, rather than known-bad. */
const UNKNOWN = 0.5;

export function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

/**
 * How well a teacher's level serves a learner's target level.
 *
 * A teacher one level above the target is ideal: close enough to remember the
 * beginner's difficulties, far enough to have the answers. Being far *above* is
 * only mildly better than being at the same level, and being below is a real penalty.
 */
export function levelPairScore(teacherLevel: SkillLevel, desiredLevel: SkillLevel): number {
  const diff = LEVEL_RANK[teacherLevel] - LEVEL_RANK[desiredLevel];
  if (diff <= -2) return 0;
  if (diff === -1) return 0.4;
  if (diff === 0) return 0.8;
  if (diff === 1) return 1;
  if (diff === 2) return 0.95;
  return 0.85;
}

/** "HH:mm" -> minutes since midnight. Returns null for malformed input. */
export function timeToMinutes(hhmm: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * Project weekly slots onto a single 0..10079 minute timeline and merge overlaps,
 * so a user who lists "Mon 9-11" and "Mon 10-12" is credited with 3 hours, not 4.
 */
export function slotsToIntervals(slots: AvailabilitySlot[]): Array<[number, number]> {
  const raw: Array<[number, number]> = [];
  for (const slot of slots) {
    if (!Number.isInteger(slot.day) || slot.day < 0 || slot.day > 6) continue;
    const start = timeToMinutes(slot.start);
    const end = timeToMinutes(slot.end);
    // Zero-length and inverted windows are dropped; overnight spans must be entered
    // as two slots, which keeps the timeline arithmetic total.
    if (start === null || end === null || end <= start) continue;
    const base = slot.day * MINUTES_PER_DAY;
    raw.push([base + start, base + end]);
  }
  raw.sort((a, b) => a[0] - b[0]);

  const merged: Array<[number, number]> = [];
  for (const interval of raw) {
    const last = merged[merged.length - 1];
    if (last && interval[0] <= last[1]) {
      last[1] = Math.max(last[1], interval[1]);
    } else {
      merged.push([interval[0], interval[1]]);
    }
  }
  return merged;
}

export function totalMinutes(intervals: Array<[number, number]>): number {
  return intervals.reduce((sum, [s, e]) => sum + (e - s), 0);
}

/** Minutes present in both interval sets. Both inputs must be sorted and merged. */
export function intersectMinutes(a: Array<[number, number]>, b: Array<[number, number]>): number {
  let i = 0;
  let j = 0;
  let total = 0;
  while (i < a.length && j < b.length) {
    const x = a[i];
    const y = b[j];
    if (!x || !y) break;
    const start = Math.max(x[0], y[0]);
    const end = Math.min(x[1], y[1]);
    if (end > start) total += end - start;
    // Advance whichever interval ends first; the other may still overlap the next one.
    if (x[1] < y[1]) i += 1;
    else j += 1;
  }
  return total;
}

export interface AvailabilityScore {
  score: number;
  overlapMinutes: number;
}

/**
 * Overlap as a fraction of the *more constrained* schedule. Dividing by the smaller
 * total means a student free 4 hours a week who overlaps all 4 scores 1.0, rather than
 * being punished for having less free time than their partner.
 */
export function availabilityScore(
  a: AvailabilitySlot[],
  b: AvailabilitySlot[],
): AvailabilityScore {
  const ia = slotsToIntervals(a);
  const ib = slotsToIntervals(b);
  const ta = totalMinutes(ia);
  const tb = totalMinutes(ib);
  // An empty calendar is missing data, not a scheduling conflict. Scoring it 0 would
  // bury every new user before they ever fill the form in.
  if (ta === 0 || tb === 0) return { score: UNKNOWN, overlapMinutes: 0 };

  const overlap = intersectMinutes(ia, ib);
  return { score: clamp01(overlap / Math.min(ta, tb)), overlapMinutes: overlap };
}

/**
 * Bayesian average, so one 5-star review does not outrank a 4.8 across forty.
 * Returns the star value in [1, 5].
 */
export function bayesianRating(ratingSum: number, ratingCount: number): number {
  const count = Math.max(0, ratingCount);
  const sum = Math.max(0, ratingSum);
  return (RATING_PRIOR_WEIGHT * RATING_PRIOR_MEAN + sum) / (RATING_PRIOR_WEIGHT + count);
}

/** Bayesian star average mapped onto [0, 1]. */
export function ratingScore(ratingSum: number, ratingCount: number): number {
  return clamp01((bayesianRating(ratingSum, ratingCount) - 1) / 4);
}

const MODE_SETS: Record<TeachingMode, ReadonlySet<'ONLINE' | 'OFFLINE'>> = {
  ONLINE: new Set(['ONLINE'] as const),
  OFFLINE: new Set(['OFFLINE'] as const),
  BOTH: new Set(['ONLINE', 'OFFLINE'] as const),
};

/** Great-circle distance in kilometres. */
export function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const [lon1, lat1] = a;
  const [lon2, lat2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export interface LocationScore {
  score: number;
  distanceKm?: number;
  /** False when the two students could never meet in a mutually acceptable mode. */
  compatible: boolean;
}

/**
 * Location only matters if the pair would ever meet in person. Two online-only students
 * are perfectly matched at any distance; an offline-only student paired with an
 * online-only one cannot meet at all.
 */
export function locationScore(
  a: MatchProfile,
  b: MatchProfile,
  maxDistanceKm: number,
): LocationScore {
  const setA = MODE_SETS[a.teachingMode];
  const setB = MODE_SETS[b.teachingMode];
  const shared = [...setA].filter((m) => setB.has(m));
  if (shared.length === 0) return { score: 0, compatible: false };
  if (!shared.includes('OFFLINE')) return { score: 1, compatible: true };

  if (a.college && b.college && a.college.toLowerCase() === b.college.toLowerCase()) {
    return { score: 1, compatible: true };
  }
  if (a.coordinates && b.coordinates) {
    const distanceKm = haversineKm(a.coordinates, b.coordinates);
    // Linear decay to a floor rather than to zero: a reachable-but-distant partner is
    // still worth surfacing when nobody closer teaches the skill.
    const decayed = 1 - distanceKm / maxDistanceKm;
    return { score: Math.max(0.15, clamp01(decayed)), distanceKm, compatible: true };
  }
  if (a.city && b.city && a.city.toLowerCase() === b.city.toLowerCase()) {
    return { score: 0.7, compatible: true };
  }
  return { score: UNKNOWN, compatible: true };
}

/** Pair up one side's LEARN list against the other's TEACH list. */
export function pairSkills(learner: ProfileSkill[], teacher: ProfileSkill[]): SkillPairing[] {
  const taught = new Map<string, ProfileSkill>();
  for (const t of teacher) taught.set(t.skillId, t);

  const pairs: SkillPairing[] = [];
  for (const want of learner) {
    const offer = taught.get(want.skillId);
    if (!offer) continue;
    pairs.push({
      skillId: want.skillId,
      teacherLevel: offer.level,
      desiredLevel: want.level,
      priority: want.priority ?? 1,
    });
  }
  return pairs;
}

function coverage(pairs: SkillPairing[], wants: ProfileSkill[]): number {
  const totalWeight = wants.reduce((sum, w) => sum + (w.priority ?? 1), 0);
  if (totalWeight === 0) return 0;
  const matchedWeight = pairs.reduce((sum, p) => sum + p.priority, 0);
  return clamp01(matchedWeight / totalWeight);
}

export interface SkillCompatibility {
  score: number;
  inbound: SkillPairing[];
  outbound: SkillPairing[];
  twoWay: boolean;
}

/**
 * Skill compatibility, weighted toward what the viewer stands to gain, with a bonus
 * when the exchange runs both ways. This is the "Student A ↔ Student B" case from the
 * spec: two one-way matches are worth less than one reciprocal pair.
 */
export function skillCompatibility(
  me: MatchProfile,
  other: MatchProfile,
  exchangeBonus: number,
): SkillCompatibility {
  const inbound = pairSkills(me.learns, other.teaches);
  const outbound = pairSkills(other.learns, me.teaches);

  const haveInboundSide = me.learns.length > 0;
  const haveOutboundSide = other.learns.length > 0;

  const inboundCoverage = haveInboundSide ? coverage(inbound, me.learns) : 0;
  const outboundCoverage = haveOutboundSide ? coverage(outbound, other.learns) : 0;

  let score: number;
  if (haveInboundSide && haveOutboundSide) {
    score = INBOUND_SHARE * inboundCoverage + OUTBOUND_SHARE * outboundCoverage;
  } else if (haveInboundSide) {
    // Nothing to give back is not the viewer's fault; judge on what they gain.
    score = inboundCoverage;
  } else if (haveOutboundSide) {
    score = outboundCoverage;
  } else {
    score = 0;
  }

  const twoWay = inbound.length > 0 && outbound.length > 0;
  if (twoWay) score = clamp01(score * exchangeBonus);

  return { score: clamp01(score), inbound, outbound, twoWay };
}

function experienceScore(inbound: SkillPairing[], outbound: SkillPairing[]): number {
  // Judge on what the viewer receives; fall back to what they give if they receive nothing.
  const pairs = inbound.length > 0 ? inbound : outbound;
  if (pairs.length === 0) return UNKNOWN;
  const total = pairs.reduce((sum, p) => sum + levelPairScore(p.teacherLevel, p.desiredLevel), 0);
  return clamp01(total / pairs.length);
}

/**
 * Score `other` as a learning partner for `me`. The result is asymmetric by design:
 * what A gains from B is not what B gains from A.
 */
export function computeMatchScore(
  me: MatchProfile,
  other: MatchProfile,
  weights: MatchWeights = DEFAULT_WEIGHTS,
): MatchResult {
  const skill = skillCompatibility(me, other, weights.exchangeBonus);
  const availability = availabilityScore(me.availability, other.availability);
  const experience = experienceScore(skill.inbound, skill.outbound);
  const rating = ratingScore(other.ratingSum, other.ratingCount);
  const location = locationScore(me, other, weights.maxDistanceKm);

  const breakdown: MatchBreakdown = {
    skill: skill.score,
    availability: availability.score,
    experience,
    rating,
    location: location.score,
  };

  const score = clamp01(
    weights.skill * breakdown.skill +
      weights.availability * breakdown.availability +
      weights.experience * breakdown.experience +
      weights.rating * breakdown.rating +
      weights.location * breakdown.location,
  );

  const reasons: MatchReason[] = [];
  if (skill.twoWay) {
    reasons.push({
      code: 'TWO_WAY_EXCHANGE',
      skillIds: [...skill.inbound, ...skill.outbound].map((p) => p.skillId),
    });
  }
  if (skill.inbound.length > 0) {
    reasons.push({ code: 'TEACHES_WHAT_YOU_WANT', skillIds: skill.inbound.map((p) => p.skillId) });
  }
  if (skill.outbound.length > 0) {
    reasons.push({ code: 'WANTS_WHAT_YOU_TEACH', skillIds: skill.outbound.map((p) => p.skillId) });
  }
  if (availability.overlapMinutes >= 120) {
    reasons.push({ code: 'STRONG_AVAILABILITY_OVERLAP', value: availability.overlapMinutes });
  }
  const bayes = bayesianRating(other.ratingSum, other.ratingCount);
  if (other.ratingCount >= 3 && bayes >= 4.3) {
    reasons.push({ code: 'HIGHLY_RATED', value: Number(bayes.toFixed(2)) });
  }
  if (experience >= 0.95 && skill.inbound.length > 0) {
    reasons.push({ code: 'EXPERIENCED_TEACHER', value: Number(experience.toFixed(2)) });
  }
  if (me.college && other.college && me.college.toLowerCase() === other.college.toLowerCase()) {
    reasons.push({ code: 'SAME_COLLEGE' });
  }
  if (location.distanceKm !== undefined && location.distanceKm <= 10) {
    reasons.push({ code: 'NEARBY', value: Number(location.distanceKm.toFixed(1)) });
  }

  const result: MatchResult = {
    score,
    breakdown,
    inbound: skill.inbound,
    outbound: skill.outbound,
    twoWay: skill.twoWay,
    overlapMinutes: availability.overlapMinutes,
    reasons,
  };
  if (location.distanceKm !== undefined) result.distanceKm = location.distanceKm;
  return result;
}
