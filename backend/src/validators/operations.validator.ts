import { z } from "zod";
import { ATTENDANCE_STATUSES, LEAVE_TYPES, LEAVE_STATUSES, WORKLOAD_TYPES, ANNOUNCEMENT_AUDIENCES, ANNOUNCEMENT_PRIORITIES } from "../models/constants";
import { academicYear, dateString, objectId, time, listQuery, optionalObjectId } from "./common";

// ---------- Attendance ----------
const attendanceRecord = z.object({
  faculty: objectId,
  status: z.enum(ATTENDANCE_STATUSES),
  checkIn: time.optional().or(z.literal("")).transform((v) => v || undefined),
  checkOut: time.optional().or(z.literal("")).transform((v) => v || undefined),
  remarks: z.string().trim().max(500).optional(),
});
export const bulkAttendanceSchema = z.object({
  date: dateString,
  records: z.array(attendanceRecord).min(1, "No attendance records supplied").max(500),
});
export const updateAttendanceSchema = attendanceRecord.omit({ faculty: true }).partial();
export const attendanceListQuery = listQuery.extend({
  faculty: objectId.optional(),
  department: objectId.optional(),
  status: z.enum(ATTENDANCE_STATUSES).optional(),
  from: dateString.optional(),
  to: dateString.optional(),
});
export const selfAttendanceSchema = z.object({ remarks: z.string().trim().max(500).optional() });

// ---------- Leave ----------
export const leaveApplySchema = z
  .object({
    leaveType: z.enum(LEAVE_TYPES),
    startDate: dateString,
    endDate: dateString,
    reason: z.string().trim().min(5, "Please give a reason (min 5 characters)").max(1000),
    faculty: optionalObjectId, // admin/HOD applying on behalf
  })
  .refine((d) => d.endDate >= d.startDate, { message: "End date cannot be before start date", path: ["endDate"] });
export const leaveDecisionSchema = z.object({ remarks: z.string().trim().max(500).optional() });
export const leaveRejectSchema = z.object({ remarks: z.string().trim().min(3, "A rejection reason is required").max(500) });
export const leaveListQuery = listQuery.extend({
  status: z.enum(LEAVE_STATUSES).optional(),
  leaveType: z.enum(LEAVE_TYPES).optional(),
  faculty: objectId.optional(),
  department: objectId.optional(),
  from: dateString.optional(),
  to: dateString.optional(),
  mine: z.enum(["true", "false"]).optional(),
});
export const leaveBalanceUpdateSchema = z.object({
  academicYear,
  balances: z.array(z.object({ type: z.enum(LEAVE_TYPES), allocated: z.coerce.number().min(0).max(365) })).min(1),
});

// ---------- Workload ----------
export const workloadSchema = z.object({
  faculty: objectId,
  subject: objectId,
  weeklyHours: z.coerce.number().min(0.5, "Weekly hours must be at least 0.5").max(40),
  type: z.enum(WORKLOAD_TYPES).optional(),
  section: z.string().trim().toUpperCase().min(1).max(10).optional(),
  academicYear: academicYear.optional(),
  notes: z.string().trim().max(500).optional(),
});
export const workloadListQuery = listQuery.extend({
  faculty: objectId.optional(),
  department: objectId.optional(),
  academicYear: academicYear.optional(),
  semester: z.coerce.number().int().min(1).max(12).optional(),
  term: z.enum(["odd", "even", "all"]).optional(),
});

// ---------- Timetable ----------
export const timetableSchema = z
  .object({
    faculty: objectId,
    subject: objectId,
    section: z.string().trim().toUpperCase().min(1).max(20),
    room: z.string().trim().toUpperCase().min(1).max(20),
    dayOfWeek: z.coerce.number().int().min(0).max(6),
    startTime: time,
    endTime: time,
    academicYear: academicYear.optional(),
  })
  .refine((d) => d.endTime > d.startTime, { message: "End time must be after start time", path: ["endTime"] });
export const timetableQuery = z.object({
  faculty: objectId.optional(),
  department: objectId.optional(),
  section: z.string().trim().toUpperCase().max(20).optional(),
  room: z.string().trim().toUpperCase().max(20).optional(),
  academicYear: academicYear.optional(),
});

// ---------- Announcements ----------
export const announcementSchema = z
  .object({
    title: z.string().trim().min(3, "Title is required").max(200),
    content: z.string().trim().min(5, "Content is required").max(5000),
    priority: z.enum(ANNOUNCEMENT_PRIORITIES).optional(),
    category: z.enum(["general", "event", "academic", "administrative"]).optional(),
    audience: z.enum(ANNOUNCEMENT_AUDIENCES).optional(),
    departments: z.array(objectId).optional(),
    publishAt: z.string().datetime({ offset: true }).or(dateString).optional(),
    expiresAt: z.string().datetime({ offset: true }).or(dateString).optional().nullable().or(z.literal("")),
    eventDate: z.string().datetime({ offset: true }).or(dateString).optional().nullable().or(z.literal("")),
    isPinned: z.boolean().optional(),
  })
  .refine((d) => d.audience !== "departments" || (d.departments && d.departments.length > 0), {
    message: "Select at least one department",
    path: ["departments"],
  })
  .refine((d) => !d.expiresAt || !d.publishAt || new Date(d.expiresAt) > new Date(d.publishAt), {
    message: "Expiry must be after the publication date",
    path: ["expiresAt"],
  });
