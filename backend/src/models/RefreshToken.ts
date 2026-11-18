import { Schema, model } from "mongoose";

/** Stores SHA-256 hashes of issued refresh tokens to support rotation and revocation. */
const refreshTokenSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    userAgent: String,
    ip: String,
  },
  { timestamps: true },
);

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = model("RefreshToken", refreshTokenSchema);
