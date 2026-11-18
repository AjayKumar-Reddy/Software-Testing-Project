import crypto from "crypto";
import path from "path";
import fs from "fs";
import { Types } from "mongoose";
import { Faculty, User, Department, Subject, Workload, Timetable, Attendance, LeaveApplication, nextSequence } from "../models";
import { ApiError, asyncHandler, sendSuccess, parsePagination, buildMeta, parseSort, escapeRegex } from "../utils/http";
import { requireUser } from "../middleware/auth";
import { resolveDepartment, assertFacultyAccess, assertDepartmentAccess } from "../services/scope.service";
import { audit } from "../services/audit.service";
import { sendEmail } from "../services/email.service";
import { aggregateStats } from "../services/attendance.service";
import { getLeaveBalance } from "../services/leave.service";
import { getSettings } from "../services/settings.service";
import { SELF_EDITABLE_FIELDS } from "../validators/faculty.validator";
import { env } from "../config/env";
import { toDateOnly } from "../utils/dates";

const POPULATE_DEPT = { path: "department", select: "name code head" };

async function generateFacultyId(): Promise<string> {
  // Loop guards against collisions with manually-entered IDs.
  for (;;) {
    const seq = await nextSequence("facultyId");
    const id = `FAC${String(seq).padStart(4, "0")}`;
    if (!(await Faculty.exists({ facultyId: id }))) return id;
  }
}

function tempPassword() {
  return `Fh${crypto.randomBytes(4).toString("hex")}9!`;
}

async function assertEmailFree(email: string, excludeFacultyId?: string, excludeUserId?: string) {
  const facClash = await Faculty.findOne({ email, ...(excludeFacultyId ? { _id: { $ne: excludeFacultyId } } : {}) }).select("_id").lean();
  const userClash = await User.findOne({ email, ...(excludeUserId ? { _id: { $ne: excludeUserId } } : {}) }).select("_id").lean();
  if (facClash || userClash) throw ApiError.conflict("A faculty member or user with this email already exists");
}

export const list = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const q = req.query as Record<string, string | undefined>;
  const { page, limit, skip } = parsePagination(q);
  const filter: Record<string, unknown> = {};
  const dept = resolveDepartment(user, q.department);
  if (dept) filter.department = dept;
  if (q.archived === "true") filter.isArchived = true;
  else if (q.archived !== "all") filter.isArchived = false;
  if (q.designation) filter.designation = q.designation;
  if (q.status) filter.status = q.status;
  if (q.employmentType) filter.employmentType = q.employmentType;
  if (q.search) {
    const rx = new RegExp(escapeRegex(q.search), "i");
    filter.$or = [{ firstName: rx }, { lastName: rx }, { email: rx }, { facultyId: rx }, { specialization: rx }, { phone: rx }];
  }
  const sort = parseSort(q.sort, ["firstName", "lastName", "facultyId", "dateOfJoining", "experienceYears", "createdAt", "designation"], "-createdAt");
  const [items, total] = await Promise.all([
    Faculty.find(filter).populate(POPULATE_DEPT).populate("user", "role isActive lastLoginAt").sort(sort).skip(skip).limit(limit).lean({ virtuals: true }),
    Faculty.countDocuments(filter),
  ]);
  sendSuccess(res, items.map((f) => ({ ...f, fullName: `${f.firstName} ${f.lastName}` })), { meta: buildMeta(page, limit, total) });
});

/** Lightweight list for dropdowns. */
export const options = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const q = req.query as Record<string, string | undefined>;
  const filter: Record<string, unknown> = { isArchived: false, status: { $in: ["active", "probation", "on_sabbatical"] } };
  if (user.role === "faculty") filter._id = user.facultyId;
  else {
    const dept = resolveDepartment(user, q.department);
    if (dept) filter.department = dept;
  }
  const items = await Faculty.find(filter).select("facultyId firstName lastName department designation photo").populate("department", "name code").sort({ firstName: 1 }).lean();
  sendSuccess(res, items.map((f) => ({ ...f, fullName: `${f.firstName} ${f.lastName}` })));
});

