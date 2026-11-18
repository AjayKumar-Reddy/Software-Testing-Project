import { Types } from "mongoose";
import { Workload, Subject, Faculty } from "../models";
import { ApiError, asyncHandler, sendSuccess, parsePagination, buildMeta } from "../utils/http";
import { requireUser } from "../middleware/auth";
import { resolveDepartment, assertDepartmentAccess } from "../services/scope.service";
import { audit } from "../services/audit.service";
import { notifyFaculty } from "../services/notification.service";
import { getSettings } from "../services/settings.service";
import { facultyWorkloadSummary, termSemesters } from "../services/workload.service";

const POP = [
  { path: "faculty", select: "facultyId firstName lastName designation photo" },
  { path: "subject", select: "name code credits semester type weeklyHours" },
  { path: "course", select: "name code" },
  { path: "department", select: "name code" },
];

async function hoursAfter(facultyId: string, academicYear: string, semester: number, delta: number, excludeId?: string) {
  const sems = termSemesters(semester % 2 === 1 ? "odd" : "even");
  const agg = await Workload.aggregate([
    {
      $match: {
        faculty: new Types.ObjectId(facultyId),
        academicYear,
        semester: { $in: sems },
        ...(excludeId ? { _id: { $ne: new Types.ObjectId(excludeId) } } : {}),
      },
    },
    { $group: { _id: null, h: { $sum: "$weeklyHours" } } },
  ]);
  return (agg[0]?.h ?? 0) + delta;
}

export const list = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const q = req.query as Record<string, string | undefined>;
  const { page, limit, skip } = parsePagination(q, 20);
  const settings = await getSettings();
  const filter: Record<string, unknown> = { academicYear: q.academicYear || settings.academicYear };
  if (user.role === "faculty") filter.faculty = user.facultyId;
  else {
    const dept = resolveDepartment(user, q.department);
    if (dept) filter.department = dept;
    if (q.faculty) filter.faculty = q.faculty;
  }
  const sems = termSemesters(q.term);
  if (q.semester) filter.semester = Number(q.semester);
  else if (sems) filter.semester = { $in: sems };
  const [items, total, totals] = await Promise.all([
    Workload.find(filter).populate(POP).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Workload.countDocuments(filter),
    Workload.aggregate([{ $match: { ...filter, ...(filter.faculty ? { faculty: new Types.ObjectId(String(filter.faculty)) } : {}), ...(filter.department ? { department: new Types.ObjectId(String(filter.department)) } : {}) } }, { $group: { _id: null, hours: { $sum: "$weeklyHours" } } }]),
  ]);
  sendSuccess(res, items, { meta: { ...buildMeta(page, limit, total), totalHours: totals[0]?.hours ?? 0 } });
});

export const summary = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const q = req.query as Record<string, string | undefined>;
  const settings = await getSettings();
  const academicYear = q.academicYear || settings.academicYear;
  const term = q.term ?? settings.currentSemester.toLowerCase();
  let department: string | undefined;
  if (user.role === "faculty") department = user.departmentId ?? undefined;
  else department = resolveDepartment(user, q.department);
  const data = await facultyWorkloadSummary({ academicYear, term, department });
  const rows = user.role === "faculty" ? data.rows.filter((r) => String(r.faculty._id) === user.facultyId) : data.rows;

  // Department totals
  const deptMap = new Map<string, { department: string; code: string; hours: number; faculty: number; overloaded: number; underutilized: number }>();
  for (const r of data.rows) {
    const d = r.faculty.department as unknown as { _id: Types.ObjectId; name: string; code: string };
    const key = String(d._id);
    const cur = deptMap.get(key) ?? { department: d.name, code: d.code, hours: 0, faculty: 0, overloaded: 0, underutilized: 0 };
    cur.hours += r.hours;
    cur.faculty += 1;
    if (r.status === "overloaded") cur.overloaded++;
    if (r.status === "underutilized") cur.underutilized++;
    deptMap.set(key, cur);
  }
  sendSuccess(res, {
    academicYear,
    term,
    limits: data.limits,
    rows,
    departments: user.role === "faculty" ? [] : [...deptMap.values()].map((d) => ({ ...d, average: d.faculty ? Math.round((d.hours / d.faculty) * 10) / 10 : 0 })),
    totals: {
      faculty: rows.length,
      hours: rows.reduce((s, r) => s + r.hours, 0),
      overloaded: rows.filter((r) => r.status === "overloaded").length,
      underutilized: rows.filter((r) => r.status === "underutilized").length,
      optimal: rows.filter((r) => r.status === "optimal").length,
    },
  });
});

