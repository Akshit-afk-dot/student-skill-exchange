import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { User } from '../../src/models';
import { API, addUserSkill, auth, getApp, registerUser, seedSkill } from '../helpers/api';
import { clearDb, startTestDb, stopTestDb } from '../helpers/db';

beforeAll(async () => {
  await startTestDb();
});
afterAll(async () => {
  await stopTestDb();
});
afterEach(async () => {
  await clearDb();
});

describe('GET /matches — recommendations', () => {
  it('returns an empty page for a student with no skills listed', async () => {
    const user = await registerUser();

    const res = await request(getApp())
      .get(`${API}/matches`)
      .set(auth(user.accessToken))
      .expect(200);

    expect(res.body.data.items).toEqual([]);
    expect(res.body.data.total).toBe(0);
  });

  it('surfaces the canonical two-way exchange from the project spec', async () => {
    const python = await seedSkill('Python');
    const photoshop = await seedSkill('Adobe Photoshop', 'Design');

    // Student A: teaches Python, wants Photoshop.
    const a = await registerUser({ name: 'Student A' });
    await addUserSkill(a.accessToken, python, 'TEACH', 'ADVANCED');
    await addUserSkill(a.accessToken, photoshop, 'LEARN', 'BEGINNER');

    // Student B: teaches Photoshop, wants Python — the reciprocal.
    const b = await registerUser({ name: 'Student B' });
    await addUserSkill(b.accessToken, photoshop, 'TEACH', 'ADVANCED');
    await addUserSkill(b.accessToken, python, 'LEARN', 'BEGINNER');

    const res = await request(getApp())
      .get(`${API}/matches`)
      .set(auth(a.accessToken))
      .expect(200);

    expect(res.body.data.items).toHaveLength(1);
    const match = res.body.data.items[0];
    expect(match.id).toBe(b.id);
    expect(match.twoWay).toBe(true);
    expect(match.theyTeachYouWant.map((s: { name: string }) => s.name)).toEqual([
      'Adobe Photoshop',
    ]);
    expect(match.youTeachTheyWant.map((s: { name: string }) => s.name)).toEqual(['Python']);
    expect(match.reasons.map((r: { code: string }) => r.code)).toContain('TWO_WAY_EXCHANGE');
  });

  it('ranks a reciprocal partner above an equally-skilled one-way teacher', async () => {
    const python = await seedSkill('Python');
    const figma = await seedSkill('Figma', 'Design');
    const guitar = await seedSkill('Guitar', 'Music');

    const me = await registerUser({ name: 'Me' });
    await addUserSkill(me.accessToken, python, 'TEACH', 'ADVANCED');
    await addUserSkill(me.accessToken, figma, 'LEARN', 'BEGINNER');

    const reciprocal = await registerUser({ name: 'Reciprocal' });
    await addUserSkill(reciprocal.accessToken, figma, 'TEACH', 'INTERMEDIATE');
    await addUserSkill(reciprocal.accessToken, python, 'LEARN', 'BEGINNER');

    const oneWay = await registerUser({ name: 'One Way' });
    await addUserSkill(oneWay.accessToken, figma, 'TEACH', 'INTERMEDIATE');
    await addUserSkill(oneWay.accessToken, guitar, 'LEARN', 'BEGINNER');

    const res = await request(getApp())
      .get(`${API}/matches`)
      .set(auth(me.accessToken))
      .expect(200);

    const ids = res.body.data.items.map((i: { id: string }) => i.id);
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe(reciprocal.id);
    expect(ids[1]).toBe(oneWay.id);
    expect(res.body.data.items[0].matchScore).toBeGreaterThan(res.body.data.items[1].matchScore);
  });

  it('filters to reciprocal exchanges with twoWayOnly', async () => {
    const python = await seedSkill('Python');
    const figma = await seedSkill('Figma', 'Design');
    const guitar = await seedSkill('Guitar', 'Music');

    const me = await registerUser();
    await addUserSkill(me.accessToken, python, 'TEACH', 'ADVANCED');
    await addUserSkill(me.accessToken, figma, 'LEARN', 'BEGINNER');

    const oneWay = await registerUser();
    await addUserSkill(oneWay.accessToken, figma, 'TEACH', 'INTERMEDIATE');
    await addUserSkill(oneWay.accessToken, guitar, 'LEARN', 'BEGINNER');

    const all = await request(getApp())
      .get(`${API}/matches`)
      .set(auth(me.accessToken))
      .expect(200);
    expect(all.body.data.items).toHaveLength(1);

    const filtered = await request(getApp())
      .get(`${API}/matches?twoWayOnly=true`)
      .set(auth(me.accessToken))
      .expect(200);
    expect(filtered.body.data.items).toHaveLength(0);
  });

  it('excludes students who are already connected', async () => {
    const python = await seedSkill('Python');
    const figma = await seedSkill('Figma', 'Design');

    const me = await registerUser();
    await addUserSkill(me.accessToken, python, 'TEACH', 'ADVANCED');
    await addUserSkill(me.accessToken, figma, 'LEARN', 'BEGINNER');

    const other = await registerUser();
    await addUserSkill(other.accessToken, figma, 'TEACH', 'ADVANCED');
    await addUserSkill(other.accessToken, python, 'LEARN', 'BEGINNER');

    const before = await request(getApp())
      .get(`${API}/matches`)
      .set(auth(me.accessToken))
      .expect(200);
    expect(before.body.data.items).toHaveLength(1);

    // Send a request; it is now pending, so they drop out of recommendations.
    await request(getApp())
      .post(`${API}/requests`)
      .set(auth(me.accessToken))
      .send({ receiverId: other.id, skillId: figma, message: 'Teach me Figma please' })
      .expect(201);

    const after = await request(getApp())
      .get(`${API}/matches`)
      .set(auth(me.accessToken))
      .expect(200);
    expect(after.body.data.items).toHaveLength(0);
  });

  it('excludes suspended and banned students', async () => {
    const python = await seedSkill('Python');
    const figma = await seedSkill('Figma', 'Design');

    const me = await registerUser();
    await addUserSkill(me.accessToken, figma, 'LEARN', 'BEGINNER');

    const banned = await registerUser();
    await addUserSkill(banned.accessToken, figma, 'TEACH', 'ADVANCED');
    await addUserSkill(banned.accessToken, python, 'LEARN', 'BEGINNER');
    await User.updateOne({ _id: banned.id }, { $set: { status: 'BANNED' } });

    const res = await request(getApp())
      .get(`${API}/matches`)
      .set(auth(me.accessToken))
      .expect(200);

    expect(res.body.data.items).toHaveLength(0);
  });

  it('never recommends the student to themselves', async () => {
    const python = await seedSkill('Python');
    const me = await registerUser();
    // Both teaching and wanting the same skill is legal (learning it at a higher level).
    await addUserSkill(me.accessToken, python, 'TEACH', 'BEGINNER');
    await addUserSkill(me.accessToken, python, 'LEARN', 'ADVANCED');

    const res = await request(getApp())
      .get(`${API}/matches`)
      .set(auth(me.accessToken))
      .expect(200);

    expect(res.body.data.items.map((i: { id: string }) => i.id)).not.toContain(me.id);
  });

  it('returns a breakdown consistent with the published weights', async () => {
    const python = await seedSkill('Python');
    const figma = await seedSkill('Figma', 'Design');

    const me = await registerUser();
    await addUserSkill(me.accessToken, python, 'TEACH', 'ADVANCED');
    await addUserSkill(me.accessToken, figma, 'LEARN', 'BEGINNER');

    const other = await registerUser();
    await addUserSkill(other.accessToken, figma, 'TEACH', 'INTERMEDIATE');
    await addUserSkill(other.accessToken, python, 'LEARN', 'BEGINNER');

    const weightsRes = await request(getApp())
      .get(`${API}/matches/weights`)
      .set(auth(me.accessToken))
      .expect(200);
    const w = weightsRes.body.data;

    const res = await request(getApp())
      .get(`${API}/matches`)
      .set(auth(me.accessToken))
      .expect(200);
    const match = res.body.data.items[0];

    const recomputed =
      w.skill * match.breakdown.skill +
      w.availability * match.breakdown.availability +
      w.experience * match.breakdown.experience +
      w.rating * match.breakdown.rating +
      w.location * match.breakdown.location;

    // Breakdown values are rounded to 3dp for display, so allow for that.
    expect(match.matchScore).toBeCloseTo(recomputed, 2);
  });

  it('paginates', async () => {
    const figma = await seedSkill('Figma', 'Design');
    const me = await registerUser();
    await addUserSkill(me.accessToken, figma, 'LEARN', 'BEGINNER');

    for (let i = 0; i < 5; i += 1) {
      const teacher = await registerUser();
      await addUserSkill(teacher.accessToken, figma, 'TEACH', 'ADVANCED');
    }

    const page1 = await request(getApp())
      .get(`${API}/matches?page=1&limit=2`)
      .set(auth(me.accessToken))
      .expect(200);

    expect(page1.body.data.items).toHaveLength(2);
    expect(page1.body.data.total).toBe(5);
    expect(page1.body.data.hasMore).toBe(true);

    const page3 = await request(getApp())
      .get(`${API}/matches?page=3&limit=2`)
      .set(auth(me.accessToken))
      .expect(200);
    expect(page3.body.data.items).toHaveLength(1);
    expect(page3.body.data.hasMore).toBe(false);
  });
});

