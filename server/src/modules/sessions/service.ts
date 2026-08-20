import { Types } from 'mongoose';
import {
  Connection,
  Session,
  Skill,
  User,
  pairKeyOf,
  type SessionDoc,
} from '../../models';
import { RT, emitToUser } from '../../realtime/bus';
import { POINTS, type SessionMode, type SessionStatus } from '../../types/domain';
import { ApiError } from '../../utils/errors';
import { paginate, type Paginated } from '../../utils/pagination';
import { awardPoints, evaluateBadges, touchStreak } from '../gamification/service';
import { notify } from '../notifications/service';

export interface CreateSessionInput {
  /** The other participant. The caller's role determines who teaches. */
  partnerId: string;
  role: 'TEACHER' | 'LEARNER';
  skillId: string;
  scheduledAt: Date;
  durationMinutes: number;
  mode: SessionMode;
  meetingLink?: string;
  location?: string;
  notes?: string;
}

const POPULATE = [
  { path: 'teacher', select: 'name profileImage college isOnline' },
  { path: 'learner', select: 'name profileImage college isOnline' },
  { path: 'skill', select: 'name' },
];

function assertParticipant(session: SessionDoc, userId: string): void {
  const isParticipant =
    String(session.teacher) === userId || String(session.learner) === userId;
  if (!isParticipant) throw ApiError.forbidden('You are not part of this session');
}

async function loadSession(sessionId: string): Promise<SessionDoc> {
  if (!Types.ObjectId.isValid(sessionId)) throw ApiError.badRequest('Invalid session id');
  const session = await Session.findById(sessionId);
  if (!session) throw ApiError.notFound('Session not found');
  return session;
}

/**
 * Detects a clash with another live session for either participant.
 *
 * Two sessions overlap when each starts before the other ends. Expressed against stored
 * fields that is: existing.scheduledAt < newEnd AND existing end > newStart, where the
 * existing end is computed from its own duration.
 */
async function assertNoClash(
  participantIds: Types.ObjectId[],
  startsAt: Date,
  durationMinutes: number,
  excludeSessionId?: Types.ObjectId,
): Promise<void> {
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);

  const filter: Record<string, unknown> = {
    status: { $in: ['SCHEDULED', 'CONFIRMED'] },
    $or: [{ teacher: { $in: participantIds } }, { learner: { $in: participantIds } }],
    scheduledAt: { $lt: endsAt },
    $expr: {
      $gt: [
        { $add: ['$scheduledAt', { $multiply: ['$durationMinutes', 60_000] }] },
        startsAt,
      ],
    },
  };
  if (excludeSessionId) filter._id = { $ne: excludeSessionId };

  const clash = await Session.findOne(filter).select('scheduledAt durationMinutes').lean();
  if (clash) {
    throw ApiError.conflict('That time clashes with another session already on the calendar', {
      clashingSessionAt: clash.scheduledAt,
    });
  }
}

