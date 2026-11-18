import { Types } from "mongoose";
import { Subject, Department, Course, Faculty, Workload, Timetable } from "../models";
import { ApiError, asyncHandler, sendSuccess, parsePagination, buildMeta, escapeRegex, parseSort } from "../utils/http";
import { requireUser } from "../middleware/auth";
import { resolveDepartment, assertDepartmentAccess } from "../services/scope.service";
import { audit } from "../services/audit.service";
import { notifyFaculty } from "../services/notification.service";
import type { AuthUser } from "../types";

async function validateRefs(body: Record<string, any>) {
  if (!(await Department.exists({ _id: body.department }))) throw ApiError.badRequest("Department does not exist");
  if (body.course) {
    const course = await Course.findById(body.course).lean();
    if (!course) throw ApiError.badRequest("Course does not exist");
    if (String(course.department) !== String(body.department)) throw ApiError.badRequest("Course belongs to a different department");
    if (body.semester > course.totalSemesters) throw ApiError.badRequest(`This course only has ${course.totalSemesters} semesters`);
  }
  if (body.assignedFaculty?.length) {
    const count = await Faculty.countDocuments({ _id: { $in: body.assignedFaculty }, isArchived: false });
    if (count !== new Set(body.assignedFaculty.map(String)).size) throw ApiError.badRequest("One or more assigned faculty were not found");
  }
}

function buildFilter(user: AuthUser, q: Record<string, string | undefined>) {
  const filter: Record<string, unknown> = {};
  if (user.role === "faculty" && q.mine !== "false") filter.assignedFaculty = new Types.ObjectId(user.facultyId!);
  else if (user.role !== "faculty") {
    const dept = resolveDepartment(user, q.department);
    if (dept) filter.department = new Types.ObjectId(dept);
  }
  if (q.semester) filter.semester = Number(q.semester);
  if (q.academicYear) filter.academicYear = q.academicYear;
  if (q.course) filter.course = new Types.ObjectId(q.course);
  if (q.type) filter.type = q.type;
  if (q.faculty) filter.assignedFaculty = new Types.ObjectId(q.faculty);
  if (q.allocation === "allocated") filter["assignedFaculty.0"] = { $exists: true };
  if (q.allocation === "unallocated") filter["assignedFaculty.0"] = { $exists: false };
  if (q.search) {
    const rx = new RegExp(escapeRegex(q.search), "i");
    filter.$or = [{ name: rx }, { code: rx }];
  }
  return filter;
}

export const list = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const q = req.query as Record<string, string | undefined>;
  const { page, limit, skip } = parsePagination(q, 20);
  const filter = buildFilter(user, q);
  const sort = parseSort(q.sort, ["name", "code", "semester", "credits", "createdAt"], "code");
  const [items, total] = await Promise.all([
    Subject.find(filter)
      .populate("department", "name code")
      .populate("course", "name code")
      .populate("assignedFaculty", "firstName lastName facultyId designation photo")
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    Subject.countDocuments(filter),
  ]);
  sendSuccess(res, items, { meta: buildMeta(page, limit, total) });
});

/** Subject allocation view: each subject with its faculty and allocated workload hours. */
export const allocation = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const q = req.query as Record<string, string | undefined>;
  const filter = buildFilter(user, q);
  const subjects = await Subject.find(filter)
    .populate("department", "name code")
    .populate("course", "name code")
    .populate("assignedFaculty", "firstName lastName facultyId designation")
    .sort({ semester: 1, code: 1 })
    .lean();
  const hours = await Workload.aggregate([
    { $match: { subject: { $in: subjects.map((s) => s._id) } } },
    { $group: { _id: { subject: "$subject", faculty: "$faculty" }, hours: { $sum: "$weeklyHours" } } },
  ]);
  const data = subjects.map((s) => {
    const allocatedHours = hours.filter((h) => String(h._id.subject) === String(s._id)).reduce((a, h) => a + h.hours, 0);
    return {
      ...s,
      allocatedHours,
      facultyHours: (s.assignedFaculty as unknown as { _id: Types.ObjectId }[]).map((f) => ({
        faculty: f._id,
        hours: hours.find((h) => String(h._id.subject) === String(s._id) && String(h._id.faculty) === String(f._id))?.hours ?? 0,
      })),
      status: s.assignedFaculty.length === 0 ? "unallocated" : allocatedHours < (s.weeklyHours ?? 0) ? "partial" : "allocated",
    };
  });
  const summary = {
    total: data.length,
    allocated: data.filter((d) => d.status === "allocated").length,
    partial: data.filter((d) => d.status === "partial").length,
    unallocated: data.filter((d) => d.status === "unallocated").length,
  };
  sendSuccess(res, data, { meta: summary });
});

