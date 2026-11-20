import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { User } from '../../src/models';
import {
  setPushTransport,
  type ExpoMessage,
  type ExpoTicket,
} from '../../src/modules/notifications/push';
import { pushesSettled } from '../../src/modules/notifications/service';
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

const PHONE_A = 'ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]';
const PHONE_B = 'ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]';

/** Every message the server would have sent to Expo, and what Expo answers. */
let sent: ExpoMessage[] = [];
let answer: (message: ExpoMessage) => ExpoTicket = () => ({ status: 'ok', id: 'ticket' });

beforeAll(async () => {
  await startTestDb();
});
afterAll(async () => {
  setPushTransport(null);
  await stopTestDb();
});
beforeEach(() => {
  sent = [];
  answer = () => ({ status: 'ok', id: 'ticket' });
  setPushTransport(async (messages) => {
    sent.push(...messages);
    return messages.map((m) => answer(m));
  });
});
afterEach(async () => {
  await pushesSettled();
  await clearDb();
});

function registerPhone(user: TestUser, token: string, timezone?: string) {
  return request(getApp())
    .post(`${API}/auth/push-token`)
    .set(auth(user.accessToken))
    .send({ token, ...(timezone ? { timezone } : {}) });
}

async function tokensOf(user: TestUser): Promise<string[]> {
  const doc = await User.findById(user.id).select('+pushTokens').lean();
  return doc?.pushTokens ?? [];
}

/** Two connected students, Aarav learning Figma from Priya. */
async function connectedPair() {
  const figma = await seedSkill('Figma', 'Design');
  const aarav = await registerUser({ name: 'Aarav Mehta' });
  const priya = await registerUser({ name: 'Priya Sharma' });
  await addUserSkill(priya.accessToken, figma, 'TEACH', 'ADVANCED');
  await addUserSkill(aarav.accessToken, figma, 'LEARN', 'BEGINNER');
  const { conversationId } = await connectUsers(aarav, priya, figma);
  await pushesSettled();
  sent = [];
  return { aarav, priya, figma, conversationId };
}

describe('registering a phone', () => {
  it('accepts an Expo token and saves the phone’s time zone', async () => {
    const student = await registerUser();
    await registerPhone(student, PHONE_A, 'Europe/London').expect(200);

    expect(await tokensOf(student)).toEqual([PHONE_A]);
    expect((await User.findById(student.id).lean())?.timezone).toBe('Europe/London');
  });

  it('refuses tokens that are not Expo tokens, and unknown time zones', async () => {
    const student = await registerUser();
    await registerPhone(student, 'some-fcm-token-1234567890').expect(422);
    await registerPhone(student, PHONE_A, 'Mars/Olympus').expect(422);
    expect(await tokensOf(student)).toEqual([]);
  });

  it('moves a phone to whoever signed in on it last', async () => {
    const first = await registerUser();
    const second = await registerUser();
    await registerPhone(first, PHONE_A).expect(200);
    await registerPhone(second, PHONE_A).expect(200);

    expect(await tokensOf(first)).toEqual([]);
    expect(await tokensOf(second)).toEqual([PHONE_A]);
  });

  it('does not duplicate a phone that registers twice, and forgets it on sign-out', async () => {
    const student = await registerUser();
    await registerPhone(student, PHONE_A).expect(200);
    await registerPhone(student, PHONE_B).expect(200);
    await registerPhone(student, PHONE_A).expect(200);
    expect(await tokensOf(student)).toEqual([PHONE_B, PHONE_A]);

    await request(getApp())
      .delete(`${API}/auth/push-token`)
      .set(auth(student.accessToken))
      .send({ token: PHONE_A })
      .expect(200);
    expect(await tokensOf(student)).toEqual([PHONE_B]);
  });
});

