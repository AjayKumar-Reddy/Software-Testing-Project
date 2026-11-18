import { Types } from "mongoose";
import { endOfMonth, format, parse, startOfMonth } from "date-fns";
import { Attendance, Faculty, LeaveApplication, Department } from "../models";
import { ApiError, asyncHandler, sendSuccess, parsePagination, buildMeta } from "../utils/http";
import { requireUser } from "../middleware/auth";
import { resolveDepartment, assertFacultyAccess, assertDepartmentAccess } from "../services/scope.service";
import { audit } from "../services/audit.service";
import { aggregateStats } from "../services/attendance.service";
import { approvedLeaveOn } from "../services/leave.service";
import { getSettings } from "../services/settings.service";
import { toDateOnly, todayDateOnly, timeToMinutes, nowHHmm, dateKey } from "../utils/dates";
import type { AuthUser } from "../types";

function rangeFilter(from?: string, to?: string) {
  if (!from && !to) return undefined;
  const r: Record<string, Date> = {};
  if (from) r.$gte = toDateOnly(from);
  if (to) r.$lte = toDateOnly(to);
  return r;
}

/** Builds a Mongo match honouring role scope. */
function scopedMatch(user: AuthUser, q: Record<string, string | undefined>) {
  const match: Record<string, unknown> = {};
  if (user.role === "faculty") {
    if (q.faculty && q.faculty !== user.facultyId) throw ApiError.forbidden("You can only view your own attendance");
    match.faculty = new Types.ObjectId(user.facultyId!);
  } else {
    const dept = resolveDepartment(user, q.department);
    if (dept) match.department = new Types.ObjectId(dept);
    if (q.faculty) match.faculty = new Types.ObjectId(q.faculty);
  }
  const range = rangeFilter(q.from, q.to);
  if (range) match.date = range;
  if (q.status) match.status = q.status;
  return match;
}

function assertCanMark(user: AuthUser, settings: Awaited<ReturnType<typeof getSettings>>) {
  if (user.role === "admin") return;
  if (user.role === "hod" && settings.attendance?.hodCanMark) return;
  throw ApiError.forbidden("You are not permitted to mark attendance");
}

export const list = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const q = req.query as Record<string, string | undefined>;
  const { page, limit, skip } = parsePagination(q, 20);
  const match = scopedMatch(user, q);
  const [items, total] = await Promise.all([
    Attendance.find(match)
      .populate("faculty", "facultyId firstName lastName photo designation")
      .populate("department", "name code")
      .populate("markedBy", "name role")
      .sort({ date: -1, _id: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Attendance.countDocuments(match),
  ]);
  sendSuccess(res, items, { meta: buildMeta(page, limit, total) });
});

/** Roster for marking: every active faculty in scope with their record (if any) for the date. */
export const daily = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  if (user.role === "faculty") throw ApiError.forbidden();
  const q = req.query as Record<string, string | undefined>;
  const date = q.date ? toDateOnly(q.date) : todayDateOnly();
  const dept = resolveDepartment(user, q.department);
  const facFilter: Record<string, unknown> = { isArchived: false, status: { $in: ["active", "probation", "on_sabbatical"] } };
  if (dept) facFilter.department = dept;
  const faculty = await Faculty.find(facFilter).select("facultyId firstName lastName photo designation department").populate("department", "name code").sort({ firstName: 1 }).lean();
  const ids = faculty.map((f) => f._id);
  const [records, leaves] = await Promise.all([
    Attendance.find({ faculty: { $in: ids }, date }).populate("markedBy", "name").lean(),
    LeaveApplication.find({ faculty: { $in: ids }, status: "approved", startDate: { $lte: date }, endDate: { $gte: date } }).select("faculty leaveType").lean(),
  ]);
  const settings = await getSettings();
  sendSuccess(res, {
    date: dateKey(date),
    isWorkingDay: settings.workingDays.includes(date.getUTCDay()),
    rows: faculty.map((f) => ({
      faculty: { ...f, fullName: `${f.firstName} ${f.lastName}` },
      record: records.find((r) => String(r.faculty) === String(f._id)) ?? null,
      leave: leaves.find((l) => String(l.faculty) === String(f._id)) ?? null,
    })),
  });
});

