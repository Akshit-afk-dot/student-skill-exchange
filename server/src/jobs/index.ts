import cron, { type ScheduledTask } from 'node-cron';
import { logger } from '../config/logger';
import { LearningRequest, Session, User } from '../models';
import { notify } from '../modules/notifications/service';

const tasks: ScheduledTask[] = [];

/**
 * Reminds both participants about sessions starting in the next hour.
 *
 * `reminderSentAt` is set on the same document that is matched as unset, so a reminder
 * is delivered exactly once even if the job overruns and two ticks overlap.
 */
async function sendSessionReminders(): Promise<void> {
  const now = new Date();
  const inOneHour = new Date(now.getTime() + 60 * 60_000);

  const due = await Session.find({
    status: { $in: ['SCHEDULED', 'CONFIRMED'] },
    scheduledAt: { $gt: now, $lte: inOneHour },
    reminderSentAt: { $exists: false },
  })
    .populate<{ skill: { name: string } }>('skill', 'name')
    .limit(200);

  for (const session of due) {
    // Claim the reminder before sending it.
    const claimed = await Session.findOneAndUpdate(
      { _id: session._id, reminderSentAt: { $exists: false } },
      { $set: { reminderSentAt: new Date() } },
    );
    if (!claimed) continue;

    const minutes = Math.round((session.scheduledAt.getTime() - Date.now()) / 60_000);
    const body = `Your ${session.skill?.name ?? 'learning'} session starts in ${minutes} minutes.`;

    for (const participant of [session.teacher, session.learner]) {
      await notify({
        user: participant,
        type: 'SESSION_REMINDER',
        title: 'Session starting soon',
        body,
        data: { sessionId: String(session._id), screen: 'SessionDetails' },
      });
    }
  }

  if (due.length > 0) logger.info({ count: due.length }, 'Session reminders processed');
}

/**
 * Marks sessions nobody confirmed as NO_SHOW once they are well past.
 *
 * The grace period is generous: students often confirm the next day, and a session
 * wrongly marked NO_SHOW would block its reviews permanently.
 */
async function closeStaleSessions(): Promise<void> {
  const cutoff = new Date(Date.now() - 48 * 60 * 60_000);

  const result = await Session.updateMany(
    { status: { $in: ['SCHEDULED', 'CONFIRMED'] }, scheduledAt: { $lt: cutoff } },
    { $set: { status: 'NO_SHOW' } },
  );

  if (result.modifiedCount > 0) {
    logger.info({ count: result.modifiedCount }, 'Stale sessions closed as NO_SHOW');
  }
}

/** Expires learning requests nobody answered, so senders are not left waiting forever. */
async function expireOldRequests(): Promise<void> {
  const cutoff = new Date(Date.now() - 30 * 86_400_000);

  const result = await LearningRequest.updateMany(
    { status: 'PENDING', createdAt: { $lt: cutoff } },
    { $set: { status: 'EXPIRED', respondedAt: new Date() } },
  );

  if (result.modifiedCount > 0) {
    logger.info({ count: result.modifiedCount }, 'Old learning requests expired');
  }
}

/** Restores accounts whose suspension window has elapsed. */
async function liftExpiredSuspensions(): Promise<void> {
  const result = await User.updateMany(
    { status: 'SUSPENDED', suspendedUntil: { $lte: new Date() } },
    { $set: { status: 'ACTIVE' }, $unset: { suspendedUntil: '' } },
  );

  if (result.modifiedCount > 0) {
    logger.info({ count: result.modifiedCount }, 'Expired suspensions lifted');
  }
}

/** Wraps a job so one failure never kills the scheduler. */
function safely(name: string, fn: () => Promise<void>): () => void {
  return () => {
    void fn().catch((err) => logger.error({ err, job: name }, 'Scheduled job failed'));
  };
}

export function startJobs(): void {
  tasks.push(cron.schedule('*/5 * * * *', safely('session-reminders', sendSessionReminders)));
  tasks.push(cron.schedule('0 * * * *', safely('close-stale-sessions', closeStaleSessions)));
  tasks.push(cron.schedule('0 3 * * *', safely('expire-requests', expireOldRequests)));
  tasks.push(cron.schedule('*/30 * * * *', safely('lift-suspensions', liftExpiredSuspensions)));

  logger.info({ jobs: tasks.length }, 'Background jobs scheduled');
}

export async function stopJobs(): Promise<void> {
  await Promise.all(tasks.map((task) => task.stop()));
  tasks.length = 0;
}

export const __testables = {
  sendSessionReminders,
  closeStaleSessions,
  expireOldRequests,
  liftExpiredSuspensions,
};
