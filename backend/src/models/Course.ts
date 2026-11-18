import { Schema, model } from "mongoose";

/** A degree programme, e.g. "B.Tech Computer Science". Subjects belong to a course. */
const courseSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    department: { type: Schema.Types.ObjectId, ref: "Department", required: true, index: true },
    level: { type: String, enum: ["UG", "PG", "Diploma", "PhD"], default: "UG" },
    durationYears: { type: Number, min: 1, max: 6, default: 4 },
    totalSemesters: { type: Number, min: 1, max: 12, default: 8 },
    intake: { type: Number, min: 0, default: 60 },
    description: { type: String, trim: true, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Course = model("Course", courseSchema);
