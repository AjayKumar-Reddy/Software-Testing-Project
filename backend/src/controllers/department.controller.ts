import { Types } from "mongoose";
import { Department, Faculty, Subject, Course, Workload, User } from "../models";
import { ApiError, asyncHandler, sendSuccess } from "../utils/http";
import { requireUser } from "../middleware/auth";
import { assertDepartmentAccess } from "../services/scope.service";
import { audit } from "../services/audit.service";
import { aggregateStats } from "../services/attendance.service";
import { getSettings } from "../services/settings.service";
import { notifyFaculty } from "../services/notification.service";
import { subDays } from "date-fns";
import { todayDateOnly } from "../utils/dates";

export const list = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const filter: Record<string, unknown> = {};
  if (user.role !== "admin" && req.query.all !== "true") filter._id = user.departmentId;
  const settings = await getSettings();
  const depts = await Department.find(filter).populate("head", "firstName lastName designation photo facultyId email").sort({ name: 1 }).lean();
  const ids = depts.map((d) => d._id);
  const [facultyCounts, subjectCounts, workloadSums] = await Promise.all([
    Faculty.aggregate([
      { $match: { department: { $in: ids }, isArchived: false } },
      { $group: { _id: "$department", total: { $sum: 1 }, active: { $sum: { $cond: [{ $in: ["$status", ["active", "probation"]] }, 1, 0] } } } },
    ]),
    Subject.aggregate([{ $match: { department: { $in: ids }, academicYear: settings.academicYear } }, { $group: { _id: "$department", n: { $sum: 1 } } }]),
    Workload.aggregate([{ $match: { department: { $in: ids }, academicYear: settings.academicYear } }, { $group: { _id: "$department", hours: { $sum: "$weeklyHours" } } }]),
  ]);
  const find = <T extends { _id: Types.ObjectId }>(arr: T[], id: Types.ObjectId) => arr.find((x) => String(x._id) === String(id));
  sendSuccess(
    res,
    depts.map((d) => ({
      ...d,
      facultyCount: find(facultyCounts, d._id)?.total ?? 0,
      activeFacultyCount: find(facultyCounts, d._id)?.active ?? 0,
      subjectCount: find(subjectCounts, d._id)?.n ?? 0,
      weeklyHours: find(workloadSums, d._id)?.hours ?? 0,
    })),
  );
});

export const getOne = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const dept = await Department.findById(req.params.id).populate("head", "firstName lastName designation photo facultyId email phone").lean();
  if (!dept) throw ApiError.notFound("Department not found");
  assertDepartmentAccess(user, dept._id);
  const settings = await getSettings();
  const since = subDays(todayDateOnly(), 30);
  const [faculty, byDesignation, subjects, courses, attendance, workload] = await Promise.all([
    Faculty.find({ department: dept._id, isArchived: false }).select("facultyId firstName lastName designation status email photo experienceYears").sort({ firstName: 1 }).lean(),
    Faculty.aggregate([{ $match: { department: dept._id, isArchived: false } }, { $group: { _id: "$designation", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    Subject.countDocuments({ department: dept._id, academicYear: settings.academicYear }),
    Course.find({ department: dept._id }).select("name code level").lean(),
    aggregateStats({ department: dept._id, date: { $gte: since } }),
    Workload.aggregate([
      { $match: { department: dept._id, academicYear: settings.academicYear } },
      { $group: { _id: "$faculty", hours: { $sum: "$weeklyHours" } } },
      { $lookup: { from: "faculties", localField: "_id", foreignField: "_id", as: "f" } },
      { $unwind: "$f" },
      { $project: { hours: 1, name: { $concat: ["$f.firstName", " ", "$f.lastName"] } } },
      { $sort: { hours: -1 } },
    ]),
  ]);
  sendSuccess(res, {
    ...dept,
    faculty: faculty.map((f) => ({ ...f, fullName: `${f.firstName} ${f.lastName}` })),
    stats: {
      facultyCount: faculty.length,
      activeCount: faculty.filter((f) => f.status === "active" || f.status === "probation").length,
      byDesignation: byDesignation.map((d) => ({ designation: d._id, count: d.count })),
      subjectCount: subjects,
      courses,
      attendanceLast30Days: attendance,
      workload,
      totalWeeklyHours: workload.reduce((s, w) => s + w.hours, 0),
    },
  });
});

export const create = asyncHandler(async (req, res) => {
  const dept = await Department.create(req.body);
  await audit(req, { action: "CREATE", module: "department", recordId: dept._id, description: `Created department ${dept.code} – ${dept.name}` });
  sendSuccess(res, dept, { status: 201, message: "Department created" });
});

export const update = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const dept = await Department.findById(req.params.id);
  if (!dept) throw ApiError.notFound("Department not found");
  assertDepartmentAccess(user, dept._id);
  const body = { ...req.body };
  if (user.role !== "admin") {
    // HODs may only edit descriptive fields of their own department.
    for (const k of ["name", "code", "isActive", "establishedYear"]) delete body[k];
  }
  dept.set(body);
  await dept.save();
  await audit(req, { action: "UPDATE", module: "department", recordId: dept._id, description: `Updated department ${dept.code}` });
  sendSuccess(res, dept, { message: "Department updated" });
});

