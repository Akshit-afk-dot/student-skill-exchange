import { Router } from 'express';
import { z } from 'zod';
import { currentUserId, requireAuth, validate, validatedQuery, writeLimiter } from '../../middleware';
import { SKILL_LEVELS, USER_SKILL_TYPES } from '../../types/domain';
import { asyncHandler } from '../../utils/async';
import { objectIdParam } from '../users/validators';
import * as service from './service';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

const searchSkillsSchema = z.object({
  q: z.string().trim().max(80).optional(),
  category: objectId.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const addUserSkillSchema = z
  .object({
    skillId: objectId.optional(),
    skillName: z.string().trim().min(2).max(80).optional(),
    categoryId: objectId.optional(),
    type: z.enum(USER_SKILL_TYPES),
    level: z.enum(SKILL_LEVELS),
    yearsOfExperience: z.coerce.number().min(0).max(50).optional(),
    description: z.string().trim().max(300).optional(),
    priority: z.coerce.number().int().min(1).max(3).optional(),
  })
  .refine((v) => Boolean(v.skillId) || Boolean(v.skillName && v.categoryId), {
    message: 'Provide either skillId, or skillName together with categoryId',
    path: ['skillId'],
  });

const updateUserSkillSchema = z
  .object({
    level: z.enum(SKILL_LEVELS).optional(),
    yearsOfExperience: z.coerce.number().min(0).max(50).optional(),
    description: z.string().trim().max(300).optional(),
    priority: z.coerce.number().int().min(1).max(3).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });

export const skillsRouter = Router();

/** GET /skills/categories */
skillsRouter.get(
  '/categories',
  asyncHandler(async (_req, res) => {
    res.json({ data: await service.listCategories() });
  }),
);

/** GET /skills/popular — feeds the Explore screen and the admin analytics. */
skillsRouter.get(
  '/popular',
  asyncHandler(async (_req, res) => {
    res.json({ data: await service.popularSkills() });
  }),
);

/** GET /skills — catalogue search, used by the skill picker. */
skillsRouter.get(
  '/',
  validate({ query: searchSkillsSchema }),
  asyncHandler(async (req, res) => {
    const query = validatedQuery<z.infer<typeof searchSkillsSchema>>(req);
    res.json({ data: await service.searchSkills(query) });
  }),
);

export const userSkillsRouter = Router();

/** GET /user-skills — the caller's teach and learn lists. */
userSkillsRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const rows = await service.listUserSkills(currentUserId(req));
    res.json({
      data: {
        teaches: rows.filter((r) => r.type === 'TEACH'),
        learns: rows.filter((r) => r.type === 'LEARN'),
      },
    });
  }),
);

/** POST /user-skills — add a skill to the caller's teach or learn list. */
userSkillsRouter.post(
  '/',
  requireAuth,
  writeLimiter,
  validate({ body: addUserSkillSchema }),
  asyncHandler(async (req, res) => {
    const created = await service.addUserSkill(currentUserId(req), req.body);
    res.status(201).json({ data: created });
  }),
);

/** PATCH /user-skills/:id */
userSkillsRouter.patch(
  '/:id',
  requireAuth,
  writeLimiter,
  validate({ params: objectIdParam, body: updateUserSkillSchema }),
  asyncHandler(async (req, res) => {
    const updated = await service.updateUserSkill(
      currentUserId(req),
      req.params.id as string,
      req.body,
    );
    res.json({ data: updated });
  }),
);

/** DELETE /user-skills/:id */
userSkillsRouter.delete(
  '/:id',
  requireAuth,
  writeLimiter,
  validate({ params: objectIdParam }),
  asyncHandler(async (req, res) => {
    await service.removeUserSkill(currentUserId(req), req.params.id as string);
    res.status(204).send();
  }),
);