export const create = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const settings = await getSettings();
  const body = req.body as { faculty: string; subject: string; weeklyHours: number; type?: string; section?: string; academicYear?: string; notes?: string };
  const [subject, faculty] = await Promise.all([Subject.findById(body.subject).lean(), Faculty.findById(body.faculty).select("firstName lastName department status isArchived").lean()]);
  if (!subject) throw ApiError.badRequest("Subject not found");
  if (!faculty || faculty.isArchived || !["active", "probation"].includes(faculty.status)) throw ApiError.badRequest("Faculty member is not active");
  assertDepartmentAccess(user, subject.department);
  const academicYear = body.academicYear || subject.academicYear || settings.academicYear;

  const projected = await hoursAfter(body.faculty, academicYear, subject.semester, body.weeklyHours);
  const max = settings.workload?.maxWeeklyHours ?? 18;

  const wl = await Workload.create({
    faculty: body.faculty,
    subject: subject._id,
    course: subject.course,
    department: subject.department,
    semester: subject.semester,
    academicYear,
    weeklyHours: body.weeklyHours,
    type: body.type ?? (subject.type === "lab" ? "lab" : "lecture"),
    section: body.section ?? "A",
    notes: body.notes ?? "",
    assignedBy: user.id,
  });
  await Subject.updateOne({ _id: subject._id }, { $addToSet: { assignedFaculty: body.faculty } });
  await notifyFaculty(body.faculty, {
    type: "workload",
    title: "New workload allocation",
    message: `${subject.code} – ${subject.name}: ${body.weeklyHours} hrs/week (${wl.type}, section ${wl.section}).`,
    link: "/workload",
    emailPref: "emailOnWorkload",
  });
  await audit(req, { action: "CREATE", module: "workload", recordId: wl._id, description: `Allocated ${subject.code} (${body.weeklyHours} hrs) to ${faculty.firstName} ${faculty.lastName}` });
  const warning = projected > max ? `${faculty.firstName} ${faculty.lastName} now has ${projected} hrs/week, above the ${max} hr limit.` : undefined;
  sendSuccess(res, { workload: await Workload.findById(wl._id).populate(POP).lean(), warning, projectedHours: projected }, { status: 201, message: warning ? "Allocated – workload limit exceeded" : "Workload allocated" });
});

export const update = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const wl = await Workload.findById(req.params.id);
  if (!wl) throw ApiError.notFound("Workload allocation not found");
  assertDepartmentAccess(user, wl.department);
  const { weeklyHours, type, section, notes } = req.body as { weeklyHours?: number; type?: string; section?: string; notes?: string };
  wl.set({ ...(weeklyHours !== undefined ? { weeklyHours } : {}), ...(type ? { type } : {}), ...(section ? { section } : {}), ...(notes !== undefined ? { notes } : {}) });
  await wl.save();
  const settings = await getSettings();
  const projected = await hoursAfter(String(wl.faculty), wl.academicYear, wl.semester, 0);
  await notifyFaculty(wl.faculty, { type: "workload", title: "Workload updated", message: `One of your allocations was updated to ${wl.weeklyHours} hrs/week.`, link: "/workload" });
  await audit(req, { action: "UPDATE", module: "workload", recordId: wl._id, description: `Updated workload allocation (${wl.weeklyHours} hrs)` });
  const warning = projected > (settings.workload?.maxWeeklyHours ?? 18) ? `Total is now ${projected} hrs/week, above the limit.` : undefined;
  sendSuccess(res, { workload: await Workload.findById(wl._id).populate(POP).lean(), warning }, { message: "Workload updated" });
});

export const remove = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const wl = await Workload.findById(req.params.id);
  if (!wl) throw ApiError.notFound("Workload allocation not found");
  assertDepartmentAccess(user, wl.department);
  await wl.deleteOne();
  // Unassign from the subject if no other allocation for that subject remains.
  if (!(await Workload.exists({ faculty: wl.faculty, subject: wl.subject }))) {
    await Subject.updateOne({ _id: wl.subject }, { $pull: { assignedFaculty: wl.faculty } });
  }
  await notifyFaculty(wl.faculty, { type: "workload", title: "Workload allocation removed", message: `An allocation of ${wl.weeklyHours} hrs/week was removed.`, link: "/workload" });
  await audit(req, { action: "DELETE", module: "workload", recordId: wl._id, description: `Removed workload allocation (${wl.weeklyHours} hrs)` });
  sendSuccess(res, null, { message: "Allocation removed" });
});

