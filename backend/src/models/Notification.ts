import { Schema, model } from "mongoose";
import { NOTIFICATION_TYPES } from "./constants";

const notificationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, default: "system" },
    title: { type: String, required: true, maxlength: 200 },
    message: { type: String, required: true, maxlength: 1000 },
    link: { type: String, default: "" },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },
  },
  { timestamps: true },
);

notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });

export const Notification = model("Notification", notificationSchema);