export const getOne = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const id = req.params.id === "me" ? user.facultyId : req.params.id;
  if (!id) throw ApiError.notFound("No faculty profile is linked to your account");
  const faculty = await Faculty.findById(id).populate(POPULATE_DEPT).populate("user", "role isActive lastLoginAt email").populate("courses", "name code").lean({ virtuals: true });
  if (!faculty) throw ApiError.notFound("Faculty member not found");
  assertFacultyAccess(user, faculty);

  const settings = await getSettings();
  const dept = faculty.department as unknown as { _id: Types.ObjectId; head?: Types.ObjectId } | null;
  const [subjects, workloadAgg, attendance, leaveBalance, reportingHead] = await Promise.all([
    Subject.find({ assignedFaculty: faculty._id, academicYear: settings.academicYear }).select("name code semester credits type").lean(),
    Workload.aggregate([{ $match: { faculty: faculty._id, academicYear: settings.academicYear } }, { $group: { _id: null, hours: { $sum: "$weeklyHours" } } }]),
    aggregateStats({ faculty: faculty._id }),
    getLeaveBalance(String(faculty._id), settings.academicYear),
    dept?.head && String(dept.head) !== String(faculty._id)
      ? Faculty.findById(dept.head).select("firstName lastName designation email facultyId").lean()
      : null,
  ]);

  sendSuccess(res, {
    ...faculty,
    fullName: `${faculty.firstName} ${faculty.lastName}`,
    reportingHead: reportingHead ? { ...reportingHead, fullName: `${reportingHead.firstName} ${reportingHead.lastName}` } : null,
    stats: {
      subjects,
      weeklyHours: workloadAgg[0]?.hours ?? 0,
      attendance,
      leaveBalance,
    },
  });
});

export const teachingHistory = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const id = req.params.id === "me" ? user.facultyId : req.params.id;
  const faculty = await Faculty.findById(id).select("department").lean();
  if (!faculty) throw ApiError.notFound("Faculty member not found");
  assertFacultyAccess(user, faculty);
  const rows = await Workload.find({ faculty: faculty._id })
    .populate("subject", "name code credits semester type")
    .populate("course", "name code")
    .sort({ academicYear: -1, semester: 1 })
    .lean();
  const grouped: Record<string, { academicYear: string; totalHours: number; items: typeof rows }> = {};
  for (const r of rows) {
    grouped[r.academicYear] ??= { academicYear: r.academicYear, totalHours: 0, items: [] };
    grouped[r.academicYear].items.push(r);
    grouped[r.academicYear].totalHours += r.weeklyHours;
  }
  sendSuccess(res, Object.values(grouped));
});

export const create = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const body = req.body as Record<string, any>;
  assertDepartmentAccess(user, body.department);
  if (!(await Department.exists({ _id: body.department }))) throw ApiError.badRequest("Department does not exist");
  const settings = await getSettings();
  if (!settings.designations.includes(body.designation)) throw ApiError.badRequest("Unknown designation. Add it in Settings first.");

  await assertEmailFree(body.email);
  let facultyId = body.facultyId as string | undefined;
  if (facultyId) {
    if (await Faculty.exists({ facultyId })) throw ApiError.conflict("This Faculty ID is already in use");
  } else facultyId = await generateFacultyId();

  const { createAccount, password, ...data } = body;
  const faculty = await Faculty.create({
    ...data,
    facultyId,
    dateOfBirth: data.dateOfBirth ? toDateOnly(data.dateOfBirth) : undefined,
    dateOfJoining: toDateOnly(data.dateOfJoining),
  });

  let temporaryPassword: string | undefined;
  if (createAccount !== false) {
    const pwd = password || tempPassword();
    try {
      const account = await User.create({ name: `${faculty.firstName} ${faculty.lastName}`, email: faculty.email, password: pwd, role: "faculty", faculty: faculty._id });
      faculty.user = account._id;
      await faculty.save();
    } catch (err) {
      await Faculty.deleteOne({ _id: faculty._id }); // keep the two collections consistent
      throw err;
    }
    if (!password) temporaryPassword = pwd;
    await sendEmail(
      faculty.email,
      "Your FacultyHub account",
      `Welcome to FacultyHub, ${faculty.firstName}!\n\nSign in at ${env.clientUrls[0]}/login with:\nEmail: ${faculty.email}${temporaryPassword ? `\nTemporary password: ${temporaryPassword}` : ""}\n\nPlease change your password after signing in.`,
    );
  }
  await audit(req, { action: "CREATE", module: "faculty", recordId: faculty._id, description: `Created faculty ${faculty.facultyId} – ${faculty.firstName} ${faculty.lastName}` });
  const result = await Faculty.findById(faculty._id).populate(POPULATE_DEPT).lean({ virtuals: true });
  sendSuccess(res, { faculty: result, temporaryPassword }, { status: 201, message: "Faculty member created" });
});

