import { Schema, model } from "mongoose";
import { ATTENDANCE_SOURCES, ATTENDANCE_STATUSES } from "./constants";

const attendanceSchema = new Schema(
  {
    faculty: { type: Schema.Types.ObjectId, ref: "Faculty", required: true },
    department: { type: Schema.Types.ObjectId, ref: "Department", required: true },
    date: { type: Date, required: true }, // UTC midnight
    checkIn: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    checkOut: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    status: { type: String, enum: ATTENDANCE_STATUSES, required: true },
    // manual = marked by admin/HOD; self = self-reported by faculty (not verified); leave = derived from approved leave
    source: { type: String, enum: ATTENDANCE_SOURCES, default: "manual" },
    leave: { type: Schema.Types.ObjectId, ref: "LeaveApplication", default: null },
    remarks: { type: String, trim: true, maxlength: 500, default: "" },
    markedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

// One record per faculty per day.
attendanceSchema.index({ faculty: 1, date: 1 }, { unique: true });
attendanceSchema.index({ date: 1, department: 1 });

export const Attendance = model("Attendance", attendanceSchema);
