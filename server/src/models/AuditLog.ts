import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

export interface IAuditLog {
  actor: Types.ObjectId;
  action: string;
  targetType: string;
  targetId?: Types.ObjectId;
  meta: Record<string, unknown>;
  ip?: string;
  createdAt: Date;
}

export type AuditLogDoc = HydratedDocument<IAuditLog>;

const auditLogSchema = new Schema<IAuditLog>(
  {
    actor: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action: { type: String, required: true, index: true },
    targetType: { type: String, required: true },
    targetId: { type: Schema.Types.ObjectId },
    meta: { type: Object, default: {} },
    ip: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditLogSchema.index({ createdAt: -1 });

export const AuditLog = model<IAuditLog>('AuditLog', auditLogSchema);