export const remove = asyncHandler(async (req, res) => {
  const dept = await Department.findById(req.params.id);
  if (!dept) throw ApiError.notFound("Department not found");
  const [fac, subj, course] = await Promise.all([
    Faculty.countDocuments({ department: dept._id, isArchived: false }),
    Subject.countDocuments({ department: dept._id }),
    Course.countDocuments({ department: dept._id }),
  ]);
  if (fac || subj || course) {
    throw ApiError.conflict(`Cannot delete: department still has ${fac} faculty, ${subj} subjects and ${course} courses. Reassign or remove them first.`);
  }
  await dept.deleteOne();
  await audit(req, { action: "DELETE", module: "department", recordId: dept._id, description: `Deleted department ${dept.code}` });
  sendSuccess(res, null, { message: "Department deleted" });
});

/** Assigns (or clears) a department head and keeps user roles in sync. */
export const assignHead = asyncHandler(async (req, res) => {
  const dept = await Department.findById(req.params.id);
  if (!dept) throw ApiError.notFound("Department not found");
  const { facultyId } = req.body as { facultyId: string | null };
  const previous = dept.head ? String(dept.head) : null;

  if (facultyId) {
    const fac = await Faculty.findById(facultyId);
    if (!fac || fac.isArchived) throw ApiError.badRequest("Faculty member not found");
    if (String(fac.department) !== String(dept._id)) throw ApiError.badRequest("The head must be a member of this department");
    if (!fac.user) throw ApiError.badRequest("This faculty member has no login account");
    const otherDept = await Department.findOne({ head: fac._id, _id: { $ne: dept._id } });
    if (otherDept) throw ApiError.conflict(`Already head of ${otherDept.name}`);
    const linked = await User.findById(fac.user);
    if (linked?.role === "admin") throw ApiError.badRequest("Administrators cannot be department heads");
    await User.updateOne({ _id: fac.user }, { role: "hod" });
    dept.head = fac._id;
    await notifyFaculty(fac._id, { type: "system", title: "Department head appointment", message: `You have been appointed Head of ${dept.name}.`, link: "/dashboard" });
  } else {
    dept.head = null;
  }
  await dept.save();

  if (previous && previous !== facultyId) {
    const prev = await Faculty.findById(previous).select("user").lean();
    if (prev?.user) await User.updateOne({ _id: prev.user, role: "hod" }, { role: "faculty" });
  }
  await audit(req, { action: "ASSIGN_HEAD", module: "department", recordId: dept._id, description: `${facultyId ? "Assigned new head to" : "Cleared head of"} ${dept.code}` });
  const result = await Department.findById(dept._id).populate("head", "firstName lastName designation facultyId").lean();
  sendSuccess(res, result, { message: "Department head updated" });
});

/** Attendance % per department over a recent window (used by charts). */
export const attendanceByDepartment = asyncHandler(async (req, res) => {
  const days = Math.min(365, Number(req.query.days ?? 30));
  const since = subDays(todayDateOnly(), days);
  const depts = await Department.find().select("name code").lean();
  const rows = await Promise.all(depts.map(async (d) => ({ department: d.name, code: d.code, ...(await aggregateStats({ department: d._id, date: { $gte: since } })) })));
  sendSuccess(res, rows);
});

