import { Router } from 'express';
import { z } from 'zod';
import { currentUser, currentUserId, requireAuth, validate, validatedQuery } from '../../middleware';
import { asyncHandler } from '../../utils/async';
import { objectIdParam } from '../users/validators';
import * as service from './service';

const leaderboardSchema = z.object({
  scope: z.enum(['global', 'college']).default('global'),
  college: z.string().trim().max(140).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const gamificationRouter = Router();

/**
 * GET /gamification/leaderboard
 * scope=college with no explicit college defaults to the caller's own.
 */
gamificationRouter.get(
  '/leaderboard',
  requireAuth,
  validate({ query: leaderboardSchema }),
  asyncHandler(async (req, res) => {
    const query = validatedQuery<z.infer<typeof leaderboardSchema>>(req);
    const college = query.college ?? currentUser(req).college;

    res.json({
      data: await service.leaderboard({
        scope: query.scope,
        ...(college ? { college } : {}),
        page: query.page,
        limit: query.limit,
      }),
    });
  }),
);

/** GET /gamification/analytics — the caller's own learning analytics. */
gamificationRouter.get(
  '/analytics',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ data: await service.analyticsFor(currentUserId(req)) });
  }),
);

/** GET /gamification/analytics/:id — another student's public analytics. */
gamificationRouter.get(
  '/analytics/:id',
  requireAuth,
  validate({ params: objectIdParam }),
  asyncHandler(async (req, res) => {
    res.json({ data: await service.analyticsFor(req.params.id as string) });
  }),
);

/** GET /gamification/badges — the full badge catalogue and its criteria. */
gamificationRouter.get(
  '/badges',
  asyncHandler(async (_req, res) => {
    res.json({
      data: service.BADGE_RULES.map((r) => ({
        badge: r.badge,
        label: r.label,
        description: r.description,
      })),
    });
  }),
);
