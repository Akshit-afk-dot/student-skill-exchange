import { Router } from 'express';
import { z } from 'zod';
import { currentUserId, requireAuth, validate, validatedQuery, writeLimiter } from '../../middleware';
import { asyncHandler } from '../../utils/async';
import { objectIdParam } from '../users/validators';
import * as service from './service';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const messagesSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  before: objectId.optional(),
});

const sendMessageSchema = z
  .object({
    body: z.string().trim().max(4000).optional(),
    type: z.enum(['TEXT', 'IMAGE', 'FILE']).default('TEXT'),
    attachment: z
      .object({
        url: z.url(),
        mimeType: z.string().max(120),
        size: z.coerce.number().int().positive(),
        name: z.string().max(200).optional(),
      })
      .optional(),
  })
  .refine((v) => (v.type === 'TEXT' ? Boolean(v.body?.trim()) : Boolean(v.attachment)), {
    message: 'A text message needs a body; an image or file message needs an attachment',
    path: ['body'],
  });

export const chatRouter = Router();

/** GET /conversations */
chatRouter.get(
  '/',
  requireAuth,
  validate({ query: listSchema }),
  asyncHandler(async (req, res) => {
    const { page, limit } = validatedQuery<z.infer<typeof listSchema>>(req);
    res.json({ data: await service.listConversations(currentUserId(req), page, limit) });
  }),
);

/** GET /conversations/unread-count */
chatRouter.get(
  '/unread-count',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ data: { count: await service.totalUnread(currentUserId(req)) } });
  }),
);

/** GET /conversations/:id/messages — cursor-paginated, newest first. */
chatRouter.get(
  '/:id/messages',
  requireAuth,
  validate({ params: objectIdParam, query: messagesSchema }),
  asyncHandler(async (req, res) => {
    const query = validatedQuery<z.infer<typeof messagesSchema>>(req);
    const result = await service.getMessages(req.params.id as string, currentUserId(req), query);
    res.json({ data: result });
  }),
);

/** POST /conversations/:id/messages */
chatRouter.post(
  '/:id/messages',
  requireAuth,
  writeLimiter,
  validate({ params: objectIdParam, body: sendMessageSchema }),
  asyncHandler(async (req, res) => {
    const message = await service.sendMessage(
      req.params.id as string,
      currentUserId(req),
      req.body,
    );
    res.status(201).json({ data: message });
  }),
);

/** POST /conversations/:id/read */
chatRouter.post(
  '/:id/read',
  requireAuth,
  validate({ params: objectIdParam }),
  asyncHandler(async (req, res) => {
    const count = await service.markConversationRead(req.params.id as string, currentUserId(req));
    res.json({ data: { markedRead: count } });
  }),
);

/** DELETE /conversations/messages/:id — soft-delete your own message. */
chatRouter.delete(
  '/messages/:id',
  requireAuth,
  validate({ params: objectIdParam }),
  asyncHandler(async (req, res) => {
    await service.deleteMessage(req.params.id as string, currentUserId(req));
    res.status(204).send();
  }),
);
