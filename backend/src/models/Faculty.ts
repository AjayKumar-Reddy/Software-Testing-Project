import { Schema, model } from "mongoose";
import { EMPLOYMENT_STATUSES, EMPLOYMENT_TYPES, GENDERS } from "./constants";

const facultySchema = new Schema(
  {
    facultyId: { type: String, required: true, unique: true, uppercase: true, trim: true },
    user: { type: Schema.Types.ObjectId, ref: "User", default: null },
    // Personal
    firstName: { type: String, required: true, trim: true, maxlength: 60 },
    lastName: { type: String, required: true, trim: true, maxlength: 60 },
    photo: { type: String, default: "" },
    gender: { type: String, enum: GENDERS },
    dateOfBirth: { type: Date },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, trim: true, default: "" },
    address: {
      line1: { type: String, trim: true, default: "" },
      city: { type: String, trim: true, default: "" },
      state: { type: String, trim: true, default: "" },
      postalCode: { type: String, trim: true, default: "" },
      country: { type: String, trim: true, default: "India" },
    },
    emergencyContact: {
      name: { type: String, trim: true, default: "" },
      relation: { type: String, trim: true, default: "" },
      phone: { type: String, trim: true, default: "" },
    },
    // Professional
    department: { type: Schema.Types.ObjectId, ref: "Department", required: true },
    designation: { type: String, required: true, trim: true },
    qualification: { type: String, trim: true, default: "" },
    specialization: { type: String, trim: true, default: "" },
    experienceYears: { type: Number, min: 0, max: 60, default: 0 },
    dateOfJoining: { type: Date, required: true },
    employmentType: { type: String, enum: EMPLOYMENT_TYPES, default: "full_time" },
    status: { type: String, enum: EMPLOYMENT_STATUSES, default: "active" },
    courses: [{ type: Schema.Types.ObjectId, ref: "Course" }],
    isArchived: { type: Boolean, default: false },
    archivedAt: { type: Date },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

facultySchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

facultySchema.index({ department: 1, status: 1 });
facultySchema.index({ designation: 1 });
facultySchema.index({ firstName: "text", lastName: "text", email: "text", facultyId: "text", specialization: "text" });

export const Faculty = model("Faculty", facultySchema);
