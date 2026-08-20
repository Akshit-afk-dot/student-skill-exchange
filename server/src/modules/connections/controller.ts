import { Router } from 'express';
import { z } from 'zod';
import { currentUserId, requireAuth, validate, validatedQuery } from '../../middleware';
import { asyncHandler } from '../../utils/async';
import { objectIdParam } from '../users/validators';
import * as service from './service';

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const connectionsRouter = Router();

/** GET /connections — students the caller has an accepted exchange with. */
connectionsRouter.get(
  '/',
  requireAuth,
  validate({ query: listSchema }),
  asyncHandler(async (req, res) => {
    const { page, limit } = validatedQuery<z.infer<typeof listSchema>>(req);
    res.json({ data: await service.listConnections(currentUserId(req), page, limit) });
  }),
);

/** GET /connections/with/:id — the conversation id for a given student, if any. */
connectionsRouter.get(
  '/with/:id',
  requireAuth,
  validate({ params: objectIdParam }),
  asyncHandler(async (req, res) => {
    const otherId = req.params.id as string;
    const userId = currentUserId(req);
    const [connected, conversationId] = await Promise.all([
      service.isConnected(userId, otherId),
      service.getConversationFor(userId, otherId),
    ]);
    res.json({ data: { connected, conversationId } });
  }),
);

/** DELETE /connections/:id — ends the connection. */
connectionsRouter.delete(
  '/:id',
  requireAuth,
  validate({ params: objectIdParam }),
  asyncHandler(async (req, res) => {
    await service.removeConnection(req.params.id as string, currentUserId(req));
    res.status(204).send();
  }),
);
