import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

export interface IRefreshToken {
  user: Types.ObjectId;
  /** SHA-256 of the token. A database leak must not yield usable tokens. */
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date;
  /** Set when this token was rotated, so reuse of an old token is detectable. */
  replacedByHash?: string;
  userAgent?: string;
  ip?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type RefreshTokenDoc = HydratedDocument<IRefreshToken>;

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
    replacedByHash: { type: String },
    userAgent: { type: String, maxlength: 300 },
    ip: { type: String, maxlength: 64 },
  },
  { timestamps: true },
);

// Mongo reaps expired sessions on its own; no cleanup job needed.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = model<IRefreshToken>('RefreshToken', refreshTokenSchema);