export async function createSession(
  userId: string,
  input: CreateSessionInput,
): Promise<SessionDoc> {
  if (userId === input.partnerId) {
    throw ApiError.badRequest('A session needs two different students');
  }
  if (input.scheduledAt.getTime() <= Date.now()) {
    throw ApiError.badRequest('Sessions must be scheduled in the future');
  }

  // Scheduling is gated on an accepted request, same as chat.
  const connected = await Connection.exists({
    pairKey: pairKeyOf(userId, input.partnerId),
    active: true,
  });
  if (!connected) {
    throw ApiError.forbidden('You can only schedule sessions with students you are connected to');
  }

  const skill = await Skill.findById(input.skillId).select('name').lean();
  if (!skill) throw ApiError.notFound('Skill not found');

  if (input.mode === 'ONLINE' && !input.meetingLink) {
    throw ApiError.badRequest('An online session needs a meeting link');
  }
  if (input.mode === 'OFFLINE' && !input.location) {
    throw ApiError.badRequest('An in-person session needs a location');
  }

  const teacher = new Types.ObjectId(input.role === 'TEACHER' ? userId : input.partnerId);
  const learner = new Types.ObjectId(input.role === 'TEACHER' ? input.partnerId : userId);

  await assertNoClash([teacher, learner], input.scheduledAt, input.durationMinutes);

  const session = await Session.create({
    teacher,
    learner,
    skill: skill._id,
    scheduledAt: input.scheduledAt,
    durationMinutes: input.durationMinutes,
    mode: input.mode,
    meetingLink: input.meetingLink,
    location: input.location,
    notes: input.notes,
    status: 'SCHEDULED',
    createdBy: userId,
  });

  const partnerId = String(input.role === 'TEACHER' ? learner : teacher);
  const creator = await User.findById(userId).select('name').lean();
  await notify({
    user: partnerId,
    type: 'SESSION_SCHEDULED',
    title: 'New session scheduled',
    body: `${creator?.name ?? 'A student'} scheduled a ${skill.name} session for ${input.scheduledAt.toUTCString()}`,
    data: { sessionId: String(session._id), screen: 'SessionDetails' },
  });
  emitToUser(partnerId, RT.SESSION_UPDATED, { sessionId: String(session._id) });

  return session.populate(POPULATE);
}

export interface ListSessionsInput {
  status?: SessionStatus;
  /** Filters relative to now, for the "Upcoming" and "Past" tabs. */
  when?: 'upcoming' | 'past';
  role?: 'teacher' | 'learner';
  from?: Date;
  to?: Date;
  page: number;
  limit: number;
}

export async function listSessions(
  userId: string,
  input: ListSessionsInput,
): Promise<Paginated<unknown>> {
  const uid = new Types.ObjectId(userId);
  const filter: Record<string, unknown> = {};

  if (input.role === 'teacher') filter.teacher = uid;
  else if (input.role === 'learner') filter.learner = uid;
  else filter.$or = [{ teacher: uid }, { learner: uid }];

  if (input.status) filter.status = input.status;

  const range: Record<string, Date> = {};
  if (input.from) range.$gte = input.from;
  if (input.to) range.$lte = input.to;
  if (input.when === 'upcoming') range.$gte = range.$gte ?? new Date();
  if (input.when === 'past') range.$lt = new Date();
  if (Object.keys(range).length > 0) filter.scheduledAt = range;

  const skip = (input.page - 1) * input.limit;
  const [items, total] = await Promise.all([
    Session.find(filter)
      .populate(POPULATE)
      // Upcoming reads best soonest-first; history reads best newest-first.
      .sort({ scheduledAt: input.when === 'past' ? -1 : 1 })
      .skip(skip)
      .limit(input.limit)
      .lean(),
    Session.countDocuments(filter),
  ]);

  return paginate(items, total, input);
}

export async function getSession(sessionId: string, userId: string) {
  const session = await loadSession(sessionId);
  assertParticipant(session, userId);
  return session.populate(POPULATE);
}

export async function updateSession(
  sessionId: string,
  userId: string,
  patch: Partial<Pick<CreateSessionInput, 'scheduledAt' | 'durationMinutes' | 'mode' | 'meetingLink' | 'location' | 'notes'>>,
) {
  const session = await loadSession(sessionId);
  assertParticipant(session, userId);

  if (session.status === 'COMPLETED' || session.status === 'CANCELLED') {
    throw ApiError.conflict(`A ${session.status.toLowerCase()} session cannot be changed`);
  }

  const nextStart = patch.scheduledAt ?? session.scheduledAt;
  const nextDuration = patch.durationMinutes ?? session.durationMinutes;

  if (patch.scheduledAt && patch.scheduledAt.getTime() <= Date.now()) {
    throw ApiError.badRequest('Sessions must be scheduled in the future');
  }
  if (patch.scheduledAt || patch.durationMinutes) {
    await assertNoClash([session.teacher, session.learner], nextStart, nextDuration, session._id);
  }

  if (patch.scheduledAt) session.scheduledAt = patch.scheduledAt;
  if (patch.durationMinutes) session.durationMinutes = patch.durationMinutes;
  if (patch.mode) session.mode = patch.mode;
  if (patch.meetingLink !== undefined) session.meetingLink = patch.meetingLink;
  if (patch.location !== undefined) session.location = patch.location;
  if (patch.notes !== undefined) session.notes = patch.notes;

  // A reschedule invalidates the previous confirmation and any reminder already sent.
  if (patch.scheduledAt) {
    session.status = 'SCHEDULED';
    session.reminderSentAt = undefined;
  }

  await session.save();

  const otherId = String(session.teacher) === userId ? session.learner : session.teacher;
  await notify({
    user: otherId,
    type: 'SESSION_SCHEDULED',
    title: 'Session updated',
    body: 'A session on your calendar was changed. Check the new details.',
    data: { sessionId: String(session._id), screen: 'SessionDetails' },
  });
  emitToUser(String(otherId), RT.SESSION_UPDATED, { sessionId: String(session._id) });

  return session.populate(POPULATE);
}

