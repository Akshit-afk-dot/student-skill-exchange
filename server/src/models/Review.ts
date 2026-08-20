import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

export interface IReview {
  session: Types.ObjectId;
  reviewer: Types.ObjectId;
  reviewee: Types.ObjectId;
  skill: Types.ObjectId;
  rating: number;
  comment?: string;
  /** Set by moderation; hidden reviews stop counting toward the reviewee's average. */
  hidden: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type ReviewDoc = HydratedDocument<IReview>;

const reviewSchema = new Schema<IReview>(
  {
    session: { type: Schema.Types.ObjectId, ref: 'Session', required: true, index: true },
    reviewer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reviewee: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    skill: { type: Schema.Types.ObjectId, ref: 'Skill', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, maxlength: 1000, trim: true },
    hidden: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// One review per person per session — the guard against rating inflation.
reviewSchema.index({ session: 1, reviewer: 1 }, { unique: true });
reviewSchema.index({ reviewee: 1, hidden: 1, createdAt: -1 });

export const Review = model<IReview>('Review', reviewSchema);
