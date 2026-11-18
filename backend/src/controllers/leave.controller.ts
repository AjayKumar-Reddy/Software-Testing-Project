import path from "path";
import { Types } from "mongoose";
import fs from "fs";
import { LeaveApplication, Faculty, Department, User, LeaveBalance } from "../models";
import { ApiError, asyncHandler, sendSuccess, parsePagination, buildMeta } from "../utils/http";
import { requireUser } from "../middleware/auth";
import { resolveDepartment, assertFacultyAccess, assertDepartmentAccess } from "../services/scope.service";
import { audit } from "../services/audit.service";
import { notifyFaculty, notifyUsers } from "../services/notification.service";
import { getSettings } from "../services/settings.service";
import {
  assertNoOverlap,
  countLeaveDays,
  getLeaveBalance,
  ensureBalanceDoc,
  applyLeaveToAttendance,
  revertLeaveAttendance,
} from "../services/leave.service";
import { toDateOnly, todayDateOnly, dateKey } from "../utils/dates";
import { env } from "../config/env";
import { differenceInCalendarDays } from "date-fns";
import type { AuthUser } from "../types";

const POP = [
  { path: "faculty", select: "facultyId firstName lastName photo designation department" },
  { path: "department", select: "name code" },
  { path: "reviewedBy", select: "name role" },
];

function canReview(user: AuthUser, leave: { department: unknown; faculty: unknown }) {
  if (user.role === "admin") return true;
  if (user.role !== "hod") return false;
  const facultyId = (leave.faculty as { _id?: unknown })?._id ?? leave.faculty;
  if (String(facultyId) === user.facultyId) return false; // nobody approves their own leave
  return String((leave.department as { _id?: unknown })?._id ?? leave.department) === user.departmentId;
}

function toAggregateMatch(filter: Record<string, unknown>) {
  const m: Record<string, unknown> = { ...filter };
  delete m.status; // counts are shown for every status
  for (const k of ["faculty", "department"]) if (typeof m[k] === "string") m[k] = new Types.ObjectId(m[k] as string);
  return m;
}

function removeUpload(file?: Express.Multer.File) {
  if (file) fs.promises.unlink(file.path).catch(() => undefined);
}

export const list = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const q = req.query as Record<string, string | undefined>;
  const { page, limit, skip } = parsePagination(q, 10);
  const filter: Record<string, unknown> = {};
  if (user.role === "faculty" || q.mine === "true") {
    if (!user.facultyId) throw ApiError.badRequest("No faculty profile is linked to your account");
    filter.faculty = user.facultyId;
  } else {
    const dept = resolveDepartment(user, q.department);
    if (dept) filter.department = dept;
    if (q.faculty) filter.faculty = q.faculty;
  }
  if (q.status) filter.status = q.status;
  if (q.leaveType) filter.leaveType = q.leaveType;
  if (q.from) filter.endDate = { $gte: toDateOnly(q.from) };
  if (q.to) filter.startDate = { $lte: toDateOnly(q.to) };
  const [items, total, counts] = await Promise.all([
    LeaveApplication.find(filter).populate(POP).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    LeaveApplication.countDocuments(filter),
    // Aggregations don't cast strings to ObjectIds, so convert id filters explicitly.
    LeaveApplication.aggregate([{ $match: toAggregateMatch(filter) }, { $group: { _id: "$status", n: { $sum: 1 } } }]),
  ]);
  const statusCounts = Object.fromEntries(counts.map((c) => [c._id, c.n]));
  sendSuccess(
    res,
    items.map((l) => ({ ...l, canReview: l.status === "pending" && canReview(user, l) })),
    { meta: { ...buildMeta(page, limit, total), statusCounts } },
  );
});

export const getOne = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const leave = await LeaveApplication.findById(req.params.id).populate(POP).lean();
  if (!leave) throw ApiError.notFound("Leave application not found");
  assertFacultyAccess(user, leave.faculty as unknown as { _id: unknown; department: unknown });
  sendSuccess(res, { ...leave, canReview: leave.status === "pending" && canReview(user, leave) });
});

