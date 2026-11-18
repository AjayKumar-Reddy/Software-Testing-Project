import { Schema, model } from "mongoose";

const auditLogSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", default: null },
    userName: { type: String, default: "System" },
    role: { type: String, default: "system" },
    action: { type: String, required: true }, // e.g. LOGIN, CREATE, UPDATE, DELETE, APPROVE
    module: { type: String, required: true }, // e.g. auth, faculty, leave
    recordId: { type: String, default: null },
    description: { type: String, default: "" },
    ip: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ module: 1, action: 1 });

export const AuditLog = model("AuditLog", auditLogSchema);
