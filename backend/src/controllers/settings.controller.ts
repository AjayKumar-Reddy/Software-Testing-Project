import { z } from "zod";
import { SystemSetting } from "../models";
import { ApiError, asyncHandler, sendSuccess } from "../utils/http";
import { audit } from "../services/audit.service";
import { getSettings, invalidateSettings } from "../services/settings.service";
import { isEmailConfigured } from "../services/email.service";
import { time } from "../validators/common";

export const settingsSchema = z
  .object({
    institutionName: z.string().trim().min(2).max(150),
    institutionShortName: z.string().trim().max(20),
    address: z.string().trim().max(300),
    contactEmail: z.string().trim().email().or(z.literal("")),
    academicYear: z.string().regex(/^\d{4}-\d{2}$/),
    currentSemester: z.enum(["Odd", "Even"]),
    semesterConfig: z.object({ oddStartMonth: z.number().int().min(1).max(12), evenStartMonth: z.number().int().min(1).max(12) }),
    workingDays: z.array(z.number().int().min(0).max(6)).min(1, "Select at least one working day"),
    designations: z.array(z.string().trim().min(2).max(60)).min(1),
    timetableSlots: z.array(z.object({ label: z.string().trim().min(1).max(30), startTime: time, endTime: time })).min(1),
    attendance: z.object({
      workdayStart: time,
      workdayEnd: time,
      lateAfter: time,
      allowSelfCheckIn: z.boolean(),
      hodCanMark: z.boolean(),
      minAttendancePercent: z.number().min(0).max(100),
    }),
    leavePolicy: z.object({
      casual: z.number().min(0).max(365),
      sick: z.number().min(0).max(365),
      earned: z.number().min(0).max(365),
      medical: z.number().min(0).max(365),
      other: z.number().min(0).max(365),
      maxConsecutiveDays: z.number().int().min(1).max(365),
      allowBackdatedDays: z.number().int().min(0).max(90),
    }),
    workload: z
      .object({ minWeeklyHours: z.number().min(0).max(60), maxWeeklyHours: z.number().min(1).max(60) })
      .refine((w) => w.maxWeeklyHours > w.minWeeklyHours, { message: "Maximum must exceed minimum", path: ["maxWeeklyHours"] }),
    notifications: z.object({
      emailEnabled: z.boolean(),
      emailOnLeaveDecision: z.boolean(),
      emailOnAnnouncement: z.boolean(),
      emailOnWorkload: z.boolean(),
    }),
  })
  .partial();

export const get = asyncHandler(async (_req, res) => {
  const s = await getSettings();
  sendSuccess(res, { ...s, emailConfigured: isEmailConfigured() });
});

/** Minimal branding for the (unauthenticated) login screen. */
export const getPublic = asyncHandler(async (_req, res) => {
  const s = await getSettings();
  sendSuccess(res, { institutionName: s.institutionName, institutionShortName: s.institutionShortName, institutionLogo: s.institutionLogo });
});

export const update = asyncHandler(async (req, res) => {
  const body = req.body as Record<string, unknown>;
  if (Array.isArray(body.timetableSlots)) {
    for (const s of body.timetableSlots as { startTime: string; endTime: string; label: string }[]) {
      if (s.endTime <= s.startTime) throw ApiError.badRequest(`${s.label}: end time must be after start time`);
    }
  }
  const doc = await SystemSetting.findOneAndUpdate({ key: "global" }, { $set: { ...body, updatedBy: req.user?.id } }, { new: true, upsert: true, runValidators: true });
  invalidateSettings();
  await audit(req, { action: "UPDATE", module: "settings", recordId: doc._id, description: `Updated system settings (${Object.keys(body).join(", ")})` });
  sendSuccess(res, doc, { message: "Settings saved" });
});

export const uploadLogo = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest("No image uploaded");
  const logo = `/uploads/logos/${req.file.filename}`;
  await SystemSetting.updateOne({ key: "global" }, { institutionLogo: logo }, { upsert: true });
  invalidateSettings();
  await audit(req, { action: "UPDATE", module: "settings", description: "Updated institution logo" });
  sendSuccess(res, { institutionLogo: logo }, { message: "Logo updated" });
});
