import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

export interface IConnection {
  participants: Types.ObjectId[];
  /** "<smallerId>_<largerId>" — a direction-independent uniqueness key. */
  pairKey: string;
  originRequest?: Types.ObjectId;
  conversation?: Types.ObjectId;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type ConnectionDoc = HydratedDocument<IConnection>;

const connectionSchema = new Schema<IConnection>(
  {
    participants: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      required: true,
      validate: {
        validator: (v: Types.ObjectId[]) => v.length === 2,
        message: 'a connection has exactly two participants',
      },
    },
    pairKey: { type: String, required: true, unique: true },
    originRequest: { type: Schema.Types.ObjectId, ref: 'LearningRequest' },
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// Multikey index: "list my connections". Note this is deliberately NOT unique —
// a unique index on an array field would cap every user at one connection.
connectionSchema.index({ participants: 1, active: 1 });

export const Connection = model<IConnection>('Connection', connectionSchema);

/**
 * Order-independent key for a pair of users, so (A,B) and (B,A) collide on the
 * unique index instead of creating two connections.
 */
export function pairKeyOf(a: Types.ObjectId | string, b: Types.ObjectId | string): string {
  const [x, y] = [String(a), String(b)].sort();
  return `${x}_${y}`;
}
