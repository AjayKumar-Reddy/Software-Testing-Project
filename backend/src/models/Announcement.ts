import { Schema, model } from "mongoose";
import { ANNOUNCEMENT_AUDIENCES, ANNOUNCEMENT_PRIORITIES } from "./constants";

const announcementSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    content: { type: String, required: true, trim: true, maxlength: 5000 },
    priority: { type: String, enum: ANNOUNCEMENT_PRIORITIES, default: "normal" },
    category: { type: String, enum: ["general", "event", "academic", "administrative"], default: "general" },
    audience: { type: String, enum: ANNOUNCEMENT_AUDIENCES, default: "all" },
    departments: [{ type: Schema.Types.ObjectId, ref: "Department" }],
    publishAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: null },
    eventDate: { type: Date, default: null },
    isPinned: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

announcementSchema.index({ publishAt: -1 });

export const Announcement = model("Announcement", announcementSchema);
