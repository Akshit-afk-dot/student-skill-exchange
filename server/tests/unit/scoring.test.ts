import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WEIGHTS,
  availabilityScore,
  bayesianRating,
  computeMatchScore,
  haversineKm,
  intersectMinutes,
  levelPairScore,
  locationScore,
  pairSkills,
  ratingScore,
  skillCompatibility,
  slotsToIntervals,
  timeToMinutes,
  totalMinutes,
  type MatchProfile,
} from '../../src/modules/matching/scoring';
import type { AvailabilitySlot } from '../../src/models/User';

function profile(overrides: Partial<MatchProfile> = {}): MatchProfile {
  return {
    id: 'u1',
    teaches: [],
    learns: [],
    availability: [],
    ratingSum: 0,
    ratingCount: 0,
    teachingMode: 'BOTH',
    ...overrides,
  };
}

const slot = (day: number, start: string, end: string): AvailabilitySlot => ({ day, start, end });

describe('timeToMinutes', () => {
  it('parses valid 24-hour times', () => {
    expect(timeToMinutes('00:00')).toBe(0);
    expect(timeToMinutes('09:30')).toBe(570);
    expect(timeToMinutes('23:59')).toBe(1439);
  });

  it('rejects malformed or out-of-range times', () => {
    for (const bad of ['24:00', '9:30', '09:60', '', 'abc', '09:5']) {
      expect(timeToMinutes(bad)).toBeNull();
    }
  });
});

describe('slotsToIntervals', () => {
  it('offsets each slot onto a weekly timeline', () => {
    // Tuesday (day 2) 09:00 => 2*1440 + 540
    expect(slotsToIntervals([slot(2, '09:00', '11:00')])).toEqual([[3420, 3540]]);
  });

  it('merges overlapping slots on the same day so time is not double counted', () => {
    const merged = slotsToIntervals([slot(1, '09:00', '11:00'), slot(1, '10:00', '12:00')]);
    expect(merged).toEqual([[1440 + 540, 1440 + 720]]);
    expect(totalMinutes(merged)).toBe(180);
  });

  it('merges exactly-adjacent slots into one block', () => {
    expect(totalMinutes(slotsToIntervals([slot(0, '09:00', '10:00'), slot(0, '10:00', '11:00')]))).toBe(
      120,
    );
  });

  it('drops inverted, zero-length and out-of-range slots', () => {
    expect(slotsToIntervals([slot(1, '12:00', '09:00')])).toEqual([]);
    expect(slotsToIntervals([slot(1, '09:00', '09:00')])).toEqual([]);
    expect(slotsToIntervals([slot(9, '09:00', '10:00')])).toEqual([]);
    expect(slotsToIntervals([slot(1, 'oops', '10:00')])).toEqual([]);
  });

  it('keeps different days separate even at the same clock time', () => {
    const intervals = slotsToIntervals([slot(0, '09:00', '10:00'), slot(3, '09:00', '10:00')]);
    expect(intervals).toHaveLength(2);
    expect(totalMinutes(intervals)).toBe(120);
  });
});

describe('intersectMinutes', () => {
  it('returns 0 for disjoint sets', () => {
    expect(intersectMinutes([[0, 100]], [[200, 300]])).toBe(0);
  });

  it('counts partial overlap', () => {
    expect(intersectMinutes([[0, 100]], [[50, 300]])).toBe(50);
  });

  it('handles one interval spanning several on the other side', () => {
    expect(
      intersectMinutes(
        [[0, 1000]],
        [
          [100, 200],
          [400, 450],
        ],
      ),
    ).toBe(150);
  });

  it('treats touching endpoints as no overlap', () => {
    expect(intersectMinutes([[0, 100]], [[100, 200]])).toBe(0);
  });
});

