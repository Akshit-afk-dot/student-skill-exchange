import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Connection, Conversation, Session, User } from '../../src/models';
import {
  API,
  addUserSkill,
  auth,
  connectUsers,
  getApp,
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

/** Sets up the two-way pair used across most of these tests. */
async function setupPair(): Promise<{
  aarav: TestUser;
  priya: TestUser;
  javascript: string;
  figma: string;
}> {
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

describe('learning requests', () => {
  it('rejects a request for a skill the recipient does not teach', async () => {
    const { aarav, priya, javascript } = await setupPair();

    // Priya teaches Figma, not JavaScript.
    const res = await request(getApp())
      .post(`${API}/requests`)
      .set(auth(aarav.accessToken))
      .send({ receiverId: priya.id, skillId: javascript, message: 'Teach me JS' })
      .expect(400);

    expect(res.body.error.message).toContain('does not teach');
  });

  it('rejects a request to yourself', async () => {
    const { aarav, figma } = await setupPair();

    await request(getApp())
      .post(`${API}/requests`)
      .set(auth(aarav.accessToken))
      .send({ receiverId: aarav.id, skillId: figma, message: 'Hello me' })
      .expect(400);
  });

  it('blocks a duplicate pending request for the same skill', async () => {
    const { aarav, priya, figma } = await setupPair();

    await request(getApp())
      .post(`${API}/requests`)
      .set(auth(aarav.accessToken))
      .send({ receiverId: priya.id, skillId: figma, message: 'Teach me Figma' })
      .expect(201);

    const dupe = await request(getApp())
      .post(`${API}/requests`)
      .set(auth(aarav.accessToken))
      .send({ receiverId: priya.id, skillId: figma, message: 'Teach me Figma again' })
      .expect(409);

    expect(dupe.body.error.code).toBe('CONFLICT');
  });

  it('allows a fresh request after the first was rejected', async () => {
    const { aarav, priya, figma } = await setupPair();

    const first = await request(getApp())
      .post(`${API}/requests`)
      .set(auth(aarav.accessToken))
      .send({ receiverId: priya.id, skillId: figma, message: 'Teach me Figma' })
      .expect(201);

    await request(getApp())
      .post(`${API}/requests/${first.body.data._id}/reject`)
      .set(auth(priya.accessToken))
      .expect(200);

    // The partial unique index only covers PENDING, so this is allowed.
    await request(getApp())
      .post(`${API}/requests`)
      .set(auth(aarav.accessToken))
      .send({ receiverId: priya.id, skillId: figma, message: 'Asking once more' })
      .expect(201);
  });

  it('only lets the recipient accept', async () => {
    const { aarav, priya, figma } = await setupPair();

    const created = await request(getApp())
      .post(`${API}/requests`)
      .set(auth(aarav.accessToken))
      .send({ receiverId: priya.id, skillId: figma, message: 'Teach me Figma' })
      .expect(201);

    // The sender cannot accept their own request.
    await request(getApp())
      .post(`${API}/requests/${created.body.data._id}/accept`)
      .set(auth(aarav.accessToken))
      .expect(403);

    await request(getApp())
      .post(`${API}/requests/${created.body.data._id}/accept`)
      .set(auth(priya.accessToken))
      .expect(200);
  });

  it('cannot accept the same request twice', async () => {
    const { aarav, priya, figma } = await setupPair();
    const { requestId } = await connectUsers(aarav, priya, figma);

    await request(getApp())
      .post(`${API}/requests/${requestId}/accept`)
      .set(auth(priya.accessToken))
      .expect(409);
  });

  it('creates exactly one connection and conversation on accept', async () => {
    const { aarav, priya, figma } = await setupPair();
    await connectUsers(aarav, priya, figma);

    expect(await Connection.countDocuments()).toBe(1);
    expect(await Conversation.countDocuments()).toBe(1);

    const connection = await Connection.findOne();
    expect(connection?.participants).toHaveLength(2);
    expect(connection?.active).toBe(true);
  });

  it('lists incoming and outgoing requests separately', async () => {
    const { aarav, priya, figma } = await setupPair();

    await request(getApp())
      .post(`${API}/requests`)
      .set(auth(aarav.accessToken))
      .send({ receiverId: priya.id, skillId: figma, message: 'Teach me Figma' })
      .expect(201);

    const outgoing = await request(getApp())
      .get(`${API}/requests?direction=outgoing`)
      .set(auth(aarav.accessToken))
      .expect(200);
    expect(outgoing.body.data.items).toHaveLength(1);

    const incoming = await request(getApp())
      .get(`${API}/requests?direction=incoming`)
      .set(auth(priya.accessToken))
      .expect(200);
    expect(incoming.body.data.items).toHaveLength(1);

    // And nothing on the mirrored views.
    const noneIncoming = await request(getApp())
      .get(`${API}/requests?direction=incoming`)
      .set(auth(aarav.accessToken))
      .expect(200);
    expect(noneIncoming.body.data.items).toHaveLength(0);
  });
});

describe('chat', () => {
  it('refuses messages between students who are not connected', async () => {
    const { aarav, priya, figma } = await setupPair();

    // Create the conversation via a connection, then break it.
    const { conversationId } = await connectUsers(aarav, priya, figma);
    await Connection.updateOne({}, { $set: { active: false } });

    await request(getApp())
      .post(`${API}/conversations/${conversationId}/messages`)
      .set(auth(aarav.accessToken))
      .send({ body: 'Still there?' })
      .expect(403);
  });

  it('hides a conversation from non-participants behind a 404', async () => {
    const { aarav, priya, figma } = await setupPair();
    const { conversationId } = await connectUsers(aarav, priya, figma);

    const stranger = await registerUser({ name: 'Stranger' });

    // 404, not 403: a stranger should not learn the conversation exists.
    await request(getApp())
      .get(`${API}/conversations/${conversationId}/messages`)
      .set(auth(stranger.accessToken))
      .expect(404);

    await request(getApp())
      .post(`${API}/conversations/${conversationId}/messages`)
      .set(auth(stranger.accessToken))
      .send({ body: 'Let me in' })
      .expect(404);
  });

  it('sends, lists and counts unread messages', async () => {
    const { aarav, priya, figma } = await setupPair();
    const { conversationId } = await connectUsers(aarav, priya, figma);

    await request(getApp())
      .post(`${API}/conversations/${conversationId}/messages`)
      .set(auth(aarav.accessToken))
      .send({ body: 'Hi Priya, when are you free?' })
      .expect(201);

    const messages = await request(getApp())
      .get(`${API}/conversations/${conversationId}/messages`)
      .set(auth(priya.accessToken))
      .expect(200);

    expect(messages.body.data.items).toHaveLength(1);
    expect(messages.body.data.items[0].body).toBe('Hi Priya, when are you free?');

    const unread = await request(getApp())
      .get(`${API}/conversations/unread-count`)
      .set(auth(priya.accessToken))
      .expect(200);
    expect(unread.body.data.count).toBe(1);

    // The sender has nothing unread.
    const senderUnread = await request(getApp())
      .get(`${API}/conversations/unread-count`)
      .set(auth(aarav.accessToken))
      .expect(200);
    expect(senderUnread.body.data.count).toBe(0);
  });

  it('clears the unread count when the conversation is opened', async () => {
    const { aarav, priya, figma } = await setupPair();
    const { conversationId } = await connectUsers(aarav, priya, figma);

    await request(getApp())
      .post(`${API}/conversations/${conversationId}/messages`)
      .set(auth(aarav.accessToken))
      .send({ body: 'First' })
      .expect(201);

    await request(getApp())
      .post(`${API}/conversations/${conversationId}/read`)
      .set(auth(priya.accessToken))
      .expect(200);

    const unread = await request(getApp())
      .get(`${API}/conversations/unread-count`)
      .set(auth(priya.accessToken))
      .expect(200);
    expect(unread.body.data.count).toBe(0);
  });

  it('rejects an empty text message', async () => {
    const { aarav, priya, figma } = await setupPair();
    const { conversationId } = await connectUsers(aarav, priya, figma);

    await request(getApp())
      .post(`${API}/conversations/${conversationId}/messages`)
      .set(auth(aarav.accessToken))
      .send({ body: '   ' })
      .expect(422);
  });

  it('pages backwards through history with a cursor', async () => {
    const { aarav, priya, figma } = await setupPair();
    const { conversationId } = await connectUsers(aarav, priya, figma);

    for (let i = 1; i <= 5; i += 1) {
      await request(getApp())
        .post(`${API}/conversations/${conversationId}/messages`)
        .set(auth(aarav.accessToken))
        .send({ body: `Message ${i}` })
        .expect(201);
    }

    const first = await request(getApp())
      .get(`${API}/conversations/${conversationId}/messages?limit=2`)
      .set(auth(priya.accessToken))
      .expect(200);

    expect(first.body.data.items).toHaveLength(2);
    expect(first.body.data.hasMore).toBe(true);
    // Newest first.
    expect(first.body.data.items[0].body).toBe('Message 5');

    const second = await request(getApp())
      .get(`${API}/conversations/${conversationId}/messages?limit=2&before=${first.body.data.nextCursor}`)
      .set(auth(priya.accessToken))
      .expect(200);

    expect(second.body.data.items[0].body).toBe('Message 3');
  });

  it('lets an author soft-delete their own message but not someone else\'s', async () => {
    const { aarav, priya, figma } = await setupPair();
    const { conversationId } = await connectUsers(aarav, priya, figma);

    const sent = await request(getApp())
      .post(`${API}/conversations/${conversationId}/messages`)
      .set(auth(aarav.accessToken))
      .send({ body: 'Oops, wrong chat' })
      .expect(201);

    await request(getApp())
      .delete(`${API}/conversations/messages/${sent.body.data._id}`)
      .set(auth(priya.accessToken))
      .expect(403);

    await request(getApp())
      .delete(`${API}/conversations/messages/${sent.body.data._id}`)
      .set(auth(aarav.accessToken))
      .expect(204);

    const after = await request(getApp())
      .get(`${API}/conversations/${conversationId}/messages`)
      .set(auth(priya.accessToken))
      .expect(200);
    expect(after.body.data.items).toHaveLength(0);
  });
});

describe('sessions', () => {
  const futureDate = (hoursFromNow: number) =>
    new Date(Date.now() + hoursFromNow * 60 * 60_000).toISOString();

  it('refuses to schedule with an unconnected student', async () => {
    const { aarav, priya, figma } = await setupPair();

    await request(getApp())
      .post(`${API}/sessions`)
      .set(auth(aarav.accessToken))
      .send({
        partnerId: priya.id,
        role: 'LEARNER',
        skillId: figma,
        scheduledAt: futureDate(24),
        durationMinutes: 60,
        mode: 'ONLINE',
        meetingLink: 'https://meet.example.com/abc',
      })
      .expect(403);
  });

  it('schedules a session between connected students', async () => {
    const { aarav, priya, figma } = await setupPair();
    await connectUsers(aarav, priya, figma);

    const res = await request(getApp())
      .post(`${API}/sessions`)
      .set(auth(aarav.accessToken))
      .send({
        partnerId: priya.id,
        role: 'LEARNER',
        skillId: figma,
        scheduledAt: futureDate(24),
        durationMinutes: 60,
        mode: 'ONLINE',
        meetingLink: 'https://meet.example.com/abc',
      })
      .expect(201);

    expect(res.body.data.teacher._id).toBe(priya.id);
    expect(res.body.data.learner._id).toBe(aarav.id);
    expect(res.body.data.status).toBe('SCHEDULED');
  });

  it('rejects a session scheduled in the past', async () => {
    const { aarav, priya, figma } = await setupPair();
    await connectUsers(aarav, priya, figma);

    await request(getApp())
      .post(`${API}/sessions`)
      .set(auth(aarav.accessToken))
      .send({
        partnerId: priya.id,
        role: 'LEARNER',
        skillId: figma,
        scheduledAt: new Date(Date.now() - 3600_000).toISOString(),
        durationMinutes: 60,
        mode: 'ONLINE',
        meetingLink: 'https://meet.example.com/abc',
      })
      .expect(400);
  });

  it('requires a meeting link for online and a location for in-person', async () => {
    const { aarav, priya, figma } = await setupPair();
    await connectUsers(aarav, priya, figma);

    const base = {
      partnerId: priya.id,
      role: 'LEARNER' as const,
      skillId: figma,
      scheduledAt: futureDate(24),
      durationMinutes: 60,
    };

    await request(getApp())
      .post(`${API}/sessions`)
      .set(auth(aarav.accessToken))
      .send({ ...base, mode: 'ONLINE' })
      .expect(400);

    await request(getApp())
      .post(`${API}/sessions`)
      .set(auth(aarav.accessToken))
      .send({ ...base, mode: 'OFFLINE' })
      .expect(400);
  });

  it('detects a clash with an overlapping session', async () => {
    const { aarav, priya, figma } = await setupPair();
    await connectUsers(aarav, priya, figma);

    const start = futureDate(24);
    const payload = {
      partnerId: priya.id,
      role: 'LEARNER' as const,
      skillId: figma,
      durationMinutes: 60,
      mode: 'ONLINE' as const,
      meetingLink: 'https://meet.example.com/abc',
    };

    await request(getApp())
      .post(`${API}/sessions`)
      .set(auth(aarav.accessToken))
      .send({ ...payload, scheduledAt: start })
      .expect(201);

    // Starts 30 minutes into the existing 60-minute session.
    const clash = await request(getApp())
      .post(`${API}/sessions`)
      .set(auth(aarav.accessToken))
      .send({ ...payload, scheduledAt: futureDate(24.5) })
      .expect(409);

    expect(clash.body.error.message).toContain('clashes');
  });

  it('allows a back-to-back session that only touches the previous end time', async () => {
    const { aarav, priya, figma } = await setupPair();
    await connectUsers(aarav, priya, figma);

    const payload = {
      partnerId: priya.id,
      role: 'LEARNER' as const,
      skillId: figma,
      durationMinutes: 60,
      mode: 'ONLINE' as const,
      meetingLink: 'https://meet.example.com/abc',
    };

    await request(getApp())
      .post(`${API}/sessions`)
      .set(auth(aarav.accessToken))
      .send({ ...payload, scheduledAt: futureDate(24) })
      .expect(201);

    await request(getApp())
      .post(`${API}/sessions`)
      .set(auth(aarav.accessToken))
      .send({ ...payload, scheduledAt: futureDate(25) })
      .expect(201);
  });

  it('requires both students to confirm before a session counts', async () => {
    const { aarav, priya, figma } = await setupPair();
    await connectUsers(aarav, priya, figma);

    const created = await request(getApp())
      .post(`${API}/sessions`)
      .set(auth(aarav.accessToken))
      .send({
        partnerId: priya.id,
        role: 'LEARNER',
        skillId: figma,
        scheduledAt: futureDate(24),
        durationMinutes: 60,
        mode: 'ONLINE',
        meetingLink: 'https://meet.example.com/abc',
      })
      .expect(201);

    const sessionId = created.body.data._id;
    // Move it into the past so completion is allowed.
    await Session.updateOne(
      { _id: sessionId },
      { $set: { scheduledAt: new Date(Date.now() - 2 * 3600_000) } },
    );

    const firstConfirm = await request(getApp())
      .post(`${API}/sessions/${sessionId}/complete`)
      .set(auth(aarav.accessToken))
      .expect(200);
    expect(firstConfirm.body.data.fullyCompleted).toBe(false);

    // Confirming twice from the same side does not complete it.
    const repeat = await request(getApp())
      .post(`${API}/sessions/${sessionId}/complete`)
      .set(auth(aarav.accessToken))
      .expect(200);
    expect(repeat.body.data.fullyCompleted).toBe(false);

    const secondConfirm = await request(getApp())
      .post(`${API}/sessions/${sessionId}/complete`)
      .set(auth(priya.accessToken))
      .expect(200);
    expect(secondConfirm.body.data.fullyCompleted).toBe(true);

    // Stats moved on both sides.
    const teacher = await User.findById(priya.id);
    const learner = await User.findById(aarav.id);
    expect(teacher?.stats.sessionsTaught).toBe(1);
    expect(teacher?.stats.minutesTaught).toBe(60);
    expect(learner?.stats.sessionsLearned).toBe(1);
    expect(learner?.stats.points).toBeGreaterThan(0);
  });

  it('cannot complete a session that has not started', async () => {
    const { aarav, priya, figma } = await setupPair();
    await connectUsers(aarav, priya, figma);

    const created = await request(getApp())
      .post(`${API}/sessions`)
      .set(auth(aarav.accessToken))
      .send({
        partnerId: priya.id,
        role: 'LEARNER',
        skillId: figma,
        scheduledAt: futureDate(24),
        durationMinutes: 60,
        mode: 'ONLINE',
        meetingLink: 'https://meet.example.com/abc',
      })
      .expect(201);

    await request(getApp())
      .post(`${API}/sessions/${created.body.data._id}/complete`)
      .set(auth(aarav.accessToken))
      .expect(400);
  });

  it('keeps sessions private to their participants', async () => {
    const { aarav, priya, figma } = await setupPair();
    await connectUsers(aarav, priya, figma);
    const stranger = await registerUser();

    const created = await request(getApp())
      .post(`${API}/sessions`)
      .set(auth(aarav.accessToken))
      .send({
        partnerId: priya.id,
        role: 'LEARNER',
        skillId: figma,
        scheduledAt: futureDate(24),
        durationMinutes: 60,
        mode: 'ONLINE',
        meetingLink: 'https://meet.example.com/abc',
      })
      .expect(201);

    await request(getApp())
      .get(`${API}/sessions/${created.body.data._id}`)
      .set(auth(stranger.accessToken))
      .expect(403);
  });

  it('returns calendar entries inside a window', async () => {
    const { aarav, priya, figma } = await setupPair();
    await connectUsers(aarav, priya, figma);

    await request(getApp())
      .post(`${API}/sessions`)
      .set(auth(aarav.accessToken))
      .send({
        partnerId: priya.id,
        role: 'LEARNER',
        skillId: figma,
        scheduledAt: futureDate(24),
        durationMinutes: 90,
        mode: 'ONLINE',
        meetingLink: 'https://meet.example.com/abc',
      })
      .expect(201);

    const from = new Date().toISOString();
    const to = new Date(Date.now() + 7 * 86_400_000).toISOString();

    const res = await request(getApp())
      .get(`${API}/sessions/calendar?from=${from}&to=${to}`)
      .set(auth(aarav.accessToken))
      .expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].role).toBe('learner');
    expect(res.body.data[0].title).toContain('Figma');
    // endsAt is derived from duration.
    const entry = res.body.data[0];
    const span = Date.parse(entry.endsAt) - Date.parse(entry.scheduledAt);
    expect(span).toBe(90 * 60_000);
  });
});

