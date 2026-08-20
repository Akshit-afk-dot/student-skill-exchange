import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { MESSAGE_TYPES, type MessageType } from '../types/domain';

export interface IMessageAttachment {
  url: string;
  mimeType: string;
  size: number;
  name?: string;
}

export interface IMessage {
  conversation: Types.ObjectId;
  sender: Types.ObjectId;
  receiver: Types.ObjectId;
  body: string;
  type: MessageType;
  attachment?: IMessageAttachment;
  /** Set when the recipient has opened the conversation. */
  readAt?: Date;
  deliveredAt?: Date;
  /** Soft delete so moderation can remove content without breaking thread history. */
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type MessageDoc = HydratedDocument<IMessage>;

const attachmentSchema = new Schema<IMessageAttachment>(
  {
    url: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    name: { type: String },
  },
  { _id: false },
);

const messageSchema = new Schema<IMessage>(
  {
    conversation: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    receiver: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, default: '', maxlength: 4000 },
    type: { type: String, enum: MESSAGE_TYPES, default: 'TEXT' },
    attachment: { type: attachmentSchema },
    readAt: { type: Date },
    deliveredAt: { type: Date },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);

// The chat screen pages backwards through a conversation, newest first.
messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ receiver: 1, readAt: 1 });

export const Message = model<IMessage>('Message', messageSchema);
