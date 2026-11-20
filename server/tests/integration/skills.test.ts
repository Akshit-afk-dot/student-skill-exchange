import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Notification, Skill, SkillCategory, UserSkill } from '../../src/models';
import { COMMUNITY_APPROVAL_STUDENTS } from '../../src/modules/skills/service';
import { ensureSeedData } from '../../src/seed/bootstrap';
import { catalogEntries } from '../../src/seed/catalog';
import { API, auth, getApp, login, makeAdmin, registerUser, type TestUser } from '../helpers/api';
import { clearDb, startTestDb, stopTestDb } from '../helpers/db';
import type { SkillCategoryName } from '../../src/types/domain';

beforeAll(async () => {
  await startTestDb();
});
afterAll(async () => {
  await stopTestDb();
});
afterEach(async () => {
  await clearDb();
});

async function categoryId(name: SkillCategoryName): Promise<string> {
  const category = await SkillCategory.findOne({ name }).lean();
  if (!category) throw new Error(`No category ${name}`);
  return String(category._id);
}

function check(student: TestUser, name: string) {
  return request(getApp())
    .get(`${API}/skills/check`)
    .query({ name })
    .set(auth(student.accessToken));
}

function addByName(student: TestUser, skillName: string, categoryIdValue: string, extra: Record<string, unknown> = {}) {
  return request(getApp())
    .post(`${API}/user-skills`)
    .set(auth(student.accessToken))
    .send({ skillName, categoryId: categoryIdValue, type: 'TEACH', level: 'INTERMEDIATE', ...extra });
}

async function search(q: string): Promise<string[]> {
  const res = await request(getApp()).get(`${API}/skills`).query({ q }).expect(200);
  return res.body.data.items.map((s: { name: string }) => s.name);
}

describe('the catalogue on boot', () => {
  it('seeds every catalogue skill with its aliases, and a second boot changes nothing', async () => {
    await ensureSeedData();
    const total = await Skill.countDocuments();
    expect(total).toBe(catalogEntries().length);
    expect(await SkillCategory.countDocuments()).toBe(13);

    const js = await Skill.findOne({ name: 'JavaScript' }).lean();
    expect(js?.aliases).toEqual(expect.arrayContaining(['JS', 'ECMAScript']));
    expect(js?.approvedVia).toBe('CATALOGUE');
    expect(js?.createdAt).toBeInstanceOf(Date);

    // A second boot writes nothing: no new rows, and no row so much as re-stamped.
    const stamps = async () =>
      (await Skill.find().select('updatedAt').sort({ _id: 1 }).lean()).map((s) => s.updatedAt?.getTime());
    const before = await stamps();
    await new Promise((resolve) => setTimeout(resolve, 5));
    await ensureSeedData();
    expect(await Skill.countDocuments()).toBe(total);
    expect(await stamps()).toEqual(before);
  });

  it('upgrades an existing database without losing anyone\'s skills', async () => {
    // A database as the previous release left it: "C++" stored under the slug "c", Yoga
    // under Sports, and a student's own "rust" waiting for review.
    const sports = await SkillCategory.create({ name: 'Sports', slug: 'sports', order: 9 });
    const other = await SkillCategory.create({ name: 'Other', slug: 'other', order: 10 });
    const cpp = await Skill.create({ name: 'C++', slug: 'c', category: other._id, approved: true });
    const yoga = await Skill.create({ name: 'Yoga', slug: 'yoga', category: sports._id, approved: true });
    const rust = await Skill.create({ name: 'rust', slug: 'rust', category: other._id, approved: false });
    const student = await registerUser();
    await UserSkill.create({ user: student.id, skill: cpp._id, type: 'TEACH', level: 'ADVANCED' });

    await ensureSeedData();

    // C++ keeps its row, and so its student; C is a skill of its own again.
    const cppAfter = await Skill.findById(cpp._id).lean();
    expect(cppAfter).toMatchObject({ name: 'C++', slug: 'c-plus-plus' });
    expect(await UserSkill.countDocuments({ skill: cpp._id })).toBe(1);
    const c = await Skill.findOne({ slug: 'c' }).lean();
    expect(c?.name).toBe('C');
    expect(String(c?._id)).not.toBe(String(cpp._id));

    // Yoga follows the catalogue into its new category.
    const yogaAfter = await Skill.findById(yoga._id).lean();
    expect(String(yogaAfter?.category)).toBe(await categoryId('Health & Fitness'));

    // The student's "rust" is now the catalogue's Rust, approved, in place.
    const rustAfter = await Skill.findById(rust._id).lean();
    expect(rustAfter).toMatchObject({ name: 'Rust', approved: true, approvedVia: 'CATALOGUE' });
    expect(String(rustAfter?.category)).toBe(await categoryId('Programming'));

    // Other keeps its place at the end of the list.
    const categories = await request(getApp()).get(`${API}/skills/categories`).expect(200);
    const names = categories.body.data.map((c: { name: string }) => c.name);
    expect(names.at(-1)).toBe('Other');
    expect(names).toEqual(expect.arrayContaining(['Arts & Crafts', 'Dance', 'Health & Fitness']));
  });
});

