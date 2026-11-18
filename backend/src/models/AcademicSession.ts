import { Schema, model } from "mongoose";

const academicSessionSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, match: /^\d{4}-\d{2}$/ }, // e.g. 2026-27
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    isCurrent: { type: Boolean, default: false },
    semesters: [
      {
        name: { type: String, required: true }, // "Odd" / "Even"
        startDate: { type: Date, required: true },
        endDate: { type: Date, required: true },
      },
    ],
  },
  { timestamps: true },
);

export const AcademicSession = model("AcademicSession", academicSessionSchema);