describe('reviews', () => {
  /** Runs a pair all the way to a completed session. */
  async function completedSession(): Promise<{
    aarav: TestUser;
    priya: TestUser;
    sessionId: string;
  }> {
    const { aarav, priya, figma } = await setupPair();
    await connectUsers(aarav, priya, figma);

    const created = await request(getApp())
      .post(`${API}/sessions`)
      .set(auth(aarav.accessToken))
      .send({
        partnerId: priya.id,
        role: 'LEARNER',
        skillId: figma,
        scheduledAt: new Date(Date.now() + 3600_000).toISOString(),
        durationMinutes: 60,
        mode: 'ONLINE',
        meetingLink: 'https://meet.example.com/abc',
      })
      .expect(201);

    const sessionId = created.body.data._id;
    await Session.updateOne(
      { _id: sessionId },
      { $set: { scheduledAt: new Date(Date.now() - 2 * 3600_000) } },
    );

    await request(getApp())
      .post(`${API}/sessions/${sessionId}/complete`)
      .set(auth(aarav.accessToken))
      .expect(200);
    await request(getApp())
      .post(`${API}/sessions/${sessionId}/complete`)
      .set(auth(priya.accessToken))
      .expect(200);

    return { aarav, priya, sessionId };
  }

  it('records a review and updates the reviewee average', async () => {
    const { aarav, priya, sessionId } = await completedSession();

    await request(getApp())
      .post(`${API}/reviews`)
      .set(auth(aarav.accessToken))
      .send({ sessionId, rating: 5, comment: 'Very clear explanation of Figma basics.' })
      .expect(201);

    const teacher = await User.findById(priya.id);
    expect(teacher?.ratingAvg).toBe(5);
    expect(teacher?.ratingCount).toBe(1);

    const profile = await request(getApp()).get(`${API}/users/${priya.id}`).expect(200);
    expect(profile.body.data.rating.average).toBe(5);
    expect(profile.body.data.reviewSummary.distribution['5']).toBe(1);
  });

  it('blocks a second review of the same session by the same student', async () => {
    const { aarav, sessionId } = await completedSession();

    await request(getApp())
      .post(`${API}/reviews`)
      .set(auth(aarav.accessToken))
      .send({ sessionId, rating: 5 })
      .expect(201);

    await request(getApp())
      .post(`${API}/reviews`)
      .set(auth(aarav.accessToken))
      .send({ sessionId, rating: 1 })
      .expect(409);
  });

  it('lets both participants review the same session once each', async () => {
    const { aarav, priya, sessionId } = await completedSession();

    await request(getApp())
      .post(`${API}/reviews`)
      .set(auth(aarav.accessToken))
      .send({ sessionId, rating: 5 })
      .expect(201);

    await request(getApp())
      .post(`${API}/reviews`)
      .set(auth(priya.accessToken))
      .send({ sessionId, rating: 4 })
      .expect(201);

    const learner = await User.findById(aarav.id);
    expect(learner?.ratingAvg).toBe(4);
  });

  it('refuses a review from someone who was not in the session', async () => {
    const { sessionId } = await completedSession();
    const stranger = await registerUser();

    await request(getApp())
      .post(`${API}/reviews`)
      .set(auth(stranger.accessToken))
      .send({ sessionId, rating: 5 })
      .expect(403);
  });

  it('refuses a review before the session is complete', async () => {
    const { aarav, priya, figma } = await setupPair();
    await connectUsers(aarav, priya, figma);

    const created = await request(getApp())
      .post(`${API}/sessions`)
      .set(auth(aarav.accessToken))
      .send({
        partnerId: priya.id,
        role: 'LEARNER',
        skillId: figma,
        scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
        durationMinutes: 60,
        mode: 'ONLINE',
        meetingLink: 'https://meet.example.com/abc',
      })
      .expect(201);

    await request(getApp())
      .post(`${API}/reviews`)
      .set(auth(aarav.accessToken))
      .send({ sessionId: created.body.data._id, rating: 5 })
      .expect(400);
  });

  it('rejects an out-of-range rating', async () => {
    const { aarav, sessionId } = await completedSession();

    await request(getApp())
      .post(`${API}/reviews`)
      .set(auth(aarav.accessToken))
      .send({ sessionId, rating: 6 })
      .expect(422);

    await request(getApp())
      .post(`${API}/reviews`)
      .set(auth(aarav.accessToken))
      .send({ sessionId, rating: 0 })
      .expect(422);
  });

  it('lists sessions still awaiting a rating', async () => {
    const { aarav, sessionId } = await completedSession();

    const before = await request(getApp())
      .get(`${API}/reviews/pending`)
      .set(auth(aarav.accessToken))
      .expect(200);
    expect(before.body.data).toHaveLength(1);

    await request(getApp())
      .post(`${API}/reviews`)
      .set(auth(aarav.accessToken))
      .send({ sessionId, rating: 5 })
      .expect(201);

    const after = await request(getApp())
      .get(`${API}/reviews/pending`)
      .set(auth(aarav.accessToken))
      .expect(200);
    expect(after.body.data).toHaveLength(0);
  });
});

