import { Schema, model } from "mongoose";
import { LEAVE_TYPES } from "./constants";

const entry = new Schema(
  {
    type: { type: String, enum: LEAVE_TYPES, required: true },
    allocated: { type: Number, required: true, min: 0 },
    used: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const leaveBalanceSchema = new Schema(
  {
    faculty: { type: Schema.Types.ObjectId, ref: "Faculty", required: true },
    academicYear: { type: String, required: true },
    balances: [entry],
  },
  { timestamps: true },
);

leaveBalanceSchema.index({ faculty: 1, academicYear: 1 }, { unique: true });

export const LeaveBalance = model("LeaveBalance", leaveBalanceSchema);
