import { Router } from 'express';
import {
  currentUser,
  currentUserId,
  optionalAuth,
  requireAuth,
  validate,
  validatedQuery,
  writeLimiter,
} from '../../middleware';
import { asyncHandler } from '../../utils/async';
import * as service from './service';
import { selfUser } from './serializer';
import {
  objectIdParam,
  searchUsersSchema,
  updateLocationSchema,
  updateProfileSchema,
  type SearchUsersInput,
} from './validators';

export const usersRouter = Router();

/**
 * GET /users — skill discovery search.
 * Open to anonymous callers so the Explore screen works before sign-in.
 */
usersRouter.get(
  '/',
  optionalAuth,
  validate({ query: searchUsersSchema }),
  asyncHandler(async (req, res) => {
    const filters = validatedQuery<SearchUsersInput>(req);
    const results = await service.searchUsers(req.userId ?? null, filters);
    res.json({ data: results });
  }),
);

/** GET /users/facets — filter options for the Explore screen. */
usersRouter.get(
  '/facets',
  asyncHandler(async (_req, res) => {
    res.json({ data: await service.getDirectoryFacets() });
  }),
);

/** PATCH /users/me */
usersRouter.patch(
  '/me',
  requireAuth,
  writeLimiter,
  validate({ body: updateProfileSchema }),
  asyncHandler(async (req, res) => {
    const user = await service.updateProfile(currentUserId(req), req.body);
    res.json({ data: { user: selfUser(user) } });
  }),
);

/** PUT /users/me/location — powers distance-based matching. */
usersRouter.put(
  '/me/location',
  requireAuth,
  writeLimiter,
  validate({ body: updateLocationSchema }),
  asyncHandler(async (req, res) => {
    const user = await service.updateLocation(
      currentUserId(req),
      req.body.longitude,
      req.body.latitude,
      req.body.city,
    );
    res.json({ data: { user: selfUser(user) } });
  }),
);

/** GET /users/me — the caller's own full profile. */
usersRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const detail = await service.getProfileDetail(currentUserId(req));
    res.json({ data: { ...detail, ...selfUser(currentUser(req)) } });
  }),
);

/**
 * GET /users/:id — another student's public profile.
 * Declared after /me and /facets so those literals are not captured as an id.
 */
usersRouter.get(
  '/:id',
  optionalAuth,
  validate({ params: objectIdParam }),
  asyncHandler(async (req, res) => {
    const detail = await service.getProfileDetail(req.params.id as string);
    res.json({ data: detail });
  }),
);
