import { Schema, model } from "mongoose";

const departmentSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 120 },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 12 },
    description: { type: String, trim: true, maxlength: 2000, default: "" },
    head: { type: Schema.Types.ObjectId, ref: "Faculty", default: null },
    establishedYear: { type: Number, min: 1900, max: 2100 },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    location: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Department = model("Department", departmentSchema);
