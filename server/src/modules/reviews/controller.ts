import { Router } from 'express';
import { z } from 'zod';
import { currentUserId, requireAuth, validate, validatedQuery, writeLimiter } from '../../middleware';
import { asyncHandler } from '../../utils/async';
import { objectIdParam } from '../users/validators';
import * as service from './service';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

const createReviewSchema = z.object({
  sessionId: objectId,
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

const updateReviewSchema = z
  .object({
    rating: z.coerce.number().int().min(1).max(5).optional(),
    comment: z.string().trim().max(1000).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const reviewsRouter = Router();

/** POST /reviews — rate the other participant of a completed session. */
reviewsRouter.post(
  '/',
  requireAuth,
  writeLimiter,
  validate({ body: createReviewSchema }),
  asyncHandler(async (req, res) => {
    const review = await service.createReview(currentUserId(req), req.body);
    res.status(201).json({ data: review });
  }),
);

/** GET /reviews/pending — completed sessions still awaiting the caller's rating. */
reviewsRouter.get(
  '/pending',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ data: await service.pendingReviews(currentUserId(req)) });
  }),
);

/** GET /reviews/written — reviews the caller has left. */
reviewsRouter.get(
  '/written',
  requireAuth,
  validate({ query: listSchema }),
  asyncHandler(async (req, res) => {
    const { page, limit } = validatedQuery<z.infer<typeof listSchema>>(req);
    res.json({ data: await service.listWritten(currentUserId(req), page, limit) });
  }),
);

/** GET /reviews/user/:id — public reviews for a student. */
reviewsRouter.get(
  '/user/:id',
  validate({ params: objectIdParam, query: listSchema }),
  asyncHandler(async (req, res) => {
    const { page, limit } = validatedQuery<z.infer<typeof listSchema>>(req);
    res.json({ data: await service.listForUser(req.params.id as string, page, limit) });
  }),
);

/** PATCH /reviews/:id — editable for 24 hours. */
reviewsRouter.patch(
  '/:id',
  requireAuth,
  writeLimiter,
  validate({ params: objectIdParam, body: updateReviewSchema }),
  asyncHandler(async (req, res) => {
    const review = await service.updateReview(
      req.params.id as string,
      currentUserId(req),
      req.body,
    );
    res.json({ data: review });
  }),
);

/** DELETE /reviews/:id */
reviewsRouter.delete(
  '/:id',
  requireAuth,
  validate({ params: objectIdParam }),
  asyncHandler(async (req, res) => {
    await service.deleteReview(req.params.id as string, currentUserId(req));
    res.status(204).send();
  }),
);