/** Upserts attendance for many faculty on one date. One record per faculty/day is guaranteed by a unique index. */
export const bulkMark = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const settings = await getSettings();
  assertCanMark(user, settings);
  const { date: dateStr, records } = req.body as { date: string; records: { faculty: string; status: string; checkIn?: string; checkOut?: string; remarks?: string }[] };
  const date = toDateOnly(dateStr);
  if (date > todayDateOnly()) throw ApiError.badRequest("Attendance cannot be marked for a future date");
  if (!settings.workingDays.includes(date.getUTCDay())) throw ApiError.badRequest("The selected date is not a working day");

  const facultyDocs = await Faculty.find({ _id: { $in: records.map((r) => r.faculty) } }).select("department firstName lastName").lean();
  // Authorise the whole batch up front so a forbidden row can't leave a half-saved register.
  for (const f of facultyDocs) assertDepartmentAccess(user, f.department);
  let saved = 0;
  const skipped: { faculty: string; reason: string }[] = [];

  for (const rec of records) {
    const fac = facultyDocs.find((f) => String(f._id) === rec.faculty);
    if (!fac) {
      skipped.push({ faculty: rec.faculty, reason: "Faculty not found" });
      continue;
    }
    if (rec.checkIn && rec.checkOut && rec.checkOut <= rec.checkIn) {
      skipped.push({ faculty: rec.faculty, reason: `${fac.firstName} ${fac.lastName}: check-out must be after check-in` });
      continue;
    }
    const leave = await approvedLeaveOn(rec.faculty, date);
    if (leave && rec.status !== "on_leave") {
      skipped.push({ faculty: rec.faculty, reason: `${fac.firstName} ${fac.lastName} is on approved leave` });
      continue;
    }
    if (!leave && rec.status === "on_leave") {
      skipped.push({ faculty: rec.faculty, reason: `${fac.firstName} ${fac.lastName} has no approved leave for this date` });
      continue;
    }
    let status = rec.status;
    // Auto-flag late arrivals based on the configured threshold.
    if (status === "present" && rec.checkIn && settings.attendance?.lateAfter && timeToMinutes(rec.checkIn) > timeToMinutes(settings.attendance.lateAfter)) status = "late";
    const hasTimes = status === "present" || status === "late";
    await Attendance.updateOne(
      { faculty: rec.faculty, date },
      {
        $set: {
          department: fac.department,
          status,
          source: leave ? "leave" : "manual",
          leave: leave?._id ?? null,
          remarks: rec.remarks ?? "",
          markedBy: user.id,
          ...(hasTimes && rec.checkIn ? { checkIn: rec.checkIn } : {}),
          ...(hasTimes && rec.checkOut ? { checkOut: rec.checkOut } : {}),
        },
        ...(hasTimes ? {} : { $unset: { checkIn: "", checkOut: "" } }),
      },
      { upsert: true, runValidators: true },
    );
    saved++;
  }
  await audit(req, { action: "MARK", module: "attendance", description: `Marked attendance for ${saved} faculty on ${dateStr}` });
  sendSuccess(res, { saved, skipped }, { message: `Attendance saved for ${saved} faculty${skipped.length ? `, ${skipped.length} skipped` : ""}` });
});

export const update = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const settings = await getSettings();
  assertCanMark(user, settings);
  const rec = await Attendance.findById(req.params.id);
  if (!rec) throw ApiError.notFound("Attendance record not found");
  assertDepartmentAccess(user, rec.department);
  const body = req.body as { status?: string; checkIn?: string; checkOut?: string; remarks?: string };
  if (body.status && body.status !== "on_leave" && (await approvedLeaveOn(String(rec.faculty), rec.date))) {
    throw ApiError.conflict("This faculty member has approved leave on this date");
  }
  if (body.status === "on_leave" && !(await approvedLeaveOn(String(rec.faculty), rec.date))) {
    throw ApiError.badRequest("No approved leave exists for this date. Approve a leave application instead.");
  }
  rec.set({ ...body, markedBy: user.id, source: rec.source === "self" ? "manual" : rec.source });
  if (rec.checkIn && rec.checkOut && rec.checkOut <= rec.checkIn) throw ApiError.badRequest("Check-out must be after check-in");
  await rec.save();
  await audit(req, { action: "UPDATE", module: "attendance", recordId: rec._id, description: `Updated attendance record (${dateKey(rec.date)})` });
  sendSuccess(res, rec, { message: "Attendance updated" });
});

export const remove = asyncHandler(async (req, res) => {
  const rec = await Attendance.findById(req.params.id);
  if (!rec) throw ApiError.notFound("Attendance record not found");
  await rec.deleteOne();
  await audit(req, { action: "DELETE", module: "attendance", recordId: rec._id, description: `Deleted attendance record (${dateKey(rec.date)})` });
  sendSuccess(res, null, { message: "Attendance record deleted" });
});

// ---------- Self-service (faculty) ----------
async function selfContext(user: AuthUser) {
  if (!user.facultyId) throw ApiError.badRequest("No faculty profile is linked to your account");
  const settings = await getSettings();
  if (!settings.attendance?.allowSelfCheckIn) throw ApiError.forbidden("Self check-in is disabled by the institution");
  const today = todayDateOnly();
  if (!settings.workingDays.includes(today.getUTCDay())) throw ApiError.badRequest("Today is not a working day");
  return { settings, today };
}

export const today = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const settings = await getSettings();
  const date = todayDateOnly();
  const record = user.facultyId ? await Attendance.findOne({ faculty: user.facultyId, date }).lean() : null;
  const leave = user.facultyId ? await approvedLeaveOn(user.facultyId, date) : null;
  sendSuccess(res, {
    date: dateKey(date),
    record,
    onLeave: Boolean(leave),
    selfCheckInEnabled: Boolean(settings.attendance?.allowSelfCheckIn),
    isWorkingDay: settings.workingDays.includes(date.getUTCDay()),
    lateAfter: settings.attendance?.lateAfter,
  });
});