describe('push delivery', () => {
  it('sends a chat message with the sender as the title and the chat as the target', async () => {
    const { aarav, priya, conversationId } = await connectedPair();
    await registerPhone(priya, PHONE_A).expect(200);

    await request(getApp())
      .post(`${API}/conversations/${conversationId}/messages`)
      .set(auth(aarav.accessToken))
      .send({ body: 'Hi Priya, is Thursday good?' })
      .expect(201);
    await pushesSettled();

    expect(sent).toHaveLength(1);
    const [message] = sent;
    expect(message).toMatchObject({
      to: PHONE_A,
      title: 'Aarav Mehta',
      body: 'Hi Priya, is Thursday good?',
      channelId: 'messages',
      tag: `chat:${conversationId}`,
      threadId: `chat:${conversationId}`,
    });
    expect(message?.data).toMatchObject({
      type: 'MESSAGE_RECEIVED',
      screen: 'Chat',
      conversationId,
      partnerId: aarav.id,
      actorName: 'Aarav Mehta',
    });
    expect(message?.data.notificationId).toMatch(/^[0-9a-f]{24}$/);
    // The badge counts what Priya has not read, this message included.
    expect(message?.badge).toBeGreaterThanOrEqual(1);
  });

  it('writes a booked session’s time in the recipient’s time zone', async () => {
    const { aarav, priya, figma } = await connectedPair();
    await registerPhone(priya, PHONE_A, 'America/New_York').expect(200);

    const start = new Date(Date.now() + 3 * 86_400_000);
    start.setUTCHours(15, 0, 0, 0);
    await request(getApp())
      .post(`${API}/sessions`)
      .set(auth(aarav.accessToken))
      .send({
        partnerId: priya.id,
        role: 'LEARNER',
        skillId: figma,
        scheduledAt: start.toISOString(),
        durationMinutes: 60,
        mode: 'ONLINE',
        meetingLink: 'https://meet.example.com/abc',
      })
      .expect(201);
    await pushesSettled();

    const [message] = sent;
    expect(message?.title).toBe('Figma session booked');
    // 15:00 UTC is 10:00 am in New York (11:00 am in summer, but this is November).
    expect(message?.body).toMatch(/^Aarav Mehta booked \w{3} \d{1,2} \w{3}, (10|11):00 am · Online$/);
    expect(message?.channelId).toBe('sessions');
  });

  it('respects a category switched off, but never silences account notices', async () => {
    const { aarav, priya, conversationId } = await connectedPair();
    await registerPhone(priya, PHONE_A).expect(200);

    const updated = await request(getApp())
      .patch(`${API}/users/me`)
      .set(auth(priya.accessToken))
      .send({ notificationPrefs: { messages: false } })
      .expect(200);
    expect(updated.body.data.user.notificationPrefs).toEqual({
      messages: false,
      requests: true,
      reminders: true,
      sessions: true,
      achievements: true,
    });

    await request(getApp())
      .post(`${API}/conversations/${conversationId}/messages`)
      .set(auth(aarav.accessToken))
      .send({ body: 'Hello?' })
      .expect(201);
    await pushesSettled();
    expect(sent).toHaveLength(0);

    // Turning another switch off leaves the first one as it was.
    const again = await request(getApp())
      .patch(`${API}/users/me`)
      .set(auth(priya.accessToken))
      .send({ notificationPrefs: { achievements: false } })
      .expect(200);
    expect(again.body.data.user.notificationPrefs.messages).toBe(false);
    expect(again.body.data.user.notificationPrefs.achievements).toBe(false);

    const { notify } = await import('../../src/modules/notifications/service');
    await notify({ user: priya.id, type: 'MODERATION_NOTICE', title: 'Account suspended', body: 'x' });
    await pushesSettled();
    expect(sent.map((m) => m.channelId)).toEqual(['account']);
  });

  it('forgets a phone that Expo says can no longer receive pushes', async () => {
    const { aarav, priya, conversationId } = await connectedPair();
    await registerPhone(priya, PHONE_A).expect(200);
    await registerPhone(priya, PHONE_B).expect(200);
    answer = (m) =>
      m.to === PHONE_A
        ? { status: 'error', message: 'not registered', details: { error: 'DeviceNotRegistered' } }
        : { status: 'ok', id: 'ticket' };

    await request(getApp())
      .post(`${API}/conversations/${conversationId}/messages`)
      .set(auth(aarav.accessToken))
      .send({ body: 'Ping' })
      .expect(201);
    await pushesSettled();

    expect(sent.map((m) => m.to).sort()).toEqual([PHONE_A, PHONE_B].sort());
    expect(await tokensOf(priya)).toEqual([PHONE_B]);
  });

  it('keeps working when the push service is down', async () => {
    const { aarav, priya, conversationId } = await connectedPair();
    await registerPhone(priya, PHONE_A).expect(200);
    setPushTransport(async () => {
      throw new Error('Expo is down');
    });

    // The message still sends, and it is still in Priya's notification centre.
    await request(getApp())
      .post(`${API}/conversations/${conversationId}/messages`)
      .set(auth(aarav.accessToken))
      .send({ body: 'Still there?' })
      .expect(201);
    await pushesSettled();

    const unread = await request(getApp())
      .get(`${API}/notifications?unreadOnly=true`)
      .set(auth(priya.accessToken))
      .expect(200);
    expect(unread.body.data.items.map((n: { type: string }) => n.type)).toContain('MESSAGE_RECEIVED');
  });
});