describe('GET /matches/:id — explain one pairing', () => {
  it('returns the full breakdown for a specific student', async () => {
    const python = await seedSkill('Python');
    const figma = await seedSkill('Figma', 'Design');

    const me = await registerUser();
    await addUserSkill(me.accessToken, python, 'TEACH', 'ADVANCED');
    await addUserSkill(me.accessToken, figma, 'LEARN', 'BEGINNER');

    const other = await registerUser();
    await addUserSkill(other.accessToken, figma, 'TEACH', 'INTERMEDIATE');
    await addUserSkill(other.accessToken, python, 'LEARN', 'BEGINNER');

    const res = await request(getApp())
      .get(`${API}/matches/${other.id}`)
      .set(auth(me.accessToken))
      .expect(200);

    expect(res.body.data.id).toBe(other.id);
    expect(res.body.data.twoWay).toBe(true);
    expect(res.body.data.matchPercent).toBeGreaterThan(0);
    expect(res.body.data.breakdown).toHaveProperty('skill');
  });

  it('refuses to match a student with themselves', async () => {
    const me = await registerUser();
    await request(getApp())
      .get(`${API}/matches/${me.id}`)
      .set(auth(me.accessToken))
      .expect(400);
  });
});

describe('GET /users — skill discovery search', () => {
  it('finds students who teach a specific skill', async () => {
    const python = await seedSkill('Python');
    const guitar = await seedSkill('Guitar', 'Music');

    const teacher = await registerUser({ name: 'Python Teacher' });
    await addUserSkill(teacher.accessToken, python, 'TEACH', 'ADVANCED');

    const other = await registerUser({ name: 'Guitar Teacher' });
    await addUserSkill(other.accessToken, guitar, 'TEACH', 'ADVANCED');

    const res = await request(getApp()).get(`${API}/users?skill=${python}`).expect(200);

    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].name).toBe('Python Teacher');
    expect(res.body.data.items[0].matchedSkillLevel).toBe('ADVANCED');
  });

  it('filters by the level a skill is taught at', async () => {
    const python = await seedSkill('Python');

    const expert = await registerUser({ name: 'Expert' });
    await addUserSkill(expert.accessToken, python, 'TEACH', 'EXPERT');

    const beginner = await registerUser({ name: 'Beginner' });
    await addUserSkill(beginner.accessToken, python, 'TEACH', 'BEGINNER');

    const res = await request(getApp())
      .get(`${API}/users?skill=${python}&level=EXPERT`)
      .expect(200);

    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].name).toBe('Expert');
  });

  it('filters by college', async () => {
    await registerUser({ name: 'PES Student', college: 'PES University' });
    await registerUser({ name: 'RV Student', college: 'RV College' });

    const res = await request(getApp())
      .get(`${API}/users?college=${encodeURIComponent('PES University')}`)
      .expect(200);

    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].name).toBe('PES Student');
  });

  it('excludes the viewer from their own search results', async () => {
    const me = await registerUser({ name: 'Me' });
    await registerUser({ name: 'Someone Else' });

    const res = await request(getApp())
      .get(`${API}/users`)
      .set(auth(me.accessToken))
      .expect(200);

    expect(res.body.data.items.map((i: { id: string }) => i.id)).not.toContain(me.id);
  });

  it('excludes suspended students from search', async () => {
    const visible = await registerUser({ name: 'Visible' });
    const hidden = await registerUser({ name: 'Hidden' });
    await User.updateOne({ _id: hidden.id }, { $set: { status: 'SUSPENDED' } });

    const res = await request(getApp()).get(`${API}/users`).expect(200);

    const names = res.body.data.items.map((i: { name: string }) => i.name);
    expect(names).toContain('Visible');
    expect(names).not.toContain('Hidden');
    expect(visible).toBeTruthy();
  });

  it('finds students near a location and reports the distance', async () => {
    const near = await registerUser({ name: 'Nearby' });
    const far = await registerUser({ name: 'Faraway' });

    // Bengaluru city centre and ~140km away in Mysuru.
    await request(getApp())
      .put(`${API}/users/me/location`)
      .set(auth(near.accessToken))
      .send({ longitude: 77.5946, latitude: 12.9716 })
      .expect(200);

    await request(getApp())
      .put(`${API}/users/me/location`)
      .set(auth(far.accessToken))
      .send({ longitude: 76.6394, latitude: 12.2958 })
      .expect(200);

    const res = await request(getApp())
      .get(`${API}/users?longitude=77.5946&latitude=12.9716&radiusKm=25`)
      .expect(200);

    const names = res.body.data.items.map((i: { name: string }) => i.name);
    expect(names).toContain('Nearby');
    expect(names).not.toContain('Faraway');
    expect(res.body.data.items[0].distanceKm).toBeLessThan(1);
  });

  it('rejects a half-specified coordinate pair', async () => {
    await request(getApp()).get(`${API}/users?longitude=77.5`).expect(422);
  });

  it('never leaks precise coordinates of other students', async () => {
    const student = await registerUser();
    await request(getApp())
      .put(`${API}/users/me/location`)
      .set(auth(student.accessToken))
      .send({ longitude: 77.5946, latitude: 12.9716, city: 'Bengaluru' })
      .expect(200);

    const res = await request(getApp()).get(`${API}/users/${student.id}`).expect(200);

    expect(res.body.data.city).toBe('Bengaluru');
    expect(JSON.stringify(res.body)).not.toContain('77.5946');
  });
});
