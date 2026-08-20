import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

export interface IConversation {
  participants: Types.ObjectId[];
  pairKey: string;
  connection?: Types.ObjectId;
  lastMessage?: Types.ObjectId;
  lastMessageAt?: Date;
  lastMessagePreview?: string;
  /** userId -> unread count. A Map keeps this O(1) to bump without loading messages. */
  unread: Map<string, number>;
  createdAt: Date;
  updatedAt: Date;
}

export type ConversationDoc = HydratedDocument<IConversation>;

const conversationSchema = new Schema<IConversation>(
  {
    participants: {
      type: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      required: true,
      validate: {
        validator: (v: Types.ObjectId[]) => v.length === 2,
        message: 'a conversation has exactly two participants',
      },
    },
    pairKey: { type: String, required: true, unique: true },
    connection: { type: Schema.Types.ObjectId, ref: 'Connection' },
    lastMessage: { type: Schema.Types.ObjectId, ref: 'Message' },
    lastMessageAt: { type: Date, index: true },
    lastMessagePreview: { type: String, maxlength: 200 },
    unread: { type: Map, of: Number, default: () => new Map<string, number>() },
  },
  { timestamps: true },
);

conversationSchema.index({ participants: 1, lastMessageAt: -1 });

export const Conversation = model<IConversation>('Conversation', conversationSchema);
