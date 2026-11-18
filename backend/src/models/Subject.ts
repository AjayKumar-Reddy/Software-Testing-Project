import { Schema, model } from "mongoose";

const subjectSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    department: { type: Schema.Types.ObjectId, ref: "Department", required: true, index: true },
    course: { type: Schema.Types.ObjectId, ref: "Course", default: null },
    semester: { type: Number, required: true, min: 1, max: 12 },
    academicYear: { type: String, required: true, match: /^\d{4}-\d{2}$/ },
    credits: { type: Number, required: true, min: 0, max: 10 },
    type: { type: String, enum: ["theory", "lab", "elective"], default: "theory" },
    weeklyHours: { type: Number, min: 0, max: 20, default: 3 },
    assignedFaculty: [{ type: Schema.Types.ObjectId, ref: "Faculty" }],
    description: { type: String, trim: true, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

subjectSchema.index({ assignedFaculty: 1 });
subjectSchema.index({ academicYear: 1, semester: 1 });

export const Subject = model("Subject", subjectSchema);
