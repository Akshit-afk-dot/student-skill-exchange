import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { NOTIFICATION_TYPES, type NotificationType } from '../types/domain';

export interface INotification {
  user: Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  /** Deep-link payload consumed by the mobile app, e.g. { screen, id }. */
  data: Record<string, string>;
  read: boolean;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type NotificationDoc = HydratedDocument<INotification>;

const notificationSchema = new Schema<INotification>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true, maxlength: 140 },
    body: { type: String, required: true, maxlength: 500 },
    data: { type: Object, default: {} },
    read: { type: Boolean, default: false },
    readAt: { type: Date },
  },
  { timestamps: true },
);

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });
// The notification centre is a rolling feed, not an archive: expire after 90 days
// so the collection cannot grow without bound.
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

export const Notification = model<INotification>('Notification', notificationSchema);
