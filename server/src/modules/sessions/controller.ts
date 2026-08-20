import { Router } from 'express';
import { z } from 'zod';
import { currentUserId, requireAuth, validate, validatedQuery, writeLimiter } from '../../middleware';
import { SESSION_MODES, SESSION_STATUSES } from '../../types/domain';
import { asyncHandler } from '../../utils/async';
import { objectIdParam } from '../users/validators';
import * as service from './service';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');
/** ISO-8601 datetime, coerced to a Date so handlers never juggle strings. */
const isoDate = z.coerce.date();

const createSessionSchema = z.object({
  partnerId: objectId,
  role: z.enum(['TEACHER', 'LEARNER']),
  skillId: objectId,
  scheduledAt: isoDate,
  durationMinutes: z.coerce.number().int().min(15).max(480),
  mode: z.enum(SESSION_MODES),
  meetingLink: z.url('Enter a valid meeting link').max(500).optional(),
  location: z.string().trim().max(300).optional(),
  notes: z.string().trim().max(1000).optional(),
});

const updateSessionSchema = z
  .object({
    scheduledAt: isoDate.optional(),
    durationMinutes: z.coerce.number().int().min(15).max(480).optional(),
    mode: z.enum(SESSION_MODES).optional(),
    meetingLink: z.url().max(500).optional(),
    location: z.string().trim().max(300).optional(),
    notes: z.string().trim().max(1000).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to update' });

const listSessionsSchema = z.object({
  status: z.enum(SESSION_STATUSES).optional(),
  when: z.enum(['upcoming', 'past']).optional(),
  role: z.enum(['teacher', 'learner']).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const calendarSchema = z
  .object({ from: isoDate, to: isoDate })
  .refine((v) => v.to > v.from, { message: '"to" must be after "from"', path: ['to'] })
  .refine((v) => v.to.getTime() - v.from.getTime() <= 366 * 86_400_000, {
    message: 'Calendar window cannot exceed one year',
    path: ['to'],
  });

const cancelSchema = z.object({ reason: z.string().trim().max(500).optional() });

export const sessionsRouter = Router();

/** POST /sessions — schedule a session with a connected student. */
sessionsRouter.post(
  '/',
  requireAuth,
  writeLimiter,
  validate({ body: createSessionSchema }),
  asyncHandler(async (req, res) => {
    const session = await service.createSession(currentUserId(req), req.body);
    res.status(201).json({ data: session });
  }),
);

/** GET /sessions */
sessionsRouter.get(
  '/',
  requireAuth,
  validate({ query: listSessionsSchema }),
  asyncHandler(async (req, res) => {
    const query = validatedQuery<z.infer<typeof listSessionsSchema>>(req);
    res.json({ data: await service.listSessions(currentUserId(req), query) });
  }),
);

/** GET /sessions/calendar?from=&to= */
sessionsRouter.get(
  '/calendar',
  requireAuth,
  validate({ query: calendarSchema }),
  asyncHandler(async (req, res) => {
    const { from, to } = validatedQuery<z.infer<typeof calendarSchema>>(req);
    res.json({ data: await service.calendar(currentUserId(req), from, to) });
  }),
);

/** GET /sessions/:id */
sessionsRouter.get(
  '/:id',
  requireAuth,
  validate({ params: objectIdParam }),
  asyncHandler(async (req, res) => {
    res.json({ data: await service.getSession(req.params.id as string, currentUserId(req)) });
  }),
);

/** PATCH /sessions/:id — reschedule or edit details. */
sessionsRouter.patch(
  '/:id',
  requireAuth,
  writeLimiter,
  validate({ params: objectIdParam, body: updateSessionSchema }),
  asyncHandler(async (req, res) => {
    const session = await service.updateSession(
      req.params.id as string,
      currentUserId(req),
      req.body,
    );
    res.json({ data: session });
  }),
);

/** POST /sessions/:id/confirm */
sessionsRouter.post(
  '/:id/confirm',
  requireAuth,
  validate({ params: objectIdParam }),
  asyncHandler(async (req, res) => {
    res.json({ data: await service.confirmSession(req.params.id as string, currentUserId(req)) });
  }),
);

/** POST /sessions/:id/cancel */
sessionsRouter.post(
  '/:id/cancel',
  requireAuth,
  writeLimiter,
  validate({ params: objectIdParam, body: cancelSchema }),
  asyncHandler(async (req, res) => {
    const session = await service.cancelSession(
      req.params.id as string,
      currentUserId(req),
      req.body.reason,
    );
    res.json({ data: session });
  }),
);

/** POST /sessions/:id/complete — both participants must call this. */
sessionsRouter.post(
  '/:id/complete',
  requireAuth,
  validate({ params: objectIdParam }),
  asyncHandler(async (req, res) => {
    const result = await service.completeSession(req.params.id as string, currentUserId(req));
    res.json({
      data: {
        session: result.session,
        fullyCompleted: result.fullyCompleted,
        message: result.fullyCompleted
          ? 'Session complete. You can now leave a rating.'
          : 'Marked done. Waiting for the other student to confirm.',
      },
    });
  }),
);
