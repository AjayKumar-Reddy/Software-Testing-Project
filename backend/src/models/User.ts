import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import bcrypt from "bcryptjs";
import { ROLES } from "./constants";

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false, minlength: 8 },
    role: { type: String, enum: ROLES, required: true, default: "faculty" },
    faculty: { type: Schema.Types.ObjectId, ref: "Faculty", default: null },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
    passwordChangedAt: { type: Date },
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
  },
  { timestamps: true },
);

userSchema.index({ role: 1 });

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  if (!this.isNew) this.passwordChangedAt = new Date();
  next();
});

userSchema.methods.comparePassword = function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

userSchema.set("toJSON", {
  transform: (_doc, ret: Record<string, unknown>) => {
    delete ret.password;
    delete ret.passwordResetToken;
    delete ret.passwordResetExpires;
    delete ret.__v;
    return ret;
  },
});

export type UserAttrs = InferSchemaType<typeof userSchema>;
export type UserDoc = HydratedDocument<UserAttrs> & { comparePassword(candidate: string): Promise<boolean> };
export const User = model<UserAttrs>("User", userSchema);
