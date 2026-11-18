import { Schema, model } from "mongoose";
import { DEFAULT_DESIGNATIONS } from "./constants";

/** Singleton document (key = "global") holding institution-wide configuration. */
const systemSettingSchema = new Schema(
  {
    key: { type: String, default: "global", unique: true },
    institutionName: { type: String, default: "Northbridge Institute of Technology" },
    institutionShortName: { type: String, default: "NIT" },
    institutionLogo: { type: String, default: "" },
    address: { type: String, default: "" },
    contactEmail: { type: String, default: "" },
    academicYear: { type: String, default: "2026-27" },
    currentSemester: { type: String, enum: ["Odd", "Even"], default: "Odd" },
    semesterConfig: {
      oddStartMonth: { type: Number, default: 7, min: 1, max: 12 },
      evenStartMonth: { type: Number, default: 1, min: 1, max: 12 },
    },
    workingDays: { type: [Number], default: [1, 2, 3, 4, 5, 6] }, // 0=Sun … 6=Sat
    designations: { type: [String], default: DEFAULT_DESIGNATIONS },
    timetableSlots: {
      type: [{ label: String, startTime: String, endTime: String, _id: false }],
      default: [
        { label: "Period 1", startTime: "09:00", endTime: "09:55" },
        { label: "Period 2", startTime: "09:55", endTime: "10:50" },
        { label: "Period 3", startTime: "11:05", endTime: "12:00" },
        { label: "Period 4", startTime: "12:00", endTime: "12:55" },
        { label: "Period 5", startTime: "13:45", endTime: "14:40" },
        { label: "Period 6", startTime: "14:40", endTime: "15:35" },
        { label: "Period 7", startTime: "15:35", endTime: "16:30" },
      ],
    },
    attendance: {
      workdayStart: { type: String, default: "09:00" },
      workdayEnd: { type: String, default: "17:00" },
      lateAfter: { type: String, default: "09:15" },
      allowSelfCheckIn: { type: Boolean, default: true },
      hodCanMark: { type: Boolean, default: true },
      minAttendancePercent: { type: Number, default: 75 },
    },
    leavePolicy: {
      casual: { type: Number, default: 12 },
      sick: { type: Number, default: 10 },
      earned: { type: Number, default: 15 },
      medical: { type: Number, default: 20 },
      other: { type: Number, default: 5 },
      maxConsecutiveDays: { type: Number, default: 30 },
      allowBackdatedDays: { type: Number, default: 7 },
    },
    workload: {
      minWeeklyHours: { type: Number, default: 10 },
      maxWeeklyHours: { type: Number, default: 18 },
    },
    notifications: {
      emailEnabled: { type: Boolean, default: false },
      emailOnLeaveDecision: { type: Boolean, default: true },
      emailOnAnnouncement: { type: Boolean, default: false },
      emailOnWorkload: { type: Boolean, default: false },
    },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export const SystemSetting = model("SystemSetting", systemSettingSchema);
