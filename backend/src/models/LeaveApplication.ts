import { Schema, model } from "mongoose";
import { LEAVE_STATUSES, LEAVE_TYPES } from "./constants";

const leaveSchema = new Schema(
  {
    faculty: { type: Schema.Types.ObjectId, ref: "Faculty", required: true, index: true },
    department: { type: Schema.Types.ObjectId, ref: "Department", required: true, index: true },
    leaveType: { type: String, enum: LEAVE_TYPES, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    days: { type: Number, required: true, min: 0 }, // working days in range
    reason: { type: String, required: true, trim: true, maxlength: 1000 },
    document: { type: String, default: "" }, // stored filename
    documentName: { type: String, default: "" },
    status: { type: String, enum: LEAVE_STATUSES, default: "pending", index: true },
    academicYear: { type: String, required: true },
    appliedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    reviewRemarks: { type: String, trim: true, default: "" },
    cancelledAt: { type: Date },
  },
  { timestamps: true },
);

leaveSchema.index({ faculty: 1, startDate: 1, endDate: 1 });

export const LeaveApplication = model("LeaveApplication", leaveSchema);
