import { Router } from 'express';
import { z } from 'zod';
import { currentUserId, requireAuth, validate, validatedQuery } from '../../middleware';
import { Notification } from '../../models';
import { asyncHandler } from '../../utils/async';
import { paginate } from '../../utils/pagination';
import * as service from './service';

const listSchema = z.object({
  unreadOnly: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const markReadSchema = z.object({
  ids: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).min(1).max(100),
});

export const notificationsRouter = Router();

/** GET /notifications */
notificationsRouter.get(
  '/',
  requireAuth,
  validate({ query: listSchema }),
  asyncHandler(async (req, res) => {
    const { page, limit, unreadOnly } = validatedQuery<z.infer<typeof listSchema>>(req);
    const userId = currentUserId(req);

    const filter: Record<string, unknown> = { user: userId };
    if (unreadOnly) filter.read = false;

    const [items, total] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Notification.countDocuments(filter),
    ]);

    res.json({ data: paginate(items, total, { page, limit }) });
  }),
);

/** GET /notifications/unread-count */
notificationsRouter.get(
  '/unread-count',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ data: { count: await service.unreadCount(currentUserId(req)) } });
  }),
);

/** POST /notifications/read — mark specific notifications as read. */
notificationsRouter.post(
  '/read',
  requireAuth,
  validate({ body: markReadSchema }),
  asyncHandler(async (req, res) => {
    const count = await service.markRead(currentUserId(req), req.body.ids);
    res.json({ data: { markedRead: count } });
  }),
);

/** POST /notifications/read-all */
notificationsRouter.post(
  '/read-all',
  requireAuth,
  asyncHandler(async (req, res) => {
    const count = await service.markAllRead(currentUserId(req));
    res.json({ data: { markedRead: count } });
  }),
);
