import { Router } from 'express';
import { z } from 'zod';
import { currentUserId, requireAdmin, validate, validatedQuery } from '../../middleware';
import {
  MODERATION_ACTIONS,
  REPORT_STATUSES,
  USER_STATUSES,
} from '../../types/domain';
import { asyncHandler } from '../../utils/async';
import { objectIdParam } from '../users/validators';
import * as service from './service';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

const listUsersSchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: z.enum(USER_STATUSES).optional(),
  college: z.string().trim().max(140).optional(),
  sort: z.enum(['recent', 'points', 'rating', 'name']).default('recent'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

const moderateUserSchema = z.object({
  status: z.enum(USER_STATUSES),
  suspendDays: z.coerce.number().int().min(1).max(365).optional(),
  reason: z.string().trim().max(500).optional(),
});

const listReportsSchema = z.object({
  status: z.enum(REPORT_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

const resolveReportSchema = z.object({
  action: z.enum(MODERATION_ACTIONS),
  resolutionNote: z.string().trim().max(1000).optional(),
  suspendDays: z.coerce.number().int().min(1).max(365).optional(),
  dismiss: z.boolean().default(false),
});

const createSkillSchema = z.object({
  name: z.string().trim().min(2).max(80),
  categoryId: objectId,
  description: z.string().trim().max(500).optional(),
  aliases: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
});

const mergeSkillsSchema = z.object({ sourceId: objectId, targetId: objectId });

const hideReviewSchema = z.object({ hidden: z.boolean() });

const pageSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const adminRouter = Router();

// Every route below requires an authenticated ADMIN.
adminRouter.use(requireAdmin);

/** GET /admin/stats — the dashboard payload. */
adminRouter.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    res.json({ data: await service.dashboardStats() });
  }),
);

/** GET /admin/users */
adminRouter.get(
  '/users',
  validate({ query: listUsersSchema }),
  asyncHandler(async (req, res) => {
    const query = validatedQuery<z.infer<typeof listUsersSchema>>(req);
    res.json({ data: await service.listUsers(query) });
  }),
);

/** POST /admin/users/:id/moderate — suspend, ban or reinstate. */
adminRouter.post(
  '/users/:id/moderate',
  validate({ params: objectIdParam, body: moderateUserSchema }),
  asyncHandler(async (req, res) => {
    const user = await service.moderateUser(
      currentUserId(req),
      req.params.id as string,
      req.body,
      req.ip,
    );
    res.json({ data: user });
  }),
);

/** GET /admin/reports — the moderation queue, oldest first. */
adminRouter.get(
  '/reports',
  validate({ query: listReportsSchema }),
  asyncHandler(async (req, res) => {
    const { status, page, limit } = validatedQuery<z.infer<typeof listReportsSchema>>(req);
    res.json({ data: await service.listReports(status, page, limit) });
  }),
);

/** POST /admin/reports/:id/claim — take ownership before investigating. */
adminRouter.post(
  '/reports/:id/claim',
  validate({ params: objectIdParam }),
  asyncHandler(async (req, res) => {
    res.json({ data: await service.claimReport(currentUserId(req), req.params.id as string) });
  }),
);

/** POST /admin/reports/:id/resolve */
adminRouter.post(
  '/reports/:id/resolve',
  validate({ params: objectIdParam, body: resolveReportSchema }),
  asyncHandler(async (req, res) => {
    const report = await service.resolveReport(
      currentUserId(req),
      req.params.id as string,
      req.body,
      req.ip,
    );
    res.json({ data: report });
  }),
);

/** POST /admin/reviews/:id/visibility — hide or restore a review. */
adminRouter.post(
  '/reviews/:id/visibility',
  validate({ params: objectIdParam, body: hideReviewSchema }),
  asyncHandler(async (req, res) => {
    const review = await service.setReviewHidden(
      currentUserId(req),
      req.params.id as string,
      req.body.hidden,
      req.ip,
    );
    res.json({ data: review });
  }),
);

/** POST /admin/skills — add a curated skill to the catalogue. */
adminRouter.post(
  '/skills',
  validate({ body: createSkillSchema }),
  asyncHandler(async (req, res) => {
    const skill = await service.createSkill(currentUserId(req), req.body, req.ip);
    res.status(201).json({ data: skill });
  }),
);

/** POST /admin/skills/:id/approve — approve a student-proposed skill. */
adminRouter.post(
  '/skills/:id/approve',
  validate({ params: objectIdParam }),
  asyncHandler(async (req, res) => {
    const skill = await service.approveSkill(currentUserId(req), req.params.id as string, req.ip);
    res.json({ data: skill });
  }),
);

/** POST /admin/skills/merge — fold a duplicate into the canonical skill. */
adminRouter.post(
  '/skills/merge',
  validate({ body: mergeSkillsSchema }),
  asyncHandler(async (req, res) => {
    const result = await service.mergeSkills(
      currentUserId(req),
      req.body.sourceId,
      req.body.targetId,
      req.ip,
    );
    res.json({ data: result });
  }),
);

/** GET /admin/audit-log */
adminRouter.get(
  '/audit-log',
  validate({ query: pageSchema }),
  asyncHandler(async (req, res) => {
    const { page, limit } = validatedQuery<z.infer<typeof pageSchema>>(req);
    res.json({ data: await service.listAuditLog(page, limit) });
  }),
);