describe('availabilityScore', () => {
  it('scores a full overlap of the more constrained schedule as 1', () => {
    // A is free 2h, B is free 6h, and A's 2h sits entirely inside B's window.
    const a = [slot(1, '10:00', '12:00')];
    const b = [slot(1, '09:00', '15:00')];
    const result = availabilityScore(a, b);
    expect(result.overlapMinutes).toBe(120);
    expect(result.score).toBe(1);
  });

  it('scores partial overlap proportionally', () => {
    const result = availabilityScore([slot(1, '10:00', '12:00')], [slot(1, '11:00', '13:00')]);
    expect(result.overlapMinutes).toBe(60);
    expect(result.score).toBeCloseTo(0.5, 6);
  });

  it('scores no overlap as 0 when both sides declared availability', () => {
    const result = availabilityScore([slot(1, '08:00', '09:00')], [slot(4, '18:00', '19:00')]);
    expect(result.overlapMinutes).toBe(0);
    expect(result.score).toBe(0);
  });

  it('returns a neutral 0.5 when either calendar is empty, rather than punishing new users', () => {
    expect(availabilityScore([], [slot(1, '09:00', '10:00')]).score).toBe(0.5);
    expect(availabilityScore([slot(1, '09:00', '10:00')], []).score).toBe(0.5);
    expect(availabilityScore([], []).score).toBe(0.5);
  });
});

