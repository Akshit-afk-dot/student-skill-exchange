import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  Block,
  Connection,
  Conversation,
  LearningRequest,
  Message,
  Notification,
  Review,
  Session,
  Skill,
  User,
  UserSkill,
} from '../../src/models';
import { generateOneTimeToken } from '../../src/modules/auth/tokens';
import { recalculateRating } from '../../src/modules/users/service';
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

/** Two students whose skills complement each other, so each appears in the other's matches. */
async function setupPair(): Promise<{ aarav: TestUser; priya: TestUser; javascript: string; figma: string }> {
  const javascript = await seedSkill('JavaScript');
  const figma = await seedSkill('Figma', 'Design');

  const aarav = await registerUser({ name: 'Aarav' });
  await addUserSkill(aarav.accessToken, javascript, 'TEACH', 'ADVANCED');
  await addUserSkill(aarav.accessToken, figma, 'LEARN', 'BEGINNER');

  const priya = await registerUser({ name: 'Priya' });
  await addUserSkill(priya.accessToken, figma, 'TEACH', 'ADVANCED');
  await addUserSkill(priya.accessToken, javascript, 'LEARN', 'BEGINNER');

  return { aarav, priya, javascript, figma };
}

async function block(blocker: TestUser, target: TestUser): Promise<void> {
  await request(getApp())
    .post(`${API}/users/${target.id}/block`)
    .set(auth(blocker.accessToken))
    .expect(200);
}

describe('blocking', () => {
  it('removes both students from each other’s matches and search, in both directions', async () => {
    const { aarav, priya } = await setupPair();

    const before = await request(getApp()).get(`${API}/matches`).set(auth(aarav.accessToken)).expect(200);
    expect(before.body.data.items.map((m: { id: string }) => m.id)).toContain(priya.id);

    await block(aarav, priya);

    for (const [viewer, other] of [
      [aarav, priya],
      [priya, aarav],
    ] as const) {
      const matches = await request(getApp()).get(`${API}/matches`).set(auth(viewer.accessToken)).expect(200);
      expect(matches.body.data.items.map((m: { id: string }) => m.id)).not.toContain(other.id);

      const search = await request(getApp()).get(`${API}/users`).set(auth(viewer.accessToken)).expect(200);
      expect(search.body.data.items.map((u: { id: string }) => u.id)).not.toContain(other.id);
    }
  });

  it('hides the blocker’s profile from the blocked student, and marks it for the blocker', async () => {
    const { aarav, priya } = await setupPair();
    await block(aarav, priya);

    const asBlocker = await request(getApp())
      .get(`${API}/users/${priya.id}`)
      .set(auth(aarav.accessToken))
      .expect(200);
    expect(asBlocker.body.data.blockedByMe).toBe(true);

    await request(getApp()).get(`${API}/users/${aarav.id}`).set(auth(priya.accessToken)).expect(404);
  });

  it('refuses new requests either way, without saying who blocked whom', async () => {
    const { aarav, priya, figma, javascript } = await setupPair();
    await block(priya, aarav);

    const fromBlocked = await request(getApp())
      .post(`${API}/requests`)
      .set(auth(aarav.accessToken))
      .send({ receiverId: priya.id, skillId: figma, message: 'Please teach me' })
      .expect(403);
    const fromBlocker = await request(getApp())
      .post(`${API}/requests`)
      .set(auth(priya.accessToken))
      .send({ receiverId: aarav.id, skillId: javascript, message: 'Please teach me' })
      .expect(403);

    expect(fromBlocked.body.error.message).toBe(fromBlocker.body.error.message);
  });

  it('ends an existing connection: no more messages, and pending requests are cancelled', async () => {
    const { aarav, priya, figma, javascript } = await setupPair();
    const { conversationId } = await connectUsers(aarav, priya, figma);

    // A second request still waiting when the block lands.
    await request(getApp())
      .post(`${API}/requests`)
      .set(auth(priya.accessToken))
      .send({ receiverId: aarav.id, skillId: javascript, message: 'And JS too?' })
      .expect(201);

    await block(aarav, priya);

    expect((await Connection.findOne({ participants: aarav.id }))?.active).toBe(false);
    expect(await LearningRequest.countDocuments({ status: 'PENDING' })).toBe(0);

    await request(getApp())
      .post(`${API}/conversations/${conversationId}/messages`)
      .set(auth(priya.accessToken))
      .send({ body: 'Are you there?' })
      .expect(403);

    // The blocker no longer sees the conversation; the blocked student still does.
    const blockerList = await request(getApp()).get(`${API}/conversations`).set(auth(aarav.accessToken)).expect(200);
    expect(blockerList.body.data.items).toHaveLength(0);
    const blockedList = await request(getApp()).get(`${API}/conversations`).set(auth(priya.accessToken)).expect(200);
    expect(blockedList.body.data.items).toHaveLength(1);
  });

  it('lists blocked students and unblocks them', async () => {
    const { aarav, priya } = await setupPair();
    await block(aarav, priya);
    await block(aarav, priya); // idempotent

    const listed = await request(getApp()).get(`${API}/users/me/blocked`).set(auth(aarav.accessToken)).expect(200);
    expect(listed.body.data).toHaveLength(1);
    expect(listed.body.data[0]).toMatchObject({ id: priya.id, name: 'Priya' });

    await request(getApp())
      .delete(`${API}/users/${priya.id}/block`)
      .set(auth(aarav.accessToken))
      .expect(200);
    expect(await Block.countDocuments()).toBe(0);
  });

  it('will not let a student block themselves', async () => {
    const { aarav } = await setupPair();
    await request(getApp())
      .post(`${API}/users/${aarav.id}/block`)
      .set(auth(aarav.accessToken))
      .expect(400);
  });
});

