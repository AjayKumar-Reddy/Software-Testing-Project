import { Schema, model } from "mongoose";
import { WORKLOAD_TYPES } from "./constants";

const workloadSchema = new Schema(
  {
    faculty: { type: Schema.Types.ObjectId, ref: "Faculty", required: true, index: true },
    subject: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
    course: { type: Schema.Types.ObjectId, ref: "Course", default: null },
    department: { type: Schema.Types.ObjectId, ref: "Department", required: true, index: true },
    semester: { type: Number, required: true, min: 1, max: 12 },
    academicYear: { type: String, required: true },
    weeklyHours: { type: Number, required: true, min: 0.5, max: 40 },
    type: { type: String, enum: WORKLOAD_TYPES, default: "lecture" },
    section: { type: String, trim: true, default: "A" },
    notes: { type: String, trim: true, default: "" },
    assignedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

// Prevent the same faculty being allocated the same subject/section/type twice in a year.
workloadSchema.index({ faculty: 1, subject: 1, academicYear: 1, section: 1, type: 1 }, { unique: true });

export const Workload = model("Workload", workloadSchema);