export const getOne = asyncHandler(async (req, res) => {
  const subject = await Subject.findById(req.params.id)
    .populate("department", "name code")
    .populate("course", "name code")
    .populate("assignedFaculty", "firstName lastName facultyId designation photo")
    .lean();
  if (!subject) throw ApiError.notFound("Subject not found");
  sendSuccess(res, subject);
});

export const create = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  assertDepartmentAccess(user, req.body.department);
  await validateRefs(req.body);
  const subject = await Subject.create(req.body);
  await audit(req, { action: "CREATE", module: "subject", recordId: subject._id, description: `Created subject ${subject.code} – ${subject.name}` });
  sendSuccess(res, subject, { status: 201, message: "Subject created" });
});

export const update = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const subject = await Subject.findById(req.params.id);
  if (!subject) throw ApiError.notFound("Subject not found");
  assertDepartmentAccess(user, subject.department);
  const merged = { ...subject.toObject(), ...req.body };
  assertDepartmentAccess(user, merged.department);
  await validateRefs(merged);
  if (req.body.assignedFaculty) await assertRemovable(subject._id, subject.assignedFaculty.map(String), req.body.assignedFaculty);
  subject.set(req.body);
  await subject.save();
  await audit(req, { action: "UPDATE", module: "subject", recordId: subject._id, description: `Updated subject ${subject.code}` });
  sendSuccess(res, subject, { message: "Subject updated" });
});

/** Faculty with workload or timetable entries for a subject can't be silently unassigned. */
async function assertRemovable(subjectId: unknown, current: string[], next: string[]) {
  const removed = current.filter((id) => !next.map(String).includes(id));
  if (!removed.length) return;
  const busy = await Workload.findOne({ subject: subjectId, faculty: { $in: removed } }).populate("faculty", "firstName lastName").lean();
  if (busy) {
    const f = busy.faculty as unknown as { firstName: string; lastName: string };
    throw ApiError.conflict(`${f.firstName} ${f.lastName} has workload allocated for this subject. Remove the workload first.`);
  }
}

export const assignFaculty = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const subject = await Subject.findById(req.params.id);
  if (!subject) throw ApiError.notFound("Subject not found");
  assertDepartmentAccess(user, subject.department);
  const ids = [...new Set((req.body.facultyIds as string[]).map(String))];
  const found = await Faculty.find({ _id: { $in: ids }, isArchived: false }).select("_id").lean();
  if (found.length !== ids.length) throw ApiError.badRequest("One or more faculty members were not found");
  const before = subject.assignedFaculty.map(String);
  await assertRemovable(subject._id, before, ids);
  subject.assignedFaculty = ids.map((id) => new Types.ObjectId(id));
  await subject.save();
  for (const id of ids.filter((i) => !before.includes(i))) {
    await notifyFaculty(id, { type: "workload", title: "New subject assigned", message: `You have been assigned ${subject.code} – ${subject.name}.`, link: "/subjects", emailPref: "emailOnWorkload" });
  }
  await audit(req, { action: "ASSIGN", module: "subject", recordId: subject._id, description: `Assigned ${ids.length} faculty to ${subject.code}` });
  const result = await Subject.findById(subject._id).populate("assignedFaculty", "firstName lastName facultyId designation").lean();
  sendSuccess(res, result, { message: "Faculty assignment updated" });
});

export const remove = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const subject = await Subject.findById(req.params.id);
  if (!subject) throw ApiError.notFound("Subject not found");
  assertDepartmentAccess(user, subject.department);
  const [w, t] = await Promise.all([Workload.countDocuments({ subject: subject._id }), Timetable.countDocuments({ subject: subject._id })]);
  if (w || t) throw ApiError.conflict(`Cannot delete: subject has ${w} workload allocation(s) and ${t} timetable entr${t === 1 ? "y" : "ies"}`);
  await subject.deleteOne();
  await audit(req, { action: "DELETE", module: "subject", recordId: subject._id, description: `Deleted subject ${subject.code}` });
  sendSuccess(res, null, { message: "Subject deleted" });
});