export const checkIn = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const { settings, today: date } = await selfContext(user);
  if (await approvedLeaveOn(user.facultyId!, date)) throw ApiError.conflict("You are on approved leave today");
  if (await Attendance.exists({ faculty: user.facultyId, date })) throw ApiError.conflict("Attendance for today has already been recorded");
  const time = nowHHmm();
  const status = timeToMinutes(time) > timeToMinutes(settings.attendance!.lateAfter!) ? "late" : "present";
  const rec = await Attendance.create({
    faculty: user.facultyId,
    department: user.departmentId,
    date,
    checkIn: time,
    status,
    source: "self",
    remarks: req.body?.remarks ?? "Self check-in",
    markedBy: user.id,
  });
  await audit(req, { action: "CHECK_IN", module: "attendance", recordId: rec._id, description: `Self check-in at ${time} (${status})` });
  sendSuccess(res, rec, { status: 201, message: `Checked in at ${time}${status === "late" ? " (late)" : ""}` });
});

export const checkOut = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const { today: date } = await selfContext(user);
  const rec = await Attendance.findOne({ faculty: user.facultyId, date });
  if (!rec || !rec.checkIn) throw ApiError.badRequest("You have not checked in today");
  if (rec.checkOut) throw ApiError.conflict("You have already checked out today");
  const time = nowHHmm();
  if (time <= rec.checkIn) throw ApiError.badRequest("Check-out time must be after check-in");
  rec.checkOut = time;
  await rec.save();
  await audit(req, { action: "CHECK_OUT", module: "attendance", recordId: rec._id, description: `Self check-out at ${time}` });
  sendSuccess(res, rec, { message: `Checked out at ${time}` });
});

// ---------- Analytics ----------
export const summary = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const q = req.query as Record<string, string | undefined>;
  const match = scopedMatch(user, { ...q, status: undefined });
  sendSuccess(res, await aggregateStats(match));
});

/** Month calendar for one faculty member: { "YYYY-MM-DD": record } */
export const calendar = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const q = req.query as Record<string, string | undefined>;
  const facultyId = q.faculty || user.facultyId;
  if (!facultyId) throw ApiError.badRequest("Select a faculty member");
  const faculty = await Faculty.findById(facultyId).select("department firstName lastName facultyId").lean();
  if (!faculty) throw ApiError.notFound("Faculty member not found");
  assertFacultyAccess(user, faculty);
  const month = q.month && /^\d{4}-\d{2}$/.test(q.month) ? q.month : format(new Date(), "yyyy-MM");
  const start = toDateOnly(`${month}-01`);
  const end = toDateOnly(format(endOfMonth(parse(month, "yyyy-MM", new Date())), "yyyy-MM-dd"));
  const records = await Attendance.find({ faculty: faculty._id, date: { $gte: start, $lte: end } }).sort({ date: 1 }).lean();
  const settings = await getSettings();
  sendSuccess(res, {
    month,
    faculty: { ...faculty, fullName: `${faculty.firstName} ${faculty.lastName}` },
    workingDays: settings.workingDays,
    records,
    stats: await aggregateStats({ faculty: faculty._id, date: { $gte: start, $lte: end } }),
  });
});

/** Per-department stats for a date range. */
export const departmentStats = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  if (user.role === "faculty") throw ApiError.forbidden();
  const q = req.query as Record<string, string | undefined>;
  const deptFilter = user.role === "admin" ? {} : { _id: user.departmentId };
  const depts = await Department.find(deptFilter).select("name code").sort({ name: 1 }).lean();
  const range = rangeFilter(q.from ?? format(startOfMonth(new Date()), "yyyy-MM-dd"), q.to);
  const rows = await Promise.all(
    depts.map(async (d) => ({ departmentId: d._id, department: d.name, code: d.code, ...(await aggregateStats({ department: d._id, ...(range ? { date: range } : {}) })) })),
  );
  sendSuccess(res, rows);
});

/** Daily trend (for charts) over a date range. */
export const trend = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const q = req.query as Record<string, string | undefined>;
  const match = scopedMatch(user, { ...q, status: undefined });
  const rows = await Attendance.aggregate([
    { $match: match },
    { $group: { _id: { d: { $dateToString: { format: q.groupBy === "month" ? "%Y-%m" : "%Y-%m-%d", date: "$date" } }, s: "$status" }, n: { $sum: 1 } } },
    { $group: { _id: "$_id.d", counts: { $push: { k: "$_id.s", v: "$n" } } } },
    { $sort: { _id: 1 } },
  ]);
  sendSuccess(
    res,
    rows.map((r) => {
      const c = Object.fromEntries(r.counts.map((x: { k: string; v: number }) => [x.k, x.v])) as Record<string, number>;
      const present = c.present ?? 0, late = c.late ?? 0, absent = c.absent ?? 0, onLeave = c.on_leave ?? 0;
      const countable = present + late + absent;
      return { period: r._id, present, late, absent, onLeave, percentage: countable ? Math.round(((present + late) / countable) * 1000) / 10 : null };
    }),
  );
});
