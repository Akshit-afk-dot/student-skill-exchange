import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { User } from '../../src/models';
import { API, addUserSkill, auth, connectUsers, getApp, registerUser, seedSkill } from '../helpers/api';
import { clearDb, startTestDb, stopTestDb } from '../helpers/db';

// In production the requirement switches on with SMTP. Tests have no mail server, so
// it is switched on directly; vitest isolates modules per file, so no other suite sees this.
vi.mock('../../src/config/features', () => ({ emailVerificationRequired: () => true }));

beforeAll(async () => {
  await startTestDb();
});
afterAll(async () => {
  await stopTestDb();
});
afterEach(async () => {
  await clearDb();
});

async function verify(userId: string, verified = true): Promise<void> {
  await User.updateOne({ _id: userId }, { emailVerified: verified });
}

describe('when email verification is required', () => {
  it('blocks requests from an unverified student and allows them once verified', async () => {
    const figma = await seedSkill('Figma', 'Design');
    const aarav = await registerUser({ name: 'Aarav' });
    const priya = await registerUser({ name: 'Priya' });
    await addUserSkill(priya.accessToken, figma, 'TEACH', 'ADVANCED');

    const send = () =>
      request(getApp())
        .post(`${API}/requests`)
        .set(auth(aarav.accessToken))
        .send({ receiverId: priya.id, skillId: figma, message: 'Teach me Figma?' });

    const refused = await send().expect(403);
    expect(refused.body.error.code).toBe('EMAIL_NOT_VERIFIED');

    await verify(aarav.id);
    await send().expect(201);
  });

  it('blocks chat messages from an unverified student', async () => {
    const figma = await seedSkill('Figma', 'Design');
    const aarav = await registerUser({ name: 'Aarav' });
    const priya = await registerUser({ name: 'Priya' });
    await addUserSkill(priya.accessToken, figma, 'TEACH', 'ADVANCED');
    await verify(aarav.id);
    await verify(priya.id);
    const { conversationId } = await connectUsers(aarav, priya, figma);

    await verify(aarav.id, false);
    const refused = await request(getApp())
      .post(`${API}/conversations/${conversationId}/messages`)
      .set(auth(aarav.accessToken))
      .send({ body: 'Hello!' })
      .expect(403);
    expect(refused.body.error.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('leaves browsing open to unverified students', async () => {
    const aarav = await registerUser({ name: 'Aarav' });
    await request(getApp()).get(`${API}/users`).set(auth(aarav.accessToken)).expect(200);
    await request(getApp()).get(`${API}/matches`).set(auth(aarav.accessToken)).expect(200);
  });
});