export const apply = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const body = req.body as { leaveType: string; startDate: string; endDate: string; reason: string; faculty?: string };
  try {
    const facultyId = body.faculty && user.role !== "faculty" ? body.faculty : user.facultyId;
    if (!facultyId) throw ApiError.badRequest("Administrators without a faculty profile must choose a faculty member");
    const faculty = await Faculty.findById(facultyId).select("department firstName lastName isArchived user").lean();
    if (!faculty || faculty.isArchived) throw ApiError.notFound("Faculty member not found");
    if (facultyId !== user.facultyId) assertDepartmentAccess(user, faculty.department);

    const settings = await getSettings();
    const start = toDateOnly(body.startDate);
    const end = toDateOnly(body.endDate);
    const backdate = settings.leavePolicy?.allowBackdatedDays ?? 0;
    if (differenceInCalendarDays(todayDateOnly(), start) > backdate) {
      throw ApiError.badRequest(`Leave cannot start more than ${backdate} day(s) in the past`);
    }
    const days = await countLeaveDays(start, end);
    if (days === 0) throw ApiError.badRequest("The selected range contains no working days");
    if (days > (settings.leavePolicy?.maxConsecutiveDays ?? 30)) throw ApiError.badRequest(`A single application cannot exceed ${settings.leavePolicy?.maxConsecutiveDays} working days`);
    await assertNoOverlap(facultyId, start, end);

    const balance = (await getLeaveBalance(facultyId, settings.academicYear)).find((b) => b.type === body.leaveType);
    if (balance && days > balance.available) {
      throw ApiError.badRequest(`Insufficient ${body.leaveType} leave balance: ${balance.available} day(s) available, ${days} requested`);
    }

    const leave = await LeaveApplication.create({
      faculty: facultyId,
      department: faculty.department,
      leaveType: body.leaveType,
      startDate: start,
      endDate: end,
      days,
      reason: body.reason,
      academicYear: settings.academicYear,
      appliedBy: user.id,
      document: req.file?.filename ?? "",
      documentName: req.file?.originalname ?? "",
    });

    // Route to the department head (unless the applicant is the head) plus all admins.
    const dept = await Department.findById(faculty.department).select("head").lean();
    const reviewers = (await User.find({ role: "admin", isActive: true }).select("_id").lean()).map((u) => String(u._id));
    if (dept?.head && String(dept.head) !== facultyId) {
      const head = await Faculty.findById(dept.head).select("user").lean();
      if (head?.user) reviewers.push(String(head.user));
    }
    await notifyUsers(reviewers.filter((r) => r !== user.id), {
      type: "leave",
      title: "New leave application",
      message: `${faculty.firstName} ${faculty.lastName} applied for ${days} day(s) of ${body.leaveType} leave (${body.startDate} → ${body.endDate}).`,
      link: "/leaves",
    });
    await audit(req, { action: "APPLY", module: "leave", recordId: leave._id, description: `${body.leaveType} leave applied for ${faculty.firstName} ${faculty.lastName} (${days} days)` });
    sendSuccess(res, leave, { status: 201, message: "Leave application submitted" });
  } catch (err) {
    removeUpload(req.file);
    throw err;
  }
});

export const approve = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const leave = await LeaveApplication.findById(req.params.id);
  if (!leave) throw ApiError.notFound("Leave application not found");
  if (!canReview(user, leave)) throw ApiError.forbidden("You cannot review this leave application");
  if (leave.status !== "pending") throw ApiError.conflict(`This application is already ${leave.status}`);

  // Re-validate balance at decision time (allocations may have changed).
  const balanceDoc = await ensureBalanceDoc(String(leave.faculty), leave.academicYear);
  const entry = balanceDoc.balances.find((b) => b.type === leave.leaveType);
  if (entry && entry.used + leave.days > entry.allocated) {
    throw ApiError.badRequest(`Approving would exceed the ${leave.leaveType} leave allocation (${entry.allocated - entry.used} day(s) left)`);
  }
  // Atomic status transition guards against double approval.
  const updated = await LeaveApplication.findOneAndUpdate(
    { _id: leave._id, status: "pending" },
    { status: "approved", reviewedBy: user.id, reviewedAt: new Date(), reviewRemarks: req.body?.remarks ?? "" },
    { new: true },
  );
  if (!updated) throw ApiError.conflict("This application was already reviewed");
  if (entry) {
    await LeaveBalance.updateOne(
      { _id: balanceDoc._id, "balances.type": leave.leaveType },
      { $inc: { "balances.$.used": leave.days } },
    );
  }
  const { applied, conflicts } = await applyLeaveToAttendance(updated, user.id);
  await notifyFaculty(leave.faculty, {
    type: "leave",
    title: "Leave approved",
    message: `Your ${leave.leaveType} leave (${dateKey(leave.startDate)} → ${dateKey(leave.endDate)}) was approved.${updated.reviewRemarks ? ` Remarks: ${updated.reviewRemarks}` : ""}`,
    link: "/leaves",
    emailPref: "emailOnLeaveDecision",
  });
  await audit(req, { action: "APPROVE", module: "leave", recordId: leave._id, description: `Approved ${leave.leaveType} leave (${leave.days} days); ${applied} attendance day(s) marked on leave` });
  sendSuccess(res, updated, {
    message: `Leave approved${conflicts ? `. Note: ${conflicts} day(s) already had present/late attendance and were left unchanged.` : ""}`,
  });
});