describe('levelPairScore', () => {
  it('rewards a teacher exactly one level above the target most', () => {
    expect(levelPairScore('INTERMEDIATE', 'BEGINNER')).toBe(1);
  });

  it('ranks one-above > two-above > three-above > same level', () => {
    const oneAbove = levelPairScore('INTERMEDIATE', 'BEGINNER');
    const twoAbove = levelPairScore('ADVANCED', 'BEGINNER');
    const threeAbove = levelPairScore('EXPERT', 'BEGINNER');
    const same = levelPairScore('BEGINNER', 'BEGINNER');
    expect(oneAbove).toBeGreaterThan(twoAbove);
    expect(twoAbove).toBeGreaterThan(threeAbove);
    expect(threeAbove).toBeGreaterThan(same);
  });

  it('penalises a teacher below the desired level and zeroes out a big gap', () => {
    expect(levelPairScore('BEGINNER', 'INTERMEDIATE')).toBe(0.4);
    expect(levelPairScore('BEGINNER', 'ADVANCED')).toBe(0);
    expect(levelPairScore('BEGINNER', 'EXPERT')).toBe(0);
  });

  it('always returns a value within [0, 1]', () => {
    const levels = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'] as const;
    for (const t of levels) {
      for (const d of levels) {
        const s = levelPairScore(t, d);
        expect(s).toBeGreaterThanOrEqual(0);
        expect(s).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('bayesianRating', () => {
  it('pulls an unrated user toward the 3.5 prior', () => {
    expect(bayesianRating(0, 0)).toBeCloseTo(3.5, 6);
  });

  it('ranks a 4.8 across many reviews above a single 5-star', () => {
    const oneFiveStar = bayesianRating(5, 1);
    const manyHigh = bayesianRating(4.8 * 40, 40);
    expect(manyHigh).toBeGreaterThan(oneFiveStar);
  });

  it('converges to the true mean as review count grows', () => {
    expect(bayesianRating(4 * 500, 500)).toBeCloseTo(4, 1);
  });

  it('normalises 1..5 stars onto 0..1', () => {
    expect(ratingScore(1 * 1000, 1000)).toBeCloseTo(0, 2);
    expect(ratingScore(5 * 1000, 1000)).toBeCloseTo(1, 2);
  });
});

describe('haversineKm', () => {
  it('returns 0 for identical points', () => {
    expect(haversineKm([77.5946, 12.9716], [77.5946, 12.9716])).toBe(0);
  });

  it('approximates a known distance (Bengaluru to Mysuru ~ 140km)', () => {
    const d = haversineKm([77.5946, 12.9716], [76.6394, 12.2958]);
    expect(d).toBeGreaterThan(120);
    expect(d).toBeLessThan(160);
  });
});

describe('locationScore', () => {
  it('treats distance as irrelevant when both students are online-only', () => {
    const a = profile({ teachingMode: 'ONLINE', coordinates: [77.59, 12.97] });
    const b = profile({ teachingMode: 'ONLINE', coordinates: [-74.0, 40.7] });
    expect(locationScore(a, b, 50)).toEqual({ score: 1, compatible: true });
  });

  it('marks an online-only and offline-only pair as incompatible', () => {
    const a = profile({ teachingMode: 'ONLINE' });
    const b = profile({ teachingMode: 'OFFLINE' });
    const result = locationScore(a, b, 50);
    expect(result.compatible).toBe(false);
    expect(result.score).toBe(0);
  });

  it('gives a perfect score to same-college students who can meet offline', () => {
    const a = profile({ teachingMode: 'BOTH', college: 'PES University' });
    const b = profile({ teachingMode: 'OFFLINE', college: 'pes university' });
    expect(locationScore(a, b, 50).score).toBe(1);
  });

  it('decays with distance and reports the distance', () => {
    const a = profile({ teachingMode: 'OFFLINE', coordinates: [77.5946, 12.9716] });
    const near = profile({ teachingMode: 'OFFLINE', coordinates: [77.6146, 12.9816] });
    const far = profile({ teachingMode: 'OFFLINE', coordinates: [76.6394, 12.2958] });

    const nearScore = locationScore(a, near, 50);
    const farScore = locationScore(a, far, 50);

    expect(nearScore.distanceKm).toBeLessThan(5);
    expect(nearScore.score).toBeGreaterThan(0.9);
    expect(farScore.score).toBe(0.15); // beyond max distance, floored rather than zeroed
    expect(farScore.score).toBeLessThan(nearScore.score);
  });

  it('falls back to a city match, then to neutral', () => {
    const a = profile({ teachingMode: 'BOTH', city: 'Bengaluru' });
    const b = profile({ teachingMode: 'BOTH', city: 'bengaluru' });
    expect(locationScore(a, b, 50).score).toBe(0.7);
    expect(locationScore(profile(), profile(), 50).score).toBe(0.5);
  });
});

describe('pairSkills', () => {
  it('pairs only skills present on both sides', () => {
    const pairs = pairSkills(
      [
        { skillId: 'python', level: 'BEGINNER' },
        { skillId: 'figma', level: 'INTERMEDIATE' },
      ],
      [
        { skillId: 'python', level: 'ADVANCED' },
        { skillId: 'guitar', level: 'EXPERT' },
      ],
    );
    expect(pairs).toEqual([
      { skillId: 'python', teacherLevel: 'ADVANCED', desiredLevel: 'BEGINNER', priority: 1 },
    ]);
  });

  it('carries the learner priority through', () => {
    const pairs = pairSkills(
      [{ skillId: 'python', level: 'BEGINNER', priority: 3 }],
      [{ skillId: 'python', level: 'ADVANCED' }],
    );
    expect(pairs[0]?.priority).toBe(3);
  });
});

describe('skillCompatibility — the two-way exchange rule', () => {
  const bonus = DEFAULT_WEIGHTS.exchangeBonus;

  it('scores the canonical A<->B exchange from the spec above a one-way match', () => {
    // A teaches Python, wants Photoshop. B teaches Photoshop, wants Python.
    const a = profile({
      id: 'A',
      teaches: [{ skillId: 'python', level: 'ADVANCED' }],
      learns: [{ skillId: 'photoshop', level: 'BEGINNER' }],
    });
    const b = profile({
      id: 'B',
      teaches: [{ skillId: 'photoshop', level: 'ADVANCED' }],
      learns: [{ skillId: 'python', level: 'BEGINNER' }],
    });
    // C teaches Photoshop but wants something A cannot give.
    const c = profile({
      id: 'C',
      teaches: [{ skillId: 'photoshop', level: 'ADVANCED' }],
      learns: [{ skillId: 'guitar', level: 'BEGINNER' }],
    });

    const twoWay = skillCompatibility(a, b, bonus);
    const oneWay = skillCompatibility(a, c, bonus);

    expect(twoWay.twoWay).toBe(true);
    expect(oneWay.twoWay).toBe(false);
    expect(twoWay.score).toBeGreaterThan(oneWay.score);
    expect(twoWay.inbound.map((p) => p.skillId)).toEqual(['photoshop']);
    expect(twoWay.outbound.map((p) => p.skillId)).toEqual(['python']);
  });

  it('caps the exchange bonus at 1', () => {
    const a = profile({
      teaches: [{ skillId: 'python', level: 'ADVANCED' }],
      learns: [{ skillId: 'figma', level: 'BEGINNER' }],
    });
    const b = profile({
      teaches: [{ skillId: 'figma', level: 'ADVANCED' }],
      learns: [{ skillId: 'python', level: 'BEGINNER' }],
    });
    // Perfect coverage both ways would be 1.0 * 1.25 without the clamp.
    expect(skillCompatibility(a, b, bonus).score).toBe(1);
  });

  it('weights partial coverage by learner priority', () => {
    const me = profile({
      learns: [
        { skillId: 'python', level: 'BEGINNER', priority: 3 },
        { skillId: 'guitar', level: 'BEGINNER', priority: 1 },
      ],
    });
    const teachesPriority = profile({ teaches: [{ skillId: 'python', level: 'ADVANCED' }] });
    const teachesTrivial = profile({ teaches: [{ skillId: 'guitar', level: 'ADVANCED' }] });

    // 3/4 of the weighted demand vs 1/4.
    expect(skillCompatibility(me, teachesPriority, bonus).score).toBeCloseTo(0.75, 6);
    expect(skillCompatibility(me, teachesTrivial, bonus).score).toBeCloseTo(0.25, 6);
  });

  it('scores 0 when neither side lists anything to learn', () => {
    const a = profile({ teaches: [{ skillId: 'python', level: 'ADVANCED' }] });
    const b = profile({ teaches: [{ skillId: 'figma', level: 'ADVANCED' }] });
    expect(skillCompatibility(a, b, bonus).score).toBe(0);
  });

  it('judges on inbound alone when the other side wants nothing', () => {
    const me = profile({ learns: [{ skillId: 'python', level: 'BEGINNER' }] });
    const them = profile({ teaches: [{ skillId: 'python', level: 'ADVANCED' }] });
    expect(skillCompatibility(me, them, bonus).score).toBe(1);
  });

  it('is asymmetric: what A gains from B differs from what B gains from A', () => {
    const a = profile({ learns: [{ skillId: 'python', level: 'BEGINNER' }] });
    const b = profile({
      teaches: [{ skillId: 'python', level: 'ADVANCED' }],
      learns: [{ skillId: 'guitar', level: 'BEGINNER' }],
    });
    const aSeesB = skillCompatibility(a, b, bonus);
    const bSeesA = skillCompatibility(b, a, bonus);
    expect(aSeesB.score).toBeGreaterThan(bSeesA.score);
  });
});

describe('computeMatchScore', () => {
  it('produces a score in [0, 1] and a breakdown that reproduces it', () => {
    const a = profile({
      teaches: [{ skillId: 'python', level: 'ADVANCED' }],
      learns: [{ skillId: 'figma', level: 'BEGINNER' }],
      availability: [slot(1, '18:00', '20:00')],
      college: 'PES University',
    });
    const b = profile({
      id: 'B',
      teaches: [{ skillId: 'figma', level: 'INTERMEDIATE' }],
      learns: [{ skillId: 'python', level: 'BEGINNER' }],
      availability: [slot(1, '18:00', '21:00')],
      ratingSum: 4.6 * 10,
      ratingCount: 10,
      college: 'PES University',
    });

    const r = computeMatchScore(a, b);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(1);

    const w = DEFAULT_WEIGHTS;
    const recomputed =
      w.skill * r.breakdown.skill +
      w.availability * r.breakdown.availability +
      w.experience * r.breakdown.experience +
      w.rating * r.breakdown.rating +
      w.location * r.breakdown.location;
    expect(r.score).toBeCloseTo(recomputed, 10);
  });

  it('explains itself with the reasons that apply', () => {
    const a = profile({
      teaches: [{ skillId: 'python', level: 'ADVANCED' }],
      learns: [{ skillId: 'figma', level: 'BEGINNER' }],
      availability: [slot(1, '18:00', '21:00')],
      college: 'PES University',
    });
    const b = profile({
      id: 'B',
      teaches: [{ skillId: 'figma', level: 'INTERMEDIATE' }],
      learns: [{ skillId: 'python', level: 'BEGINNER' }],
      availability: [slot(1, '18:00', '21:00')],
      ratingSum: 4.8 * 12,
      ratingCount: 12,
      college: 'PES University',
    });

    const codes = computeMatchScore(a, b).reasons.map((x) => x.code);
    expect(codes).toContain('TWO_WAY_EXCHANGE');
    expect(codes).toContain('TEACHES_WHAT_YOU_WANT');
    expect(codes).toContain('WANTS_WHAT_YOU_TEACH');
    expect(codes).toContain('STRONG_AVAILABILITY_OVERLAP');
    expect(codes).toContain('HIGHLY_RATED');
    expect(codes).toContain('SAME_COLLEGE');
  });

  it('ranks a reciprocal partner above an equally-skilled one-way teacher', () => {
    const me = profile({
      teaches: [{ skillId: 'python', level: 'ADVANCED' }],
      learns: [{ skillId: 'figma', level: 'BEGINNER' }],
      availability: [slot(1, '18:00', '20:00')],
    });
    const shared = {
      teaches: [{ skillId: 'figma', level: 'INTERMEDIATE' as const }],
      availability: [slot(1, '18:00', '20:00')],
      ratingSum: 4.5 * 8,
      ratingCount: 8,
    };
    const reciprocal = profile({
      id: 'R',
      ...shared,
      learns: [{ skillId: 'python', level: 'BEGINNER' }],
    });
    const oneWay = profile({ id: 'O', ...shared, learns: [{ skillId: 'guitar', level: 'BEGINNER' }] });

    expect(computeMatchScore(me, reciprocal).score).toBeGreaterThan(
      computeMatchScore(me, oneWay).score,
    );
  });

  it('gives a mode-incompatible pair a zero location component', () => {
    const me = profile({ teachingMode: 'ONLINE', learns: [{ skillId: 'python', level: 'BEGINNER' }] });
    const them = profile({
      teachingMode: 'OFFLINE',
      teaches: [{ skillId: 'python', level: 'ADVANCED' }],
    });
    expect(computeMatchScore(me, them).breakdown.location).toBe(0);
  });

  it('handles completely empty profiles without throwing or producing NaN', () => {
    const r = computeMatchScore(profile(), profile({ id: 'B' }));
    expect(Number.isNaN(r.score)).toBe(false);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.twoWay).toBe(false);
    expect(r.inbound).toEqual([]);
  });

  it('never exceeds 1 even with every component maximised', () => {
    const perfect = profile({
      teaches: [{ skillId: 'python', level: 'ADVANCED' }],
      learns: [{ skillId: 'figma', level: 'BEGINNER' }],
      availability: [slot(1, '00:00', '23:59')],
      college: 'Same',
      ratingSum: 5 * 100,
      ratingCount: 100,
    });
    const mirror = profile({
      id: 'B',
      teaches: [{ skillId: 'figma', level: 'INTERMEDIATE' }],
      learns: [{ skillId: 'python', level: 'BEGINNER' }],
      availability: [slot(1, '00:00', '23:59')],
      college: 'Same',
      ratingSum: 5 * 100,
      ratingCount: 100,
    });
    expect(computeMatchScore(perfect, mirror).score).toBeLessThanOrEqual(1);
  });
});
