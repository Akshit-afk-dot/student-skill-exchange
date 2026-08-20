import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { AuditLog, Report, Review, Session, Skill, User, UserSkill } from '../../src/models';
import {
  API,
  addUserSkill,
  auth,
  connectUsers,
  getApp,
  login,
  makeAdmin,
  registerUser,
  seedSkill,
  type TestUser,
} from '../helpers/api';
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

/** Registers a student and promotes them, returning a token that carries the ADMIN role. */
async function createAdmin(): Promise<{ user: TestUser; token: string }> {
  const user = await registerUser({ name: 'Admin User' });
  await makeAdmin(user.email);
  const token = await login(user.email, user.password);
  return { user, token };
}

describe('admin access control', () => {
  it('rejects anonymous and ordinary students', async () => {
    const student = await registerUser();

    await request(getApp()).get(`${API}/admin/stats`).expect(401);
    await request(getApp())
      .get(`${API}/admin/stats`)
      .set(auth(student.accessToken))
      .expect(403);
  });

  it('allows an administrator', async () => {
    const { token } = await createAdmin();
    await request(getApp()).get(`${API}/admin/stats`).set(auth(token)).expect(200);
  });

  it('stops using a stale token after a role is revoked', async () => {
    const { user, token } = await createAdmin();

    await request(getApp()).get(`${API}/admin/stats`).set(auth(token)).expect(200);

    // The middleware re-reads the user on every request, so a demotion is immediate.
    await User.updateOne({ _id: user.id }, { $set: { role: 'STUDENT' } });
    await request(getApp()).get(`${API}/admin/stats`).set(auth(token)).expect(403);
  });
});

describe('GET /admin/stats', () => {
  it('reports platform-wide counts', async () => {
    const { token } = await createAdmin();
    const figma = await seedSkill('Figma', 'Design');

    const a = await registerUser();
    await addUserSkill(a.accessToken, figma, 'LEARN', 'BEGINNER');
    const b = await registerUser();
    await addUserSkill(b.accessToken, figma, 'TEACH', 'ADVANCED');
    await connectUsers(a, b, figma);

    const res = await request(getApp()).get(`${API}/admin/stats`).set(auth(token)).expect(200);

    const stats = res.body.data;
    expect(stats.users.total).toBe(2); // the admin is not counted as a student
    expect(stats.users.active).toBe(2);
    expect(stats.community.connections).toBe(1);
    expect(stats.requests.accepted).toBe(1);
    expect(stats.requests.acceptanceRate).toBe(100);
    expect(Array.isArray(stats.growth)).toBe(true);
    expect(stats.topSkills.mostTaught[0].name).toBe('Figma');
  });
});

