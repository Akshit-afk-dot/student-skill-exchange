import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

/**
 * One student blocking another. Directional: the blocker chose it, but its effects are
 * symmetric — neither can find, request or message the other while it stands.
 */
export interface IBlock {
  blocker: Types.ObjectId;
  blocked: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type BlockDoc = HydratedDocument<IBlock>;

const blockSchema = new Schema<IBlock>(
  {
    blocker: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    blocked: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true },
);

// Blocking twice is a no-op rather than a second row.
blockSchema.index({ blocker: 1, blocked: 1 }, { unique: true });

export const Block = model<IBlock>('Block', blockSchema);