describe('checking a new skill name', () => {
  it('recognises catalogue skills by alias and spelling variant', async () => {
    await ensureSeedData();
    const student = await registerUser();

    const js = await check(student, 'JS').expect(200);
    expect(js.body.data).toMatchObject({ status: 'EXISTING', skill: { name: 'JavaScript' } });

    const node = await check(student, 'nodejs').expect(200);
    expect(node.body.data).toMatchObject({ status: 'EXISTING', skill: { name: 'Node.js' } });

    const c = await check(student, 'C').expect(200);
    expect(c.body.data).toMatchObject({ status: 'EXISTING', skill: { name: 'C' } });
  });

  it('offers the catalogue skill for a typo or a narrower wording', async () => {
    await ensureSeedData();
    const student = await registerUser();

    const typo = await check(student, 'Pyhton').expect(200);
    expect(typo.body.data).toMatchObject({ status: 'SUGGESTION', kind: 'TYPO', suggestion: { name: 'Python' } });

    // Found on a phone: an extra letter in a longer name.
    const extra = await check(student, 'Pickeleball').expect(200);
    expect(extra.body.data).toMatchObject({ status: 'SUGGESTION', kind: 'TYPO', suggestion: { name: 'Pickleball' } });

    const narrower = await check(student, 'advanced excel').expect(200);
    expect(narrower.body.data).toMatchObject({
      status: 'SUGGESTION',
      kind: 'BROADER',
      name: 'Advanced Excel',
      suggestion: { name: 'Excel' },
    });
  });

  it('accepts a real new skill and refuses rubbish, saying why', async () => {
    await ensureSeedData();
    const student = await registerUser();

    const fresh = await check(student, 'bonsai').expect(200);
    expect(fresh.body.data).toEqual({ status: 'NEW', name: 'Bonsai', students: 0 });

    const rubbish = await check(student, 'asdfgh').expect(200);
    expect(rubbish.body.data).toMatchObject({ status: 'INVALID', problem: 'GIBBERISH' });
  });

  it('is for signed-in students only', async () => {
    await request(getApp()).get(`${API}/skills/check`).query({ name: 'Bonsai' }).expect(401);
  });
});

describe('adding a skill of your own', () => {
  it('is usable by the student at once but hidden from everyone else until approved', async () => {
    await ensureSeedData();
    const student = await registerUser();

    const res = await addByName(student, 'bonsai', await categoryId('Other')).expect(201);
    expect(res.body.data.skill).toMatchObject({ name: 'Bonsai', approved: false });

    const mine = await request(getApp()).get(`${API}/user-skills`).set(auth(student.accessToken)).expect(200);
    expect(mine.body.data.teaches[0].skill).toMatchObject({ name: 'Bonsai', approved: false });

    expect(await search('Bons')).toEqual([]);
  });

  it('uses the catalogue skill when the name is an alias, rather than adding a duplicate', async () => {
    await ensureSeedData();
    const student = await registerUser();
    const before = await Skill.countDocuments();

    const res = await addByName(student, 'JS', await categoryId('Other')).expect(201);
    expect(res.body.data.skill.name).toBe('JavaScript');
    expect(await Skill.countDocuments()).toBe(before);
  });

  it('asks "did you mean" for a typo, and adds it anyway once the student insists', async () => {
    await ensureSeedData();
    const student = await registerUser();
    const programming = await categoryId('Programming');

    const asked = await addByName(student, 'Pyhton', programming).expect(409);
    expect(asked.body.error.code).toBe('SKILL_SUGGESTION');
    expect(asked.body.error.details).toMatchObject({ suggestionName: 'Python' });

    const kept = await addByName(student, 'Pyhton', programming, { allowSimilar: true }).expect(201);
    expect(kept.body.data.skill).toMatchObject({ name: 'Pyhton', approved: false });
  });

  it('refuses rubbish with the reason', async () => {
    await ensureSeedData();
    const student = await registerUser();

    const res = await addByName(student, 'asdfgh', await categoryId('Other')).expect(422);
    expect(res.body.error.code).toBe('SKILL_NAME_REJECTED');
    expect(res.body.error.message).toMatch(/spelling/);
    expect(await Skill.countDocuments({ name: /asdf/i })).toBe(0);
  });

  it(`joins the catalogue once ${COMMUNITY_APPROVAL_STUDENTS} students have added it`, async () => {
    await ensureSeedData();
    const other = await categoryId('Other');
    const students = await Promise.all(
      Array.from({ length: COMMUNITY_APPROVAL_STUDENTS }, () => registerUser()),
    );

    for (const [i, student] of students.entries()) {
      if (i > 0) {
        // Each later student is told how many have added it so far.
        const seen = await check(student, 'Bonsai').expect(200);
        expect(seen.body.data).toEqual({ status: 'NEW', name: 'Bonsai', students: i });
      }
      await addByName(student, 'Bonsai', other, { type: i % 2 ? 'LEARN' : 'TEACH' }).expect(201);
      const approved = (await Skill.findOne({ name: 'Bonsai' }).lean())?.approved;
      expect(approved).toBe(i === students.length - 1);
    }

    expect((await Skill.findOne({ name: 'Bonsai' }).lean())?.approvedVia).toBe('COMMUNITY');
    expect(await search('Bons')).toEqual(['Bonsai']);
  });
});

