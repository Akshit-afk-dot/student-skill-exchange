import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { REQUEST_STATUSES, type RequestStatus } from '../types/domain';

export interface ILearningRequest {
  sender: Types.ObjectId;
  receiver: Types.ObjectId;
  /** The skill the sender wants to learn from the receiver. */
  skill: Types.ObjectId;
  /** Optional skill the sender offers back, which is what makes an exchange two-way. */
  offeredSkill?: Types.ObjectId;
  message: string;
  status: RequestStatus;
  respondedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type LearningRequestDoc = HydratedDocument<ILearningRequest>;

const learningRequestSchema = new Schema<ILearningRequest>(
  {
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    receiver: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    skill: { type: Schema.Types.ObjectId, ref: 'Skill', required: true },
    offeredSkill: { type: Schema.Types.ObjectId, ref: 'Skill' },
    message: { type: String, required: true, trim: true, maxlength: 1000 },
    status: { type: String, enum: REQUEST_STATUSES, default: 'PENDING', index: true },
    respondedAt: { type: Date },
  },
  { timestamps: true },
);

// A partial unique index blocks a second *pending* request for the same skill while one
// is outstanding, without blocking a fresh request after a rejection.
learningRequestSchema.index(
  { sender: 1, receiver: 1, skill: 1 },
  { unique: true, partialFilterExpression: { status: 'PENDING' } },
);
learningRequestSchema.index({ receiver: 1, status: 1, createdAt: -1 });
learningRequestSchema.index({ sender: 1, status: 1, createdAt: -1 });

export const LearningRequest = model<ILearningRequest>('LearningRequest', learningRequestSchema);
