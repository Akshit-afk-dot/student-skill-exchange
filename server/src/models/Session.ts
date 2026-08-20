import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import {
  SESSION_MODES,
  SESSION_STATUSES,
  type SessionMode,
  type SessionStatus,
} from '../types/domain';

export interface ISession {
  teacher: Types.ObjectId;
  learner: Types.ObjectId;
  skill: Types.ObjectId;
  /** Absolute instant of the session start, stored in UTC. */
  scheduledAt: Date;
  durationMinutes: number;
  mode: SessionMode;
  meetingLink?: string;
  location?: string;
  notes?: string;
  status: SessionStatus;
  /** Both sides must confirm completion before ratings unlock. */
  completedBy: Types.ObjectId[];
  completedAt?: Date;
  cancelledBy?: Types.ObjectId;
  cancelReason?: string;
  reminderSentAt?: Date;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type SessionDoc = HydratedDocument<ISession>;

const sessionSchema = new Schema<ISession>(
  {
    teacher: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    learner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    skill: { type: Schema.Types.ObjectId, ref: 'Skill', required: true },
    scheduledAt: { type: Date, required: true, index: true },
    durationMinutes: { type: Number, required: true, min: 15, max: 480 },
    mode: { type: String, enum: SESSION_MODES, required: true },
    meetingLink: { type: String, maxlength: 500 },
    location: { type: String, maxlength: 300 },
    notes: { type: String, maxlength: 1000 },
    status: { type: String, enum: SESSION_STATUSES, default: 'SCHEDULED', index: true },
    completedBy: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], default: [] },
    completedAt: { type: Date },
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelReason: { type: String, maxlength: 500 },
    reminderSentAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, toJSON: { virtuals: true } },
);

sessionSchema.index({ status: 1, scheduledAt: 1 });
// Calendar view: everything for one user in a date window, regardless of role.
sessionSchema.index({ teacher: 1, scheduledAt: -1 });
sessionSchema.index({ learner: 1, scheduledAt: -1 });

/** Session end instant, derived rather than stored so the two can never disagree. */
sessionSchema.virtual('endsAt').get(function (this: ISession) {
  return new Date(this.scheduledAt.getTime() + this.durationMinutes * 60_000);
});

export const Session = model<ISession>('Session', sessionSchema);
