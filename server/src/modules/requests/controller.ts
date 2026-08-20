import { Router } from 'express';
import { z } from 'zod';
import { currentUserId, requireAuth, validate, validatedQuery, writeLimiter } from '../../middleware';
import { REQUEST_STATUSES } from '../../types/domain';
import { asyncHandler } from '../../utils/async';
import { objectIdParam } from '../users/validators';
import * as service from './service';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

const createRequestSchema = z.object({
  receiverId: objectId,
  skillId: objectId,
  offeredSkillId: objectId.optional(),
  message: z.string().trim().min(1, 'Add a short message').max(1000),
});

const listRequestsSchema = z.object({
  direction: z.enum(['incoming', 'outgoing']).default('incoming'),
  status: z.enum(REQUEST_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const requestsRouter = Router();

/** POST /requests — send a learning request. */
requestsRouter.post(
  '/',
  requireAuth,
  writeLimiter,
  validate({ body: createRequestSchema }),
  asyncHandler(async (req, res) => {
    const request = await service.createRequest(currentUserId(req), req.body);
    res.status(201).json({ data: request });
  }),
);

/** GET /requests?direction=incoming|outgoing */
requestsRouter.get(
  '/',
  requireAuth,
  validate({ query: listRequestsSchema }),
  asyncHandler(async (req, res) => {
    const query = validatedQuery<z.infer<typeof listRequestsSchema>>(req);
    res.json({ data: await service.listRequests(currentUserId(req), query) });
  }),
);

/** GET /requests/pending-count — drives the badge on the tab bar. */
requestsRouter.get(
  '/pending-count',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ data: { count: await service.countPending(currentUserId(req)) } });
  }),
);

/** POST /requests/:id/accept — connects the two students and opens a conversation. */
requestsRouter.post(
  '/:id/accept',
  requireAuth,
  writeLimiter,
  validate({ params: objectIdParam }),
  asyncHandler(async (req, res) => {
    const result = await service.acceptRequest(req.params.id as string, currentUserId(req));
    res.json({
      data: {
        request: result.request,
        connectionId: String(result.connectionId),
        conversationId: String(result.conversationId),
      },
    });
  }),
);

/** POST /requests/:id/reject */
requestsRouter.post(
  '/:id/reject',
  requireAuth,
  writeLimiter,
  validate({ params: objectIdParam }),
  asyncHandler(async (req, res) => {
    res.json({ data: await service.rejectRequest(req.params.id as string, currentUserId(req)) });
  }),
);

/** POST /requests/:id/cancel — withdrawn by the sender. */
requestsRouter.post(
  '/:id/cancel',
  requireAuth,
  writeLimiter,
  validate({ params: objectIdParam }),
  asyncHandler(async (req, res) => {
    res.json({ data: await service.cancelRequest(req.params.id as string, currentUserId(req)) });
  }),
);