describe('user moderation', () => {
  it('suspends an account, revokes its sessions and lifts on reinstatement', async () => {
    const { token } = await createAdmin();
    const student = await registerUser();

    await request(getApp())
      .post(`${API}/admin/users/${student.id}/moderate`)
      .set(auth(token))
      .send({ status: 'SUSPENDED', suspendDays: 7, reason: 'Spamming learning requests' })
      .expect(200);

    // Existing access token now fails.
    await request(getApp()).get(`${API}/auth/me`).set(auth(student.accessToken)).expect(403);
    // And the refresh token was revoked, so they cannot mint a new one.
    await request(getApp())
      .post(`${API}/auth/refresh`)
      .send({ refreshToken: student.refreshToken })
      .expect(401);

    await request(getApp())
      .post(`${API}/admin/users/${student.id}/moderate`)
      .set(auth(token))
      .send({ status: 'ACTIVE', reason: 'Appeal upheld' })
      .expect(200);

    await request(getApp())
      .post(`${API}/auth/login`)
      .send({ email: student.email, password: student.password })
      .expect(200);
  });

  it('sets a suspension end date from suspendDays', async () => {
    const { token } = await createAdmin();
    const student = await registerUser();

    await request(getApp())
      .post(`${API}/admin/users/${student.id}/moderate`)
      .set(auth(token))
      .send({ status: 'SUSPENDED', suspendDays: 3 })
      .expect(200);

    const updated = await User.findById(student.id);
    expect(updated?.suspendedUntil).toBeTruthy();
    const days = (updated!.suspendedUntil!.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(2.9);
    expect(days).toBeLessThan(3.1);
  });

  it('refuses to moderate another administrator', async () => {
    const { token } = await createAdmin();
    const other = await registerUser();
    await makeAdmin(other.email);

    await request(getApp())
      .post(`${API}/admin/users/${other.id}/moderate`)
      .set(auth(token))
      .send({ status: 'BANNED' })
      .expect(403);
  });

  it('writes an audit entry for every moderation action', async () => {
    const { user: admin, token } = await createAdmin();
    const student = await registerUser();

    await request(getApp())
      .post(`${API}/admin/users/${student.id}/moderate`)
      .set(auth(token))
      .send({ status: 'BANNED', reason: 'Fake profile' })
      .expect(200);

    const entries = await AuditLog.find({ action: 'user.banned' });
    expect(entries).toHaveLength(1);
    expect(String(entries[0]?.actor)).toBe(admin.id);

    const log = await request(getApp())
      .get(`${API}/admin/audit-log`)
      .set(auth(token))
      .expect(200);
    expect(log.body.data.items[0].action).toBe('user.banned');
  });

  it('searches users by name or email', async () => {
    const { token } = await createAdmin();
    await registerUser({ name: 'Findable Student', email: 'findme@college.edu' });
    await registerUser({ name: 'Other Person' });

    const byName = await request(getApp())
      .get(`${API}/admin/users?q=Findable`)
      .set(auth(token))
      .expect(200);
    expect(byName.body.data.items).toHaveLength(1);

    const byEmail = await request(getApp())
      .get(`${API}/admin/users?q=findme@college.edu`)
      .set(auth(token))
      .expect(200);
    expect(byEmail.body.data.items).toHaveLength(1);
  });
});

describe('report queue', () => {
  it('claims and resolves a report, applying the chosen action', async () => {
    const { token } = await createAdmin();
    const reporter = await registerUser();
    const offender = await registerUser();

    await request(getApp())
      .post(`${API}/reports`)
      .set(auth(reporter.accessToken))
      .send({ reportedUserId: offender.id, reason: 'HARASSMENT', description: 'Abusive DMs' })
      .expect(201);

    const queue = await request(getApp())
      .get(`${API}/admin/reports?status=OPEN`)
      .set(auth(token))
      .expect(200);
    expect(queue.body.data.items).toHaveLength(1);
    const reportId = queue.body.data.items[0]._id;

    await request(getApp())
      .post(`${API}/admin/reports/${reportId}/claim`)
      .set(auth(token))
      .expect(200);

    // A claimed report cannot be claimed again.
    await request(getApp())
      .post(`${API}/admin/reports/${reportId}/claim`)
      .set(auth(token))
      .expect(409);

    await request(getApp())
      .post(`${API}/admin/reports/${reportId}/resolve`)
      .set(auth(token))
      .send({ action: 'SUSPENDED', suspendDays: 14, resolutionNote: 'Confirmed harassment' })
      .expect(200);

    const suspended = await User.findById(offender.id);
    expect(suspended?.status).toBe('SUSPENDED');

    const closed = await Report.findById(reportId);
    expect(closed?.status).toBe('RESOLVED');
    expect(closed?.actionTaken).toBe('SUSPENDED');
  });

  it('cannot resolve the same report twice', async () => {
    const { token } = await createAdmin();
    const reporter = await registerUser();
    const offender = await registerUser();

    await request(getApp())
      .post(`${API}/reports`)
      .set(auth(reporter.accessToken))
      .send({ reportedUserId: offender.id, reason: 'SPAM' })
      .expect(201);

    const report = await Report.findOne();
    const id = String(report!._id);

    await request(getApp())
      .post(`${API}/admin/reports/${id}/resolve`)
      .set(auth(token))
      .send({ action: 'WARNING', dismiss: false })
      .expect(200);

    await request(getApp())
      .post(`${API}/admin/reports/${id}/resolve`)
      .set(auth(token))
      .send({ action: 'NONE', dismiss: true })
      .expect(409);
  });

  it('lets the reporter file again once the first report is closed', async () => {
    const { token } = await createAdmin();
    const reporter = await registerUser();
    const offender = await registerUser();

    await request(getApp())
      .post(`${API}/reports`)
      .set(auth(reporter.accessToken))
      .send({ reportedUserId: offender.id, reason: 'SPAM' })
      .expect(201);

    const report = await Report.findOne();
    await request(getApp())
      .post(`${API}/admin/reports/${String(report!._id)}/resolve`)
      .set(auth(token))
      .send({ action: 'NONE', dismiss: true })
      .expect(200);

    // The partial unique index only covers OPEN/REVIEWING.
    await request(getApp())
      .post(`${API}/reports`)
      .set(auth(reporter.accessToken))
      .send({ reportedUserId: offender.id, reason: 'HARASSMENT' })
      .expect(201);
  });
});

describe('review moderation', () => {
  it('hiding a review removes it from the average and the public list', async () => {
    const { token } = await createAdmin();
    const figma = await seedSkill('Figma', 'Design');

    const learner = await registerUser();
    await addUserSkill(learner.accessToken, figma, 'LEARN', 'BEGINNER');
    const teacher = await registerUser();
    await addUserSkill(teacher.accessToken, figma, 'TEACH', 'ADVANCED');
    await connectUsers(learner, teacher, figma);

    const created = await request(getApp())
      .post(`${API}/sessions`)
      .set(auth(learner.accessToken))
      .send({
        partnerId: teacher.id,
        role: 'LEARNER',
        skillId: figma,
        scheduledAt: new Date(Date.now() + 3600_000).toISOString(),
        durationMinutes: 60,
        mode: 'ONLINE',
        meetingLink: 'https://meet.example.com/x',
      })
      .expect(201);

    const sessionId = created.body.data._id;
    await Session.updateOne(
      { _id: sessionId },
      { $set: { scheduledAt: new Date(Date.now() - 7200_000) } },
    );
    await request(getApp())
      .post(`${API}/sessions/${sessionId}/complete`)
      .set(auth(learner.accessToken));
    await request(getApp())
      .post(`${API}/sessions/${sessionId}/complete`)
      .set(auth(teacher.accessToken));

    await request(getApp())
      .post(`${API}/reviews`)
      .set(auth(learner.accessToken))
      .send({ sessionId, rating: 1, comment: 'Unfair review' })
      .expect(201);

    expect((await User.findById(teacher.id))?.ratingAvg).toBe(1);

    const review = await Review.findOne();
    await request(getApp())
      .post(`${API}/admin/reviews/${String(review!._id)}/visibility`)
      .set(auth(token))
      .send({ hidden: true })
      .expect(200);

    // Hidden reviews stop counting.
    expect((await User.findById(teacher.id))?.ratingAvg).toBe(0);
    expect((await User.findById(teacher.id))?.ratingCount).toBe(0);

    const publicList = await request(getApp())
      .get(`${API}/reviews/user/${teacher.id}`)
      .expect(200);
    expect(publicList.body.data.items).toHaveLength(0);
  });
});

describe('skill catalogue management', () => {
  it('creates a curated skill and rejects a duplicate', async () => {
    const { token } = await createAdmin();
    await seedSkill('Python');

    const categories = await request(getApp()).get(`${API}/skills/categories`).expect(200);
    const categoryId = categories.body.data[0].id;

    await request(getApp())
      .post(`${API}/admin/skills`)
      .set(auth(token))
      .send({ name: 'Rust', categoryId })
      .expect(201);

    await request(getApp())
      .post(`${API}/admin/skills`)
      .set(auth(token))
      .send({ name: 'rust', categoryId })
      .expect(409);
  });

  it('approves a student-proposed skill', async () => {
    const { token } = await createAdmin();
    await seedSkill('Python');
    const categories = await request(getApp()).get(`${API}/skills/categories`).expect(200);

    const student = await registerUser();
    await request(getApp())
      .post(`${API}/user-skills`)
      .set(auth(student.accessToken))
      .send({
        skillName: 'Obscure Niche Skill',
        categoryId: categories.body.data[0].id,
        type: 'TEACH',
        level: 'ADVANCED',
      })
      .expect(201);

    const proposed = await Skill.findOne({ slug: 'obscure-niche-skill' });
    expect(proposed?.approved).toBe(false);

    await request(getApp())
      .post(`${API}/admin/skills/${String(proposed!._id)}/approve`)
      .set(auth(token))
      .expect(200);

    expect((await Skill.findById(proposed!._id))?.approved).toBe(true);
  });

  it('merges a duplicate skill and recomputes counters without double counting', async () => {
    const { token } = await createAdmin();
    const canonical = await seedSkill('JavaScript');
    const duplicate = await seedSkill('Javascript Language');

    // One student holds only the duplicate — this row moves across.
    const onlyDupe = await registerUser();
    await addUserSkill(onlyDupe.accessToken, duplicate, 'TEACH', 'ADVANCED');

    // Another holds both — the duplicate row must be dropped, not moved, or the
    // unique (user, skill, type) index would be violated.
    const both = await registerUser();
    await addUserSkill(both.accessToken, canonical, 'TEACH', 'INTERMEDIATE');
    await addUserSkill(both.accessToken, duplicate, 'TEACH', 'BEGINNER');

    const res = await request(getApp())
      .post(`${API}/admin/skills/merge`)
      .set(auth(token))
      .send({ sourceId: duplicate, targetId: canonical })
      .expect(200);

    expect(res.body.data.moved).toBe(1);
    expect(res.body.data.dropped).toBe(1);

    expect(await Skill.findById(duplicate)).toBeNull();

    // Two teachers hold the canonical skill, and the counter says exactly that.
    const rows = await UserSkill.countDocuments({ skill: canonical, type: 'TEACH' });
    expect(rows).toBe(2);
    expect((await Skill.findById(canonical))?.teachCount).toBe(2);
  });

  it('refuses to merge a skill into itself', async () => {
    const { token } = await createAdmin();
    const skill = await seedSkill('Python');

    await request(getApp())
      .post(`${API}/admin/skills/merge`)
      .set(auth(token))
      .send({ sourceId: skill, targetId: skill })
      .expect(400);
  });
});