export const update = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const faculty = await Faculty.findById(req.params.id);
  if (!faculty) throw ApiError.notFound("Faculty member not found");
  assertFacultyAccess(user, faculty);
  let body = req.body as Record<string, any>;

  // Faculty (and HODs editing their own record) may only change self-service fields.
  const isSelfEdit = user.role === "faculty" || (user.role === "hod" && String(faculty._id) === user.facultyId);
  if (isSelfEdit) {
    body = Object.fromEntries(Object.entries(body).filter(([k]) => (SELF_EDITABLE_FIELDS as readonly string[]).includes(k)));
  } else {
    if (body.department && String(body.department) !== String(faculty.department)) {
      if (user.role !== "admin") throw ApiError.forbidden("Only administrators can move faculty between departments");
      if (!(await Department.exists({ _id: body.department }))) throw ApiError.badRequest("Department does not exist");
      // A department head cannot be moved out without first reassigning the head.
      if (await Department.exists({ head: faculty._id, _id: faculty.department })) {
        throw ApiError.conflict("This faculty member is the head of their department. Assign a new head first.");
      }
    }
    if (body.designation) {
      const settings = await getSettings();
      if (!settings.designations.includes(body.designation)) throw ApiError.badRequest("Unknown designation");
    }
    if (body.facultyId && body.facultyId !== faculty.facultyId) {
      if (user.role !== "admin") throw ApiError.forbidden("Only administrators can change Faculty IDs");
      if (await Faculty.exists({ facultyId: body.facultyId, _id: { $ne: faculty._id } })) throw ApiError.conflict("This Faculty ID is already in use");
    } else delete body.facultyId;
    if (body.email && body.email !== faculty.email) await assertEmailFree(body.email, String(faculty._id), faculty.user ? String(faculty.user) : undefined);
  }

  if (body.dateOfBirth) body.dateOfBirth = toDateOnly(body.dateOfBirth);
  if (body.dateOfJoining) body.dateOfJoining = toDateOnly(body.dateOfJoining);
  if (body.address) body.address = { ...((faculty.toObject().address as object) ?? {}), ...body.address };
  if (body.emergencyContact) body.emergencyContact = { ...((faculty.toObject().emergencyContact as object) ?? {}), ...body.emergencyContact };

  const deptChanged = body.department && String(body.department) !== String(faculty.department);
  faculty.set(body);
  await faculty.save();

  if (faculty.user) {
    await User.updateOne({ _id: faculty.user }, { name: `${faculty.firstName} ${faculty.lastName}`, email: faculty.email });
  }
  if (deptChanged) {
    await Attendance.updateMany({ faculty: faculty._id, date: { $gte: toDateOnly(new Date()) } }, { department: faculty.department });
  }
  await audit(req, { action: "UPDATE", module: "faculty", recordId: faculty._id, description: `Updated faculty ${faculty.facultyId}${isSelfEdit ? " (self-service profile)" : ""}` });
  const result = await Faculty.findById(faculty._id).populate(POPULATE_DEPT).lean({ virtuals: true });
  sendSuccess(res, result, { message: "Profile updated" });
});

