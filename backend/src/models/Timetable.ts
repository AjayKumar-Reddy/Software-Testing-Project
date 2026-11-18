import { Schema, model } from "mongoose";

const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;

const timetableSchema = new Schema(
  {
    faculty: { type: Schema.Types.ObjectId, ref: "Faculty", required: true, index: true },
    subject: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
    department: { type: Schema.Types.ObjectId, ref: "Department", required: true, index: true },
    section: { type: String, required: true, trim: true, uppercase: true }, // class group e.g. CSE-5A
    room: { type: String, required: true, trim: true, uppercase: true },
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
    startTime: { type: String, required: true, match: timeRe },
    endTime: { type: String, required: true, match: timeRe },
    academicYear: { type: String, required: true },
    semester: { type: Number, required: true, min: 1, max: 12 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

timetableSchema.index({ academicYear: 1, dayOfWeek: 1, room: 1 });
timetableSchema.index({ academicYear: 1, dayOfWeek: 1, section: 1 });

export const Timetable = model("Timetable", timetableSchema);
