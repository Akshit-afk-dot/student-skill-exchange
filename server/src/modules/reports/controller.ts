import { Router } from 'express';
import { z } from 'zod';
import { currentUserId, requireAuth, validate, validatedQuery, writeLimiter } from '../../middleware';
import { REPORT_REASONS } from '../../types/domain';
import { asyncHandler } from '../../utils/async';
import * as service from './service';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

const createReportSchema = z.object({
  reportedUserId: objectId,
  reason: z.enum(REPORT_REASONS),
  description: z.string().trim().max(1000).optional(),
  relatedMessageId: objectId.optional(),
  relatedSessionId: objectId.optional(),
  relatedReviewId: objectId.optional(),
});

const listSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const reportsRouter = Router();

/** POST /reports — file a safety report. */
reportsRouter.post(
  '/',
  requireAuth,
  writeLimiter,
  validate({ body: createReportSchema }),
  asyncHandler(async (req, res) => {
    const report = await service.createReport(currentUserId(req), req.body);
    res.status(201).json({
      data: {
        report,
        message: 'Thanks for flagging this. Our moderators will review it shortly.',
      },
    });
  }),
);

/** GET /reports/mine — the caller's own filed reports and their outcomes. */
reportsRouter.get(
  '/mine',
  requireAuth,
  validate({ query: listSchema }),
  asyncHandler(async (req, res) => {
    const { page, limit } = validatedQuery<z.infer<typeof listSchema>>(req);
    res.json({ data: await service.listMine(currentUserId(req), page, limit) });
  }),
);