describe('deleting an account in the app', () => {
  it('asks for the password, and a wrong one is a 400 rather than a sign-out 401', async () => {
    const { aarav } = await setupPair();

    const missing = await request(getApp()).delete(`${API}/users/me`).set(auth(aarav.accessToken)).send({}).expect(400);
    expect(missing.body.error.code).toBe('PASSWORD_REQUIRED');

    const wrong = await request(getApp())
      .delete(`${API}/users/me`)
      .set(auth(aarav.accessToken))
      .send({ password: 'not-my-password' })
      .expect(400);
    expect(wrong.body.error.code).toBe('INVALID_PASSWORD');
    expect(await User.exists({ _id: aarav.id })).toBeTruthy();
  });

  it('removes the student and everything tied to them, and repairs what others keep', async () => {
    const { aarav, priya, figma, javascript } = await setupPair();
    await connectUsers(aarav, priya, figma);
    await block(priya, aarav);

    // A finished session Aarav reviewed, and an upcoming one, both with Priya.
    const finished = await Session.create({
      teacher: priya.id,
      learner: aarav.id,
      skill: figma,
      scheduledAt: new Date(Date.now() - 86_400_000),
      durationMinutes: 60,
      mode: 'ONLINE',
      meetingLink: 'https://meet.example.com/x',
      status: 'COMPLETED',
      createdBy: aarav.id,
    });
    await Review.create({ session: finished._id, reviewer: aarav.id, reviewee: priya.id, skill: figma, rating: 5 });
    await recalculateRating(priya.id);
    expect((await User.findById(priya.id))?.ratingCount).toBe(1);

    await Session.create({
      teacher: priya.id,
      learner: aarav.id,
      skill: figma,
      scheduledAt: new Date(Date.now() + 86_400_000),
      durationMinutes: 60,
      mode: 'ONLINE',
      meetingLink: 'https://meet.example.com/y',
      createdBy: aarav.id,
    });
    expect((await Skill.findById(javascript))?.teachCount).toBe(1);

    await request(getApp())
      .delete(`${API}/users/me`)
      .set(auth(aarav.accessToken))
      .send({ password: aarav.password })
      .expect(200);

    expect(await User.exists({ _id: aarav.id })).toBeNull();
    for (const [name, count] of Object.entries({
      userSkills: await UserSkill.countDocuments({ user: aarav.id }),
      connections: await Connection.countDocuments({ participants: aarav.id }),
      conversations: await Conversation.countDocuments({ participants: aarav.id }),
      messages: await Message.countDocuments({}),
      requests: await LearningRequest.countDocuments({ $or: [{ sender: aarav.id }, { receiver: aarav.id }] }),
      sessions: await Session.countDocuments({}),
      reviews: await Review.countDocuments({}),
      blocks: await Block.countDocuments({}),
    })) {
      expect({ [name]: count }).toEqual({ [name]: 0 });
    }

    // What Priya keeps is repaired rather than left pointing at a ghost.
    expect((await User.findById(priya.id))?.ratingCount).toBe(0);
    expect((await Skill.findById(javascript))?.teachCount).toBe(0);
    expect(await Notification.exists({ user: priya.id, type: 'SESSION_CANCELLED' })).toBeTruthy();

    // The old access token is now worthless.
    await request(getApp()).get(`${API}/auth/me`).set(auth(aarav.accessToken)).expect(401);
  });

  it('does not let an administrator delete themselves from the app', async () => {
    const admin = await registerUser({ name: 'Admin' });
    await makeAdmin(admin.email);
    const token = await login(admin.email, admin.password);

    await request(getApp()).delete(`${API}/users/me`).set(auth(token)).send({ password: admin.password }).expect(403);
  });
});