export async function confirmSession(sessionId: string, userId: string) {
  const session = await loadSession(sessionId);
  assertParticipant(session, userId);

  if (session.status !== 'SCHEDULED') {
    throw ApiError.conflict(`Only a scheduled session can be confirmed (this one is ${session.status})`);
  }
  session.status = 'CONFIRMED';
  await session.save();

  const otherId = String(session.teacher) === userId ? session.learner : session.teacher;
  emitToUser(String(otherId), RT.SESSION_UPDATED, { sessionId: String(session._id) });

  return session.populate(POPULATE);
}

export async function cancelSession(sessionId: string, userId: string, reason?: string) {
  const session = await loadSession(sessionId);
  assertParticipant(session, userId);

  if (session.status === 'COMPLETED') throw ApiError.conflict('A completed session cannot be cancelled');
  if (session.status === 'CANCELLED') return session.populate(POPULATE);

  session.status = 'CANCELLED';
  session.cancelledBy = new Types.ObjectId(userId);
  if (reason) session.cancelReason = reason;
  await session.save();

  const otherId = String(session.teacher) === userId ? session.learner : session.teacher;
  const canceller = await User.findById(userId).select('name').lean();
  await notify({
    user: otherId,
    type: 'SESSION_CANCELLED',
    title: 'Session cancelled',
    body: `${canceller?.name ?? 'A student'} cancelled your session${reason ? `: ${reason}` : ''}`,
    data: { sessionId: String(session._id), screen: 'MySessions' },
  });
  emitToUser(String(otherId), RT.SESSION_UPDATED, { sessionId: String(session._id) });

  return session.populate(POPULATE);
}

export interface CompleteResult {
  session: SessionDoc;
  /** True once both sides have marked it done and the stats were applied. */
  fullyCompleted: boolean;
}

/**
 * Marks the session complete for the calling participant.
 *
 * Both students must confirm before the session counts. A single-sided "done" would let
 * anyone inflate their own teaching hours and unlock reviews the other person never
 * agreed happened.
 */
export async function completeSession(
  sessionId: string,
  userId: string,
): Promise<CompleteResult> {
  const session = await loadSession(sessionId);
  assertParticipant(session, userId);

  if (session.status === 'CANCELLED') throw ApiError.conflict('This session was cancelled');
  if (session.scheduledAt.getTime() > Date.now()) {
    throw ApiError.badRequest('A session cannot be completed before it starts');
  }
  if (session.status === 'COMPLETED') return { session, fullyCompleted: true };

  const already = session.completedBy.some((id) => String(id) === userId);
  // Re-confirming is a no-op rather than a second nudge to the other student.
  if (already) return { session, fullyCompleted: false };

  session.completedBy.push(new Types.ObjectId(userId));

  const bothConfirmed = session.completedBy.length >= 2;
  if (!bothConfirmed) {
    await session.save();
    const otherId = String(session.teacher) === userId ? session.learner : session.teacher;
    await notify({
      user: otherId,
      type: 'SESSION_COMPLETED',
      title: 'Confirm your session',
      body: 'Your partner marked a session as done. Confirm it to unlock ratings.',
      data: { sessionId: String(session._id), screen: 'SessionDetails' },
    });
    return { session, fullyCompleted: false };
  }

  session.status = 'COMPLETED';
  session.completedAt = new Date();
  await session.save();

  await applyCompletionRewards(session);

  for (const participant of [session.teacher, session.learner]) {
    emitToUser(String(participant), RT.SESSION_UPDATED, {
      sessionId: String(session._id),
      status: 'COMPLETED',
    });
  }

  return { session, fullyCompleted: true };
}