export const reject = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const leave = await LeaveApplication.findById(req.params.id);
  if (!leave) throw ApiError.notFound("Leave application not found");
  if (!canReview(user, leave)) throw ApiError.forbidden("You cannot review this leave application");
  const updated = await LeaveApplication.findOneAndUpdate(
    { _id: leave._id, status: "pending" },
    { status: "rejected", reviewedBy: user.id, reviewedAt: new Date(), reviewRemarks: req.body.remarks },
    { new: true },
  );
  if (!updated) throw ApiError.conflict(`This application is already ${leave.status}`);
  await notifyFaculty(leave.faculty, {
    type: "leave",
    title: "Leave rejected",
    message: `Your ${leave.leaveType} leave (${dateKey(leave.startDate)} → ${dateKey(leave.endDate)}) was rejected. Reason: ${req.body.remarks}`,
    link: "/leaves",
    emailPref: "emailOnLeaveDecision",
  });
  await audit(req, { action: "REJECT", module: "leave", recordId: leave._id, description: `Rejected ${leave.leaveType} leave: ${req.body.remarks}` });
  sendSuccess(res, updated, { message: "Leave rejected" });
});

/**
 * Faculty can cancel their own pending requests. Admins can also cancel an approved leave
 * that hasn't started yet; the balance and generated attendance are reverted.
 */
export const cancel = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const leave = await LeaveApplication.findById(req.params.id);
  if (!leave) throw ApiError.notFound("Leave application not found");
  const isOwner = user.facultyId === String(leave.faculty);
  if (leave.status === "pending") {
    if (!isOwner && user.role !== "admin") throw ApiError.forbidden("Only the applicant can cancel this request");
  } else if (leave.status === "approved") {
    if (user.role !== "admin") throw ApiError.forbidden("Only administrators can cancel an approved leave");
    if (leave.startDate <= todayDateOnly()) throw ApiError.badRequest("Leave that has already started cannot be cancelled");
    await LeaveBalance.updateOne(
      { faculty: leave.faculty, academicYear: leave.academicYear, "balances.type": leave.leaveType },
      { $inc: { "balances.$.used": -leave.days } },
    );
    await revertLeaveAttendance(leave._id);
  } else {
    throw ApiError.conflict(`A ${leave.status} application cannot be cancelled`);
  }
  leave.status = "cancelled";
  leave.cancelledAt = new Date();
  await leave.save();
  if (!isOwner) await notifyFaculty(leave.faculty, { type: "leave", title: "Leave cancelled", message: `Your ${leave.leaveType} leave starting ${dateKey(leave.startDate)} was cancelled by an administrator.`, link: "/leaves" });
  await audit(req, { action: "CANCEL", module: "leave", recordId: leave._id, description: `Cancelled ${leave.leaveType} leave (${dateKey(leave.startDate)})` });
  sendSuccess(res, leave, { message: "Leave cancelled" });
});

export const balance = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const q = req.query as Record<string, string | undefined>;
  const facultyId = q.faculty || user.facultyId;
  if (!facultyId) throw ApiError.badRequest("Select a faculty member");
  const faculty = await Faculty.findById(facultyId).select("department").lean();
  if (!faculty) throw ApiError.notFound("Faculty member not found");
  assertFacultyAccess(user, faculty);
  const settings = await getSettings();
  sendSuccess(res, await getLeaveBalance(facultyId, q.academicYear || settings.academicYear));
});

/** Balance overview for every faculty in scope (HOD/admin monitoring). */
export const balances = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const q = req.query as Record<string, string | undefined>;
  const settings = await getSettings();
  const year = q.academicYear || settings.academicYear;
  const dept = resolveDepartment(user, q.department);
  const faculty = await Faculty.find({ isArchived: false, ...(dept ? { department: dept } : {}) })
    .select("facultyId firstName lastName department designation")
    .populate("department", "code")
    .sort({ firstName: 1 })
    .lean();
  const rows = await Promise.all(
    faculty.map(async (f) => ({ faculty: { ...f, fullName: `${f.firstName} ${f.lastName}` }, balances: await getLeaveBalance(String(f._id), year) })),
  );
  sendSuccess(res, rows, { meta: { academicYear: year } });
});

export const updateBalance = asyncHandler(async (req, res) => {
  const { academicYear, balances: entries } = req.body as { academicYear: string; balances: { type: string; allocated: number }[] };
  const doc = await ensureBalanceDoc(req.params.facultyId, academicYear);
  for (const e of entries) {
    const row = doc.balances.find((b) => b.type === e.type);
    if (row) {
      if (e.allocated < row.used) throw ApiError.badRequest(`${e.type}: allocation cannot be below days already used (${row.used})`);
      row.allocated = e.allocated;
    }
  }
  await doc.save();
  await audit(req, { action: "UPDATE", module: "leave", recordId: doc._id, description: `Adjusted leave allocations for faculty ${req.params.facultyId} (${academicYear})` });
  sendSuccess(res, await getLeaveBalance(req.params.facultyId, academicYear), { message: "Leave allocation updated" });
});

export const downloadDocument = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const leave = await LeaveApplication.findById(req.params.id).populate("faculty", "department").lean();
  if (!leave || !leave.document) throw ApiError.notFound("No document attached");
  assertFacultyAccess(user, leave.faculty as unknown as { _id: unknown; department: unknown });
  const file = path.join(env.uploadDir, "documents", path.basename(leave.document));
  if (!fs.existsSync(file)) throw ApiError.notFound("Document file is missing");
  res.download(file, leave.documentName || path.basename(file));
});

