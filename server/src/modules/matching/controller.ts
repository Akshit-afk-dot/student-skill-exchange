import { Router } from 'express';
import { z } from 'zod';
import { currentUserId, requireAuth, validate, validatedQuery } from '../../middleware';
import { asyncHandler } from '../../utils/async';
import { objectIdParam } from '../users/validators';
import * as service from './service';

const recommendationsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  twoWayOnly: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  minScore: z.coerce.number().min(0).max(1).optional(),
  skill: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
});

export const matchingRouter = Router();

/** GET /matches — ranked learning partners for the signed-in student. */
matchingRouter.get(
  '/',
  requireAuth,
  validate({ query: recommendationsSchema }),
  asyncHandler(async (req, res) => {
    const query = validatedQuery<z.infer<typeof recommendationsSchema>>(req);
    res.json({ data: await service.getRecommendations(currentUserId(req), query) });
  }),
);

/** GET /matches/weights — the live weighting, so the UI can explain the score. */
matchingRouter.get(
  '/weights',
  requireAuth,
  asyncHandler(async (_req, res) => {
    res.json({ data: service.weightsFromEnv() });
  }),
);

/** GET /matches/:id — the full score breakdown for one specific student. */
matchingRouter.get(
  '/:id',
  requireAuth,
  validate({ params: objectIdParam }),
  asyncHandler(async (req, res) => {
    res.json({ data: await service.explainMatch(currentUserId(req), req.params.id as string) });
  }),
);