/** Stats, points, streaks and badges applied once, when a session fully completes. */
async function applyCompletionRewards(session: SessionDoc): Promise<void> {
  const minutes = session.durationMinutes;

  await Promise.all([
    User.updateOne(
      { _id: session.teacher },
      {
        $inc: {
          'stats.sessionsTaught': 1,
          'stats.minutesTaught': minutes,
          'stats.points': POINTS.SESSION_TAUGHT,
        },
      },
    ),
    User.updateOne(
      { _id: session.learner },
      {
        $inc: {
          'stats.sessionsLearned': 1,
          'stats.minutesLearned': minutes,
          'stats.points': POINTS.SESSION_LEARNED,
        },
      },
    ),
  ]);

  await Promise.all([touchStreak(session.teacher), touchStreak(session.learner)]);
  await Promise.all([evaluateBadges(session.teacher), evaluateBadges(session.learner)]);

  await Promise.all([
    notify({
      user: session.teacher,
      type: 'SESSION_COMPLETED',
      title: 'Session complete',
      body: `You earned ${POINTS.SESSION_TAUGHT} points for teaching. Leave a rating for your student.`,
      data: { sessionId: String(session._id), screen: 'Reviews' },
    }),
    notify({
      user: session.learner,
      type: 'SESSION_COMPLETED',
      title: 'Session complete',
      body: `You earned ${POINTS.SESSION_LEARNED} points. Leave a rating for your teacher.`,
      data: { sessionId: String(session._id), screen: 'Reviews' },
    }),
  ]);
}

export interface CalendarEntry {
  id: string;
  title: string;
  scheduledAt: string;
  endsAt: string;
  durationMinutes: number;
  status: SessionStatus;
  mode: SessionMode;
  role: 'teacher' | 'learner';
  partner: { id: string; name: string; profileImage?: string };
}

/** Calendar feed for a date window. */
export async function calendar(userId: string, from: Date, to: Date): Promise<CalendarEntry[]> {
  const uid = new Types.ObjectId(userId);
  const rows = await Session.find({
    $or: [{ teacher: uid }, { learner: uid }],
    scheduledAt: { $gte: from, $lte: to },
  })
    .populate<{ teacher: { _id: Types.ObjectId; name: string; profileImage?: string } }>(
      'teacher',
      'name profileImage',
    )
    .populate<{ learner: { _id: Types.ObjectId; name: string; profileImage?: string } }>(
      'learner',
      'name profileImage',
    )
    .populate<{ skill: { name: string } }>('skill', 'name')
    .sort({ scheduledAt: 1 })
    .lean();

  return rows.map((row) => {
    const isTeacher = String(row.teacher._id) === userId;
    const partner = isTeacher ? row.learner : row.teacher;
    const entry: CalendarEntry = {
      id: String(row._id),
      title: `${row.skill?.name ?? 'Session'} with ${partner.name}`,
      scheduledAt: new Date(row.scheduledAt).toISOString(),
      endsAt: new Date(
        new Date(row.scheduledAt).getTime() + row.durationMinutes * 60_000,
      ).toISOString(),
      durationMinutes: row.durationMinutes,
      status: row.status,
      mode: row.mode,
      role: isTeacher ? 'teacher' : 'learner',
      partner: { id: String(partner._id), name: partner.name },
    };
    if (partner.profileImage) entry.partner.profileImage = partner.profileImage;
    return entry;
  });
}