describe('deleting an account on the web', () => {
  it('serves the form, refuses bad credentials generically, then deletes', async () => {
    const { aarav } = await setupPair();

    const form = await request(getApp()).get('/account/delete').expect(200);
    expect(form.headers['content-type']).toContain('text/html');

    const wrong = await request(getApp())
      .post('/account/delete')
      .type('form')
      .send({ email: aarav.email, password: 'wrong-password', confirm: 'yes' })
      .expect(400);
    const unknown = await request(getApp())
      .post('/account/delete')
      .type('form')
      .send({ email: 'nobody@college.edu', password: 'whatever123', confirm: 'yes' })
      .expect(400);
    // Same answer for a wrong password and a non-existent address.
    expect(wrong.text).toContain('We could not verify that email and password');
    expect(unknown.text).toContain('We could not verify that email and password');

    await request(getApp())
      .post('/account/delete')
      .type('form')
      .send({ email: aarav.email, password: aarav.password })
      .expect(400); // the confirmation box was not ticked
    expect(await User.exists({ _id: aarav.id })).toBeTruthy();

    const done = await request(getApp())
      .post('/account/delete')
      .type('form')
      .send({ email: aarav.email, password: aarav.password, confirm: 'yes' })
      .expect(200);
    expect(done.text).toContain('Your account has been deleted');
    expect(await User.exists({ _id: aarav.id })).toBeNull();
  });
});

describe('legal pages', () => {
  it('serves the privacy policy and terms as HTML with the contact address', async () => {
    for (const path of ['/legal/privacy', '/legal/terms']) {
      const res = await request(getApp()).get(path).expect(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.text).toContain('akshituzumaki@gmail.com');
    }
  });
});

describe('email verification', () => {
  it('answers a bad link with an HTML page, and a good one verifies the account', async () => {
    const { aarav } = await setupPair();

    const bad = await request(getApp()).get(`${API}/auth/verify-email?token=${'a'.repeat(64)}`).expect(400);
    expect(bad.headers['content-type']).toContain('text/html');
    expect(bad.text).toContain('This link didn');

    const { token, hash } = generateOneTimeToken();
    await User.updateOne(
      { _id: aarav.id },
      { emailVerificationTokenHash: hash, emailVerificationExpires: new Date(Date.now() + 60_000) },
    );
    const good = await request(getApp()).get(`${API}/auth/verify-email?token=${token}`).expect(200);
    expect(good.text).toContain('Your email is verified');
    expect((await User.findById(aarav.id))?.emailVerified).toBe(true);
  });

  it('exposes whether a student is verified on their public profile', async () => {
    const { aarav, priya } = await setupPair();
    await User.updateOne({ _id: priya.id }, { emailVerified: true });

    const verified = await request(getApp()).get(`${API}/users/${priya.id}`).set(auth(aarav.accessToken)).expect(200);
    expect(verified.body.data.verified).toBe(true);
    const unverified = await request(getApp()).get(`${API}/users/${aarav.id}`).set(auth(priya.accessToken)).expect(200);
    expect(unverified.body.data.verified).toBe(false);
  });
});