describe('admin review of added skills', () => {
  async function createAdmin(): Promise<string> {
    const admin = await registerUser({ name: 'Admin User' });
    await makeAdmin(admin.email);
    return login(admin.email, admin.password);
  }

  it('lists skills in review with who added them, and approves one into the catalogue', async () => {
    await ensureSeedData();
    const token = await createAdmin();
    const student = await registerUser({ name: 'Asha Rao' });
    await addByName(student, 'Kite Flying', await categoryId('Other')).expect(201);

    const pending = await request(getApp())
      .get(`${API}/admin/skills`)
      .query({ status: 'pending' })
      .set(auth(token))
      .expect(200);
    expect(pending.body.data.items).toHaveLength(1);
    expect(pending.body.data.items[0]).toMatchObject({
      name: 'Kite Flying',
      approved: false,
      createdBy: { name: 'Asha Rao' },
    });

    const stats = await request(getApp()).get(`${API}/admin/stats`).set(auth(token)).expect(200);
    expect(stats.body.data.skills.unapproved).toBe(1);

    await request(getApp())
      .post(`${API}/admin/skills/${pending.body.data.items[0].id}/approve`)
      .set(auth(token))
      .expect(200);
    expect(await search('Kite')).toEqual(['Kite Flying']);
  });

  it('removes a skill from every list, tells the students, and keeps it out for good', async () => {
    await ensureSeedData();
    const token = await createAdmin();
    const other = await categoryId('Other');
    const [a, b] = await Promise.all([registerUser(), registerUser()]);
    await addByName(a, 'Napping Champion', other).expect(201);
    await addByName(b, 'Napping Champion', other, { type: 'LEARN' }).expect(201);
    const skill = await Skill.findOne({ name: 'Napping Champion' }).lean();

    await request(getApp())
      .post(`${API}/admin/skills/${String(skill!._id)}/reject`)
      .set(auth(token))
      .send({ reason: 'Not a skill that can be taught.' })
      .expect(200);

    expect(await UserSkill.countDocuments({ skill: skill!._id })).toBe(0);
    const notices = await Notification.find({ type: 'MODERATION_NOTICE' }).lean();
    expect(notices.map((n) => String(n.user)).sort()).toEqual([a.id, b.id].sort());
    expect(notices[0]).toMatchObject({
      title: 'A skill was removed',
      body: 'Moderators removed “Napping Champion” from your skills: Not a skill that can be taught.',
      data: { screen: 'MySkills' },
    });

    const verdict = await check(a, 'napping champion').expect(200);
    expect(verdict.body.data).toMatchObject({ status: 'INVALID', problem: 'REMOVED' });
    await addByName(a, 'Napping Champion', other).expect(422);

    const removed = await request(getApp())
      .get(`${API}/admin/skills`)
      .query({ status: 'removed' })
      .set(auth(token))
      .expect(200);
    expect(removed.body.data.items.map((s: { name: string }) => s.name)).toEqual(['Napping Champion']);

    // Approving it again restores the name to the catalogue.
    await request(getApp()).post(`${API}/admin/skills/${String(skill!._id)}/approve`).set(auth(token)).expect(200);
    const restored = await Skill.findById(skill!._id).lean();
    expect(restored).toMatchObject({ approved: true, approvedVia: 'ADMIN' });
    expect(restored?.rejectedAt).toBeUndefined();
  });

  it('will not remove a catalogue skill, since the next deploy would bring it back', async () => {
    await ensureSeedData();
    const token = await createAdmin();
    const python = await Skill.findOne({ name: 'Python' }).lean();

    await request(getApp())
      .post(`${API}/admin/skills/${String(python!._id)}/reject`)
      .set(auth(token))
      .expect(400);
  });
});