describe('gamification', () => {
  it('awards the first-session badge once a session completes', async () => {
    const { aarav, priya, figma } = await setupPair();
    await connectUsers(aarav, priya, figma);

    const created = await request(getApp())
      .post(`${API}/sessions`)
      .set(auth(aarav.accessToken))
      .send({
        partnerId: priya.id,
        role: 'LEARNER',
        skillId: figma,
        scheduledAt: new Date(Date.now() + 3600_000).toISOString(),
        durationMinutes: 60,
        mode: 'ONLINE',
        meetingLink: 'https://meet.example.com/abc',
      })
      .expect(201);

    await Session.updateOne(
      { _id: created.body.data._id },
      { $set: { scheduledAt: new Date(Date.now() - 2 * 3600_000) } },
    );

    await request(getApp())
      .post(`${API}/sessions/${created.body.data._id}/complete`)
      .set(auth(aarav.accessToken));
    await request(getApp())
      .post(`${API}/sessions/${created.body.data._id}/complete`)
      .set(auth(priya.accessToken));

    const analytics = await request(getApp())
      .get(`${API}/gamification/analytics`)
      .set(auth(priya.accessToken))
      .expect(200);

    expect(analytics.body.data.sessionsTaught).toBe(1);
    expect(analytics.body.data.hoursTaught).toBe(1);
    const firstSession = analytics.body.data.badges.find(
      (b: { badge: string }) => b.badge === 'FIRST_SESSION',
    );
    expect(firstSession.earned).toBe(true);
  });

  it('ranks the leaderboard by points', async () => {
    const high = await registerUser({ name: 'High Scorer' });
    const low = await registerUser({ name: 'Low Scorer' });

    await User.updateOne({ _id: high.id }, { $set: { 'stats.points': 500 } });
    await User.updateOne({ _id: low.id }, { $set: { 'stats.points': 10 } });

    const res = await request(getApp())
      .get(`${API}/gamification/leaderboard`)
      .set(auth(low.accessToken))
      .expect(200);

    expect(res.body.data.items[0].name).toBe('High Scorer');
    expect(res.body.data.items[0].rank).toBe(1);
    expect(res.body.data.items[1].rank).toBe(2);
  });
});

describe('reports', () => {
  it('files a report and blocks a duplicate while it is open', async () => {
    const reporter = await registerUser();
    const target = await registerUser();

    await request(getApp())
      .post(`${API}/reports`)
      .set(auth(reporter.accessToken))
      .send({ reportedUserId: target.id, reason: 'HARASSMENT', description: 'Abusive messages' })
      .expect(201);

    await request(getApp())
      .post(`${API}/reports`)
      .set(auth(reporter.accessToken))
      .send({ reportedUserId: target.id, reason: 'SPAM' })
      .expect(409);
  });

  it('refuses a self-report', async () => {
    const user = await registerUser();

    await request(getApp())
      .post(`${API}/reports`)
      .set(auth(user.accessToken))
      .send({ reportedUserId: user.id, reason: 'SPAM' })
      .expect(400);
  });
});
