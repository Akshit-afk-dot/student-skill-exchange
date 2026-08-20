import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../src/app';
import { Skill, SkillCategory, User, skillSlug } from '../../src/models';
import type { SkillCategoryName } from '../../src/types/domain';

export const API = '/api/v1';

let app: Express | null = null;

export function getApp(): Express {
  app ??= createApp();
  return app;
}

export interface TestUser {
  id: string;
  name: string;
  email: string;
  password: string;
  accessToken: string;
  refreshToken: string;
}

let counter = 0;

/** Registers a student through the real endpoint and returns their tokens. */
export async function registerUser(overrides: Partial<{ name: string; email: string; password: string; college: string }> = {}): Promise<TestUser> {
  counter += 1;
  const payload = {
    name: overrides.name ?? `Student ${counter}`,
    email: overrides.email ?? `student${counter}.${Date.now()}@college.edu`,
    password: overrides.password ?? 'Password123',
    college: overrides.college ?? 'Test University',
  };

  const res = await request(getApp()).post(`${API}/auth/register`).send(payload).expect(201);

  return {
    id: res.body.data.user.id,
    name: payload.name,
    email: payload.email,
    password: payload.password,
    accessToken: res.body.data.tokens.accessToken,
    refreshToken: res.body.data.tokens.refreshToken,
  };
}

export async function makeAdmin(email: string): Promise<void> {
  await User.updateOne({ email: email.toLowerCase() }, { $set: { role: 'ADMIN' } });
}

/** Signs in again, which is how an admin picks up their new role claim. */
export async function login(email: string, password: string): Promise<string> {
  const res = await request(getApp())
    .post(`${API}/auth/login`)
    .send({ email, password })
    .expect(200);
  return res.body.data.tokens.accessToken;
}

export function auth(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

/**
 * Creates a category + skill directly, bypassing the admin endpoints.
 * Find-then-create rather than an upsert: tests are single-threaded, so the simpler
 * form is clearer than working around findOneAndUpdate's overloads.
 */
export async function seedSkill(
  name: string,
  categoryName: SkillCategoryName = 'Programming',
): Promise<string> {
  const category =
    (await SkillCategory.findOne({ name: categoryName })) ??
    (await SkillCategory.create({
      name: categoryName,
      slug: categoryName.toLowerCase(),
      order: 1,
    }));

  const slug = skillSlug(name);
  const skill =
    (await Skill.findOne({ slug })) ??
    (await Skill.create({ name, slug, category: category._id, approved: true }));

  return String(skill._id);
}

export async function addUserSkill(
  token: string,
  skillId: string,
  type: 'TEACH' | 'LEARN',
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT',
  priority?: number,
): Promise<string> {
  const res = await request(getApp())
    .post(`${API}/user-skills`)
    .set(auth(token))
    .send({ skillId, type, level, ...(priority ? { priority } : {}) })
    .expect(201);
  return res.body.data._id ?? res.body.data.id;
}

/**
 * Runs the request/accept handshake so two students are connected.
 * Returns the conversation they can now use.
 */
export async function connectUsers(
  a: TestUser,
  b: TestUser,
  skillId: string,
): Promise<{ conversationId: string; requestId: string }> {
  const created = await request(getApp())
    .post(`${API}/requests`)
    .set(auth(a.accessToken))
    .send({ receiverId: b.id, skillId, message: 'Could you teach me this?' })
    .expect(201);

  const requestId = created.body.data._id;

  const accepted = await request(getApp())
    .post(`${API}/requests/${requestId}/accept`)
    .set(auth(b.accessToken))
    .expect(200);

  return { conversationId: accepted.body.data.conversationId, requestId };
}
