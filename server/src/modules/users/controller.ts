import { Router } from 'express';
import {
  authLimiter,
  currentUser,
  currentUserId,
  optionalAuth,
  requireAuth,
  validate,
  validatedQuery,
  writeLimiter,
} from '../../middleware';
import { asyncHandler } from '../../utils/async';
import { ApiError } from '../../utils/errors';
import { assertCanDelete, deleteAccount } from '../account/service';
import { blockUser, listBlocked, relationship, unblockUser } from '../blocks/service';
import { sendAccountDeletedEmail } from '../notifications/mail';
import * as service from './service';
import { selfUser } from './serializer';
import {
  deleteAccountSchema,
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

/**
 * DELETE /users/me — permanently deletes the caller's account. Both app stores require
 * this to be possible from inside the app. Asks for the password again when there is one.
 */
usersRouter.delete(
  '/me',
  requireAuth,
  authLimiter,
  validate({ body: deleteAccountSchema }),
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    await assertCanDelete(user, req.body.password);
    const deleted = await deleteAccount(String(user._id));
    if (deleted) await sendAccountDeletedEmail(deleted.email, deleted.name);
    res.json({ data: { deleted: true } });
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

/** GET /users/me/blocked — the students the caller has blocked, for the Settings list. */
usersRouter.get(
  '/me/blocked',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ data: await listBlocked(currentUserId(req)) });
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

/** POST /users/:id/block */
usersRouter.post(
  '/:id/block',
  requireAuth,
  writeLimiter,
  validate({ params: objectIdParam }),
  asyncHandler(async (req, res) => {
    await blockUser(currentUserId(req), req.params.id as string);
    res.json({ data: { blocked: true } });
  }),
);

/** DELETE /users/:id/block */
usersRouter.delete(
  '/:id/block',
  requireAuth,
  writeLimiter,
  validate({ params: objectIdParam }),
  asyncHandler(async (req, res) => {
    await unblockUser(currentUserId(req), req.params.id as string);
    res.json({ data: { blocked: false } });
  }),
);

/**
 * GET /users/:id — another student's public profile.
 * Declared after /me and /facets so those literals are not captured as an id.
 *
 * A student who blocked the viewer is reported as not found, exactly as if they did not
 * exist; one the viewer blocked is shown with `blockedByMe` so the app can offer unblock.
 */
usersRouter.get(
  '/:id',
  optionalAuth,
  validate({ params: objectIdParam }),
  asyncHandler(async (req, res) => {
    const targetId = req.params.id as string;
    const detail = await service.getProfileDetail(targetId);

    if (!req.userId) {
      res.json({ data: detail });
      return;
    }
    const { blockedByMe, blockedMe } = await relationship(req.userId, targetId);
    if (blockedMe) throw ApiError.notFound('Student not found');
    res.json({ data: { ...detail, blockedByMe } });
  }),
);
