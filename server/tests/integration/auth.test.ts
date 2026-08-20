import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { RefreshToken, User } from '../../src/models';
import { API, auth, getApp, registerUser } from '../helpers/api';
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

describe('POST /auth/register', () => {
  it('creates an account and returns a token pair', async () => {
    const res = await request(getApp())
      .post(`${API}/auth/register`)
      .send({
        name: 'Rahul Sharma',
        email: 'rahul@college.edu',
        password: 'Password123',
        college: 'PES University',
        department: 'Computer Science',
        year: 3,
      })
      .expect(201);

    expect(res.body.data.user.email).toBe('rahul@college.edu');
    expect(res.body.data.user.name).toBe('Rahul Sharma');
    expect(res.body.data.tokens.accessToken).toBeTruthy();
    expect(res.body.data.tokens.refreshToken).toBeTruthy();
  });

  it('never returns the password hash', async () => {
    const res = await request(getApp())
      .post(`${API}/auth/register`)
      .send({ name: 'Test User', email: 'hash@college.edu', password: 'Password123' })
      .expect(201);

    const serialised = JSON.stringify(res.body);
    expect(serialised).not.toContain('passwordHash');
    expect(serialised).not.toContain('Password123');
  });

  it('stores the password as a bcrypt hash, not plaintext', async () => {
    await request(getApp())
      .post(`${API}/auth/register`)
      .send({ name: 'Test User', email: 'bcrypt@college.edu', password: 'Password123' })
      .expect(201);

    const user = await User.findOne({ email: 'bcrypt@college.edu' }).select('+passwordHash');
    expect(user?.passwordHash).toBeTruthy();
    expect(user?.passwordHash).not.toBe('Password123');
    expect(user?.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  it('rejects a duplicate email with 409', async () => {
    const payload = { name: 'First', email: 'dupe@college.edu', password: 'Password123' };
    await request(getApp()).post(`${API}/auth/register`).send(payload).expect(201);

    const res = await request(getApp())
      .post(`${API}/auth/register`)
      .send({ ...payload, name: 'Second' })
      .expect(409);

    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('rejects a weak password with field-level errors', async () => {
    const res = await request(getApp())
      .post(`${API}/auth/register`)
      .send({ name: 'Weak', email: 'weak@college.edu', password: 'short' })
      .expect(422);

    expect(res.body.error.code).toBe('UNPROCESSABLE');
    expect(res.body.error.details.password).toBeTruthy();
  });

  it('rejects a password with no digit', async () => {
    const res = await request(getApp())
      .post(`${API}/auth/register`)
      .send({ name: 'NoDigit', email: 'nodigit@college.edu', password: 'onlyletters' })
      .expect(422);

    expect(res.body.error.details.password).toContain('number');
  });

  it('normalises the email to lowercase', async () => {
    await request(getApp())
      .post(`${API}/auth/register`)
      .send({ name: 'Case', email: 'MiXeD@College.EDU', password: 'Password123' })
      .expect(201);

    expect(await User.findOne({ email: 'mixed@college.edu' })).toBeTruthy();
  });
});

describe('POST /auth/login', () => {
  it('signs in with correct credentials', async () => {
    const user = await registerUser({ password: 'Password123' });

    const res = await request(getApp())
      .post(`${API}/auth/login`)
      .send({ email: user.email, password: 'Password123' })
      .expect(200);

    expect(res.body.data.user.id).toBe(user.id);
  });

  it('gives the same generic error for a wrong password and an unknown account', async () => {
    const user = await registerUser();

    const wrongPassword = await request(getApp())
      .post(`${API}/auth/login`)
      .send({ email: user.email, password: 'WrongPassword1' })
      .expect(401);

    const unknownUser = await request(getApp())
      .post(`${API}/auth/login`)
      .send({ email: 'nobody@college.edu', password: 'Password123' })
      .expect(401);

    // Identical responses: the endpoint must not reveal which emails are registered.
    expect(wrongPassword.body.error.message).toBe(unknownUser.body.error.message);
  });

  it('refuses a suspended account', async () => {
    const user = await registerUser();
    await User.updateOne({ _id: user.id }, { $set: { status: 'SUSPENDED' } });

    const res = await request(getApp())
      .post(`${API}/auth/login`)
      .send({ email: user.email, password: user.password })
      .expect(403);

    expect(res.body.error.code).toBe('ACCOUNT_SUSPENDED');
  });

  it('lets a lapsed suspension through', async () => {
    const user = await registerUser();
    await User.updateOne(
      { _id: user.id },
      { $set: { status: 'SUSPENDED', suspendedUntil: new Date(Date.now() - 86_400_000) } },
    );

    await request(getApp())
      .post(`${API}/auth/login`)
      .send({ email: user.email, password: user.password })
      .expect(200);
  });
});

describe('GET /auth/me', () => {
  it('returns the signed-in student', async () => {
    const user = await registerUser();

    const res = await request(getApp())
      .get(`${API}/auth/me`)
      .set(auth(user.accessToken))
      .expect(200);

    expect(res.body.data.user.id).toBe(user.id);
    expect(res.body.data.user.email).toBe(user.email);
  });

  it('rejects a missing, malformed or garbage token', async () => {
    await request(getApp()).get(`${API}/auth/me`).expect(401);
    await request(getApp()).get(`${API}/auth/me`).set({ Authorization: 'Bearer nope' }).expect(401);
    await request(getApp()).get(`${API}/auth/me`).set({ Authorization: 'Basic abc' }).expect(401);
  });

  it('rejects a token whose account was deleted', async () => {
    const user = await registerUser();
    await User.deleteOne({ _id: user.id });

    await request(getApp()).get(`${API}/auth/me`).set(auth(user.accessToken)).expect(401);
  });

  it('rejects immediately when the account is banned, without waiting for token expiry', async () => {
    const user = await registerUser();
    await User.updateOne({ _id: user.id }, { $set: { status: 'BANNED' } });

    const res = await request(getApp())
      .get(`${API}/auth/me`)
      .set(auth(user.accessToken))
      .expect(403);

    expect(res.body.error.code).toBe('ACCOUNT_BANNED');
  });
});

describe('POST /auth/refresh', () => {
  it('rotates the refresh token and issues a new access token', async () => {
    const user = await registerUser();

    const res = await request(getApp())
      .post(`${API}/auth/refresh`)
      .send({ refreshToken: user.refreshToken })
      .expect(200);

    expect(res.body.data.tokens.refreshToken).not.toBe(user.refreshToken);
    expect(res.body.data.tokens.accessToken).toBeTruthy();

    // The new token works.
    await request(getApp())
      .get(`${API}/auth/me`)
      .set(auth(res.body.data.tokens.accessToken))
      .expect(200);
  });

  it('detects reuse of a rotated token and kills every session', async () => {
    const user = await registerUser();

    const first = await request(getApp())
      .post(`${API}/auth/refresh`)
      .send({ refreshToken: user.refreshToken })
      .expect(200);

    // Replaying the original (now revoked) token is the signature of a stolen token.
    const replay = await request(getApp())
      .post(`${API}/auth/refresh`)
      .send({ refreshToken: user.refreshToken })
      .expect(401);

    expect(replay.body.error.code).toBe('TOKEN_REUSE_DETECTED');

    // The legitimate client's newer token is revoked too — everything is signed out.
    await request(getApp())
      .post(`${API}/auth/refresh`)
      .send({ refreshToken: first.body.data.tokens.refreshToken })
      .expect(401);
  });

  it('rejects an unknown refresh token', async () => {
    await request(getApp())
      .post(`${API}/auth/refresh`)
      .send({ refreshToken: 'a'.repeat(96) })
      .expect(401);
  });

  it('stores only a hash of the refresh token', async () => {
    const user = await registerUser();
    const stored = await RefreshToken.findOne({ user: user.id });

    expect(stored).toBeTruthy();
    expect(stored?.tokenHash).not.toBe(user.refreshToken);
    expect(stored?.tokenHash).toHaveLength(64); // sha256 hex
  });
});

describe('POST /auth/logout', () => {
  it('revokes the presented refresh token', async () => {
    const user = await registerUser();

    await request(getApp())
      .post(`${API}/auth/logout`)
      .send({ refreshToken: user.refreshToken })
      .expect(200);

    await request(getApp())
      .post(`${API}/auth/refresh`)
      .send({ refreshToken: user.refreshToken })
      .expect(401);
  });
});

describe('POST /auth/change-password', () => {
  it('changes the password and signs out other sessions', async () => {
    const user = await registerUser({ password: 'Password123' });

    await request(getApp())
      .post(`${API}/auth/change-password`)
      .set(auth(user.accessToken))
      .send({ currentPassword: 'Password123', newPassword: 'NewPassword456' })
      .expect(200);

    await request(getApp())
      .post(`${API}/auth/login`)
      .send({ email: user.email, password: 'NewPassword456' })
      .expect(200);

    // The old refresh token no longer works.
    await request(getApp())
      .post(`${API}/auth/refresh`)
      .send({ refreshToken: user.refreshToken })
      .expect(401);
  });

  it('rejects a wrong current password', async () => {
    const user = await registerUser({ password: 'Password123' });

    await request(getApp())
      .post(`${API}/auth/change-password`)
      .set(auth(user.accessToken))
      .send({ currentPassword: 'NotIt123', newPassword: 'NewPassword456' })
      .expect(400);
  });
});

describe('password reset', () => {
  it('answers identically for known and unknown addresses', async () => {
    const user = await registerUser();

    const known = await request(getApp())
      .post(`${API}/auth/forgot-password`)
      .send({ email: user.email })
      .expect(200);

    const unknown = await request(getApp())
      .post(`${API}/auth/forgot-password`)
      .send({ email: 'ghost@college.edu' })
      .expect(200);

    expect(known.body).toEqual(unknown.body);
  });

  it('resets the password with a valid code and rejects a wrong one', async () => {
    const user = await registerUser();
    await request(getApp())
      .post(`${API}/auth/forgot-password`)
      .send({ email: user.email })
      .expect(200);

    // The real OTP only ever leaves the server by email, and it is stored hashed, so
    // there is nothing to read back. Overwrite it with a known code instead.
    const { createHash } = await import('node:crypto');
    const otp = '123456';
    await User.updateOne(
      { _id: user.id },
      {
        $set: {
          passwordResetTokenHash: createHash('sha256').update(otp).digest('hex'),
          passwordResetExpires: new Date(Date.now() + 600_000),
        },
      },
    );

    await request(getApp())
      .post(`${API}/auth/reset-password`)
      .send({ email: user.email, otp: '000000', password: 'Whatever123' })
      .expect(400);

    await request(getApp())
      .post(`${API}/auth/reset-password`)
      .send({ email: user.email, otp, password: 'BrandNew123' })
      .expect(200);

    await request(getApp())
      .post(`${API}/auth/login`)
      .send({ email: user.email, password: 'BrandNew123' })
      .expect(200);
  });

  it('rejects an expired reset code', async () => {
    const user = await registerUser();
    const { createHash } = await import('node:crypto');

    await User.updateOne(
      { _id: user.id },
      {
        $set: {
          passwordResetTokenHash: createHash('sha256').update('123456').digest('hex'),
          passwordResetExpires: new Date(Date.now() - 1000),
        },
      },
    );

    await request(getApp())
      .post(`${API}/auth/reset-password`)
      .send({ email: user.email, otp: '123456', password: 'BrandNew123' })
      .expect(400);
  });
});

describe('GET /health', () => {
  it('reports the database connection', async () => {
    const res = await request(getApp()).get('/health').expect(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.database).toBe('connected');
  });
});
