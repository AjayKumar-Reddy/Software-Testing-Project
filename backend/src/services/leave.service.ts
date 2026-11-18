import { Types } from "mongoose";
import { LeaveBalance, LeaveApplication, Attendance, Faculty } from "../models";
import { LEAVE_TYPES, type LeaveType } from "../models/constants";
import { getSettings } from "./settings.service";
import { workingDaysBetween } from "../utils/dates";
import { ApiError } from "../utils/http";

export interface BalanceRow {
  type: LeaveType;
  allocated: number;
  used: number;
  pending: number;
  available: number;
}

/** Fetches (and lazily initialises from the leave policy) a faculty member's balance for a year. */
export async function ensureBalanceDoc(facultyId: string, academicYear: string) {
  const existing = await LeaveBalance.findOne({ faculty: facultyId, academicYear });
  if (existing) return existing;
  const settings = await getSettings();
  const policy = settings.leavePolicy as unknown as Record<LeaveType, number>;
  try {
    return await LeaveBalance.create({
      faculty: facultyId,
      academicYear,
      balances: LEAVE_TYPES.map((t) => ({ type: t, allocated: policy[t] ?? 0, used: 0 })),
    });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) return (await LeaveBalance.findOne({ faculty: facultyId, academicYear }))!;
    throw err;
  }
}

export async function getLeaveBalance(facultyId: string, academicYear: string): Promise<BalanceRow[]> {
  const doc = await ensureBalanceDoc(facultyId, academicYear);
  const pending = await LeaveApplication.aggregate<{ _id: LeaveType; days: number }>([
    { $match: { faculty: new Types.ObjectId(facultyId), academicYear, status: "pending" } },
    { $group: { _id: "$leaveType", days: { $sum: "$days" } } },
  ]);
  return doc.balances.map((b) => {
    const p = pending.find((x) => x._id === b.type)?.days ?? 0;
    return { type: b.type as LeaveType, allocated: b.allocated, used: b.used, pending: p, available: Math.max(0, b.allocated - b.used - p) };
  });
}

export async function countLeaveDays(start: Date, end: Date): Promise<number> {
  const settings = await getSettings();
  return workingDaysBetween(start, end, settings.workingDays).length;
}

/** Throws 409 if the faculty already has a pending/approved leave overlapping the range. */
export async function assertNoOverlap(facultyId: string, start: Date, end: Date, excludeId?: string) {
  const clash = await LeaveApplication.findOne({
    faculty: facultyId,
    status: { $in: ["pending", "approved"] },
    startDate: { $lte: end },
    endDate: { $gte: start },
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  }).lean();
  if (clash) {
    throw ApiError.conflict(
      `Overlaps an existing ${clash.status} ${clash.leaveType} leave (${clash.startDate.toISOString().slice(0, 10)} → ${clash.endDate.toISOString().slice(0, 10)})`,
    );
  }
}

/**
 * Reflects an approved leave in attendance: every working day in the range gets a single
 * `on_leave` record linked to the leave. Existing "absent" or unmarked days are converted;
 * days already recorded as present/late are left untouched and reported back as conflicts.
 */
export async function applyLeaveToAttendance(leave: { _id: unknown; faculty: unknown; startDate: Date; endDate: Date }, markedBy: string) {
  const settings = await getSettings();
  const faculty = await Faculty.findById(leave.faculty).select("department").lean();
  if (!faculty) return { applied: 0, conflicts: 0 };
  const days = workingDaysBetween(leave.startDate, leave.endDate, settings.workingDays);
  let applied = 0;
  let conflicts = 0;
  for (const date of days) {
    const existing = await Attendance.findOne({ faculty: leave.faculty, date });
    if (existing && (existing.status === "present" || existing.status === "late")) {
      conflicts++;
      continue;
    }
    await Attendance.updateOne(
      { faculty: leave.faculty, date },
      {
        $set: { status: "on_leave", source: "leave", leave: leave._id, department: faculty.department, markedBy, remarks: "Approved leave" },
        $unset: { checkIn: "", checkOut: "" },
      },
      { upsert: true },
    );
    applied++;
  }
  return { applied, conflicts };
}

/** Removes attendance rows that were generated from a leave (when an approved leave is cancelled). */
export async function revertLeaveAttendance(leaveId: unknown) {
  await Attendance.deleteMany({ leave: leaveId, source: "leave" });
}

/** Returns the approved leave covering a date for a faculty, if any. */
export async function approvedLeaveOn(facultyId: string, date: Date) {
  return LeaveApplication.findOne({ faculty: facultyId, status: "approved", startDate: { $lte: date }, endDate: { $gte: date } }).lean();
}
