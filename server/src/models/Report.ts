import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import {
  MODERATION_ACTIONS,
  REPORT_REASONS,
  REPORT_STATUSES,
  type ModerationAction,
  type ReportReason,
  type ReportStatus,
} from '../types/domain';

export interface IReport {
  reporter: Types.ObjectId;
  reportedUser: Types.ObjectId;
  reason: ReportReason;
  description?: string;
  /** Optional evidence pointers. */
  relatedMessage?: Types.ObjectId;
  relatedSession?: Types.ObjectId;
  relatedReview?: Types.ObjectId;
  status: ReportStatus;
  actionTaken: ModerationAction;
  resolutionNote?: string;
  handledBy?: Types.ObjectId;
  handledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type ReportDoc = HydratedDocument<IReport>;

const reportSchema = new Schema<IReport>(
  {
    reporter: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reportedUser: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reason: { type: String, enum: REPORT_REASONS, required: true },
    description: { type: String, maxlength: 1000 },
    relatedMessage: { type: Schema.Types.ObjectId, ref: 'Message' },
    relatedSession: { type: Schema.Types.ObjectId, ref: 'Session' },
    relatedReview: { type: Schema.Types.ObjectId, ref: 'Review' },
    status: { type: String, enum: REPORT_STATUSES, default: 'OPEN', index: true },
    actionTaken: { type: String, enum: MODERATION_ACTIONS, default: 'NONE' },
    resolutionNote: { type: String, maxlength: 1000 },
    handledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    handledAt: { type: Date },
  },
  { timestamps: true },
);

reportSchema.index({ status: 1, createdAt: -1 });
// Rate-limits duplicate reporting: one open report per reporter/target pair.
reportSchema.index(
  { reporter: 1, reportedUser: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['OPEN', 'REVIEWING'] } } },
);

export const Report = model<IReport>('Report', reportSchema);