export const setStatus = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const faculty = await Faculty.findById(req.params.id);
  if (!faculty) throw ApiError.notFound("Faculty member not found");
  assertFacultyAccess(user, faculty);
  if (user.facultyId === String(faculty._id)) throw ApiError.badRequest("You cannot change your own employment status");
  const { status } = req.body as { status: string };
  faculty.status = status as typeof faculty.status;
  await faculty.save();
  const deactivate = ["inactive", "resigned", "retired"].includes(status);
  if (faculty.user) await User.updateOne({ _id: faculty.user }, { isActive: !deactivate });
  await audit(req, {
    action: deactivate ? "DEACTIVATE" : "STATUS_CHANGE",
    module: "faculty",
    recordId: faculty._id,
    description: `Set ${faculty.facultyId} status to ${status}${deactivate ? " (login disabled)" : ""}`,
  });
  sendSuccess(res, faculty, { message: `Status updated to ${status.replace("_", " ")}` });
});

/** Soft delete (archive). Use ?permanent=true to hard-delete a record without dependencies. */
export const remove = asyncHandler(async (req, res) => {
  const faculty = await Faculty.findById(req.params.id);
  if (!faculty) throw ApiError.notFound("Faculty member not found");
  if (req.user?.facultyId === String(faculty._id)) throw ApiError.badRequest("You cannot archive your own record");
  if (await Department.exists({ head: faculty._id })) throw ApiError.conflict("This faculty member is a department head. Assign a new head first.");

  if (req.query.permanent === "true") {
    const deps = await Promise.all([
      Workload.exists({ faculty: faculty._id }),
      Timetable.exists({ faculty: faculty._id }),
      Attendance.exists({ faculty: faculty._id }),
      LeaveApplication.exists({ faculty: faculty._id }),
    ]);
    if (deps.some(Boolean)) throw ApiError.conflict("This record has attendance, leave, workload or timetable history. Archive it instead.");
    await Subject.updateMany({ assignedFaculty: faculty._id }, { $pull: { assignedFaculty: faculty._id } });
    if (faculty.user) await User.deleteOne({ _id: faculty.user });
    await faculty.deleteOne();
    await audit(req, { action: "DELETE", module: "faculty", recordId: faculty._id, description: `Permanently deleted ${faculty.facultyId}` });
    return sendSuccess(res, null, { message: "Faculty record deleted" });
  }

  faculty.isArchived = true;
  faculty.archivedAt = new Date();
  faculty.status = "inactive";
  await faculty.save();
  if (faculty.user) await User.updateOne({ _id: faculty.user }, { isActive: false });
  await Timetable.deleteMany({ faculty: faculty._id });
  await audit(req, { action: "ARCHIVE", module: "faculty", recordId: faculty._id, description: `Archived ${faculty.facultyId} – ${faculty.firstName} ${faculty.lastName}` });
  sendSuccess(res, null, { message: "Faculty archived and login disabled" });
});

export const restore = asyncHandler(async (req, res) => {
  const faculty = await Faculty.findById(req.params.id);
  if (!faculty) throw ApiError.notFound("Faculty member not found");
  faculty.isArchived = false;
  faculty.archivedAt = undefined;
  faculty.status = "active";
  await faculty.save();
  if (faculty.user) await User.updateOne({ _id: faculty.user }, { isActive: true });
  await audit(req, { action: "RESTORE", module: "faculty", recordId: faculty._id, description: `Restored ${faculty.facultyId}` });
  sendSuccess(res, faculty, { message: "Faculty restored" });
});

export const uploadPhoto = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const id = req.params.id === "me" ? user.facultyId : req.params.id;
  const faculty = await Faculty.findById(id);
  if (!faculty) throw ApiError.notFound("Faculty member not found");
  assertFacultyAccess(user, faculty);
  if (!req.file) throw ApiError.badRequest("No image uploaded");
  if (faculty.photo?.startsWith("/uploads/avatars/")) {
    fs.promises.unlink(path.join(env.uploadDir, "avatars", path.basename(faculty.photo))).catch(() => undefined);
  }
  faculty.photo = `/uploads/avatars/${req.file.filename}`;
  await faculty.save();
  await audit(req, { action: "UPDATE", module: "faculty", recordId: faculty._id, description: `Updated profile photo for ${faculty.facultyId}` });
  sendSuccess(res, { photo: faculty.photo }, { message: "Photo updated" });
});
