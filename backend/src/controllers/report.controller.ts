import { Types } from "mongoose";
import { format } from "date-fns";
import { Faculty, Department, Attendance, LeaveApplication, Subject, Workload } from "../models";
import { ApiError, asyncHandler } from "../utils/http";
import { requireUser } from "../middleware/auth";
import { resolveDepartment } from "../services/scope.service";
import { getSettings } from "../services/settings.service";
import { percentageOf } from "../services/attendance.service";
import { facultyWorkloadSummary } from "../services/workload.service";
import { sendReport, type Report } from "../services/export.service";
import { audit } from "../services/audit.service";
import { toDateOnly, dateKey } from "../utils/dates";
import type { AuthUser } from "../types";

export const REPORT_TYPES = ["faculty-directory", "department-summary", "attendance", "leave", "workload", "subject-allocation", "employment-status"] as const;
type ReportType = (typeof REPORT_TYPES)[number];
const FACULTY_ALLOWED: ReportType[] = ["attendance", "leave", "workload"];

const label = (s?: string | null) => (s ? s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "");
const d = (v?: Date | null) => (v ? format(v, "dd MMM yyyy") : "");

interface Ctx {
  user: AuthUser;
  department?: string;
  faculty?: string;
  from?: Date;
  to?: Date;
  status?: string;
  academicYear: string;
  term?: string;
}

function facultyMatch(ctx: Ctx) {
  const m: Record<string, unknown> = { isArchived: false };
  if (ctx.department) m.department = new Types.ObjectId(ctx.department);
  if (ctx.faculty) m._id = new Types.ObjectId(ctx.faculty);
  return m;
}

const builders: Record<ReportType, (ctx: Ctx) => Promise<Report>> = {
  "faculty-directory": async (ctx) => {
    const m = facultyMatch(ctx);
    if (ctx.status) m.status = ctx.status;
    const rows = await Faculty.find(m).populate("department", "code name").sort({ facultyId: 1 }).lean();
    return {
      title: "Faculty Directory",
      columns: [
        { key: "facultyId", label: "Faculty ID", width: 0.8 },
        { key: "name", label: "Name", width: 1.4 },
        { key: "department", label: "Dept", width: 0.6 },
        { key: "designation", label: "Designation", width: 1.3 },
        { key: "email", label: "Email", width: 1.8 },
        { key: "phone", label: "Phone", width: 1 },
        { key: "qualification", label: "Qualification", width: 1 },
        { key: "experience", label: "Exp (yrs)", width: 0.6 },
        { key: "joined", label: "Joined", width: 0.9 },
        { key: "status", label: "Status", width: 0.7 },
      ],
      rows: rows.map((f) => ({
        facultyId: f.facultyId,
        name: `${f.firstName} ${f.lastName}`,
        department: (f.department as unknown as { code: string })?.code ?? "",
        designation: f.designation,
        email: f.email,
        phone: f.phone ?? "",
        qualification: f.qualification ?? "",
        experience: f.experienceYears ?? 0,
        joined: d(f.dateOfJoining),
        status: label(f.status),
      })),
      summary: [
        { label: "Total faculty", value: rows.length },
        { label: "Active", value: rows.filter((f) => f.status === "active").length },
        { label: "Avg experience (yrs)", value: rows.length ? (rows.reduce((a, f) => a + (f.experienceYears ?? 0), 0) / rows.length).toFixed(1) : 0 },
      ],
    };
  },

  "department-summary": async (ctx) => {
    const depts = await Department.find(ctx.department ? { _id: ctx.department } : {}).populate("head", "firstName lastName").sort({ code: 1 }).lean();
    const rows = await Promise.all(
      depts.map(async (dep) => {
        const [total, active, subjects, wl, att] = await Promise.all([
          Faculty.countDocuments({ department: dep._id, isArchived: false }),
          Faculty.countDocuments({ department: dep._id, isArchived: false, status: { $in: ["active", "probation"] } }),
          Subject.countDocuments({ department: dep._id, academicYear: ctx.academicYear }),
          Workload.aggregate([{ $match: { department: dep._id, academicYear: ctx.academicYear } }, { $group: { _id: null, h: { $sum: "$weeklyHours" } } }]),
          Attendance.aggregate([
            { $match: { department: dep._id, ...(ctx.from || ctx.to ? { date: { ...(ctx.from ? { $gte: ctx.from } : {}), ...(ctx.to ? { $lte: ctx.to } : {}) } } : {}) } },
            { $group: { _id: "$status", n: { $sum: 1 } } },
          ]),
        ]);
        const g = (k: string) => att.find((a) => a._id === k)?.n ?? 0;
        const tot = g("present") + g("late") + g("absent") + g("on_leave");
        const pct = percentageOf(g("present"), g("late"), tot, g("on_leave"));
        const head = dep.head as unknown as { firstName: string; lastName: string } | null;
        return {
          code: dep.code,
          name: dep.name,
          head: head ? `${head.firstName} ${head.lastName}` : "—",
          total,
          active,
          subjects,
          hours: wl[0]?.h ?? 0,
          attendance: pct === null ? "—" : `${pct}%`,
        };
      }),
    );
    return {
      title: "Department-wise Faculty Report",
      subtitle: ctx.academicYear,
      columns: [
        { key: "code", label: "Code", width: 0.6 },
        { key: "name", label: "Department", width: 2 },
        { key: "head", label: "Head", width: 1.4 },
        { key: "total", label: "Faculty", width: 0.6 },
        { key: "active", label: "Active", width: 0.6 },
        { key: "subjects", label: "Subjects", width: 0.6 },
        { key: "hours", label: "Weekly Hrs", width: 0.7 },
        { key: "attendance", label: "Attendance", width: 0.7 },
      ],
      rows,
      summary: [
        { label: "Departments", value: rows.length },
        { label: "Total faculty", value: rows.reduce((a, r) => a + r.total, 0) },
        { label: "Weekly teaching hours", value: rows.reduce((a, r) => a + r.hours, 0) },
      ],
      chart: { type: "bar", xKey: "code", series: [{ key: "total", label: "Faculty" }, { key: "active", label: "Active" }], data: rows.map((r) => ({ code: r.code, total: r.total, active: r.active })) },
    };
  },

  attendance: async (ctx) => {
    const match: Record<string, unknown> = {};
    if (ctx.department) match.department = new Types.ObjectId(ctx.department);
    if (ctx.faculty) match.faculty = new Types.ObjectId(ctx.faculty);
    if (ctx.from || ctx.to) match.date = { ...(ctx.from ? { $gte: ctx.from } : {}), ...(ctx.to ? { $lte: ctx.to } : {}) };
    const agg = await Attendance.aggregate([
      { $match: match },
      { $group: { _id: { f: "$faculty", s: "$status" }, n: { $sum: 1 } } },
      { $group: { _id: "$_id.f", counts: { $push: { k: "$_id.s", v: "$n" } } } },
      { $lookup: { from: "faculties", localField: "_id", foreignField: "_id", as: "f" } },
      { $unwind: "$f" },
      { $lookup: { from: "departments", localField: "f.department", foreignField: "_id", as: "dep" } },
      { $unwind: "$dep" },
      { $sort: { "f.facultyId": 1 } },
    ]);
    const rows = agg.map((r) => {
      const c = Object.fromEntries(r.counts.map((x: { k: string; v: number }) => [x.k, x.v])) as Record<string, number>;
      const present = c.present ?? 0, late = c.late ?? 0, absent = c.absent ?? 0, onLeave = c.on_leave ?? 0;
      const total = present + late + absent + onLeave;
      const pct = percentageOf(present, late, total, onLeave);
      return { facultyId: r.f.facultyId, name: `${r.f.firstName} ${r.f.lastName}`, department: r.dep.code, total, present, late, absent, onLeave, percentage: pct === null ? "—" : `${pct}%`, _pct: pct ?? 0 };
    });
    const sum = (k: "present" | "late" | "absent" | "onLeave" | "total") => rows.reduce((a, r) => a + r[k], 0);
    const overall = percentageOf(sum("present"), sum("late"), sum("total"), sum("onLeave"));
    // Detailed daily log when a single faculty is selected.
    if (ctx.faculty) {
      const recs = await Attendance.find(match).sort({ date: 1 }).lean();
      return {
        title: "Attendance Report",
        subtitle: `${rows[0]?.name ?? ""} · ${ctx.from ? dateKey(ctx.from) : "start"} to ${ctx.to ? dateKey(ctx.to) : "today"}`,
        columns: [
          { key: "date", label: "Date", width: 1 },
          { key: "day", label: "Day", width: 0.7 },
          { key: "status", label: "Status", width: 0.8 },
          { key: "checkIn", label: "Check-in", width: 0.7 },
          { key: "checkOut", label: "Check-out", width: 0.7 },
          { key: "source", label: "Source", width: 0.8 },
          { key: "remarks", label: "Remarks", width: 1.8 },
        ],
        rows: recs.map((r) => ({
          date: d(r.date),
          day: format(r.date, "EEE"),
          status: label(r.status),
          checkIn: r.checkIn ?? "",
          checkOut: r.checkOut ?? "",
          source: r.source === "self" ? "Self-reported" : r.source === "leave" ? "Leave" : "Marked by staff",
          remarks: r.remarks ?? "",
        })),
        summary: [
          { label: "Working days recorded", value: sum("total") },
          { label: "Present", value: sum("present") },
          { label: "Late", value: sum("late") },
          { label: "Absent", value: sum("absent") },
          { label: "Attendance %", value: overall === null ? "—" : `${overall}%` },
        ],
      };
    }
    return {
      title: "Attendance Report",
      subtitle: `${ctx.from ? dateKey(ctx.from) : "All time"} to ${ctx.to ? dateKey(ctx.to) : "today"}`,
      columns: [
        { key: "facultyId", label: "Faculty ID", width: 0.8 },
        { key: "name", label: "Name", width: 1.6 },
        { key: "department", label: "Dept", width: 0.6 },
        { key: "total", label: "Days", width: 0.5 },
        { key: "present", label: "Present", width: 0.6 },
        { key: "late", label: "Late", width: 0.5 },
        { key: "absent", label: "Absent", width: 0.6 },
        { key: "onLeave", label: "On Leave", width: 0.6 },
        { key: "percentage", label: "Attendance %", width: 0.8 },
      ],
      rows: rows.map(({ _pct, ...r }) => r),
      summary: [
        { label: "Faculty", value: rows.length },
        { label: "Present days", value: sum("present") },
        { label: "Absent days", value: sum("absent") },
        { label: "Leave days", value: sum("onLeave") },
        { label: "Overall attendance", value: overall === null ? "—" : `${overall}%` },
      ],
      chart: {
        type: "bar",
        xKey: "name",
        series: [{ key: "percentage", label: "Attendance %" }],
        data: rows.slice(0, 30).map((r) => ({ name: r.name.split(" ")[0] + " " + (r.name.split(" ")[1]?.[0] ?? "") + ".", percentage: r._pct })),
      },
    };
  },

  leave: async (ctx) => {
    const m: Record<string, unknown> = {};
    if (ctx.department) m.department = ctx.department;
    if (ctx.faculty) m.faculty = ctx.faculty;
    if (ctx.status) m.status = ctx.status;
    if (ctx.from) m.endDate = { $gte: ctx.from };
    if (ctx.to) m.startDate = { $lte: ctx.to };
    const rows = await LeaveApplication.find(m).populate("faculty", "facultyId firstName lastName").populate("department", "code").populate("reviewedBy", "name").sort({ startDate: -1 }).lean();
    const byType: Record<string, number> = {};
    rows.forEach((r) => (byType[r.leaveType] = (byType[r.leaveType] ?? 0) + r.days));
    return {
      title: "Leave Report",
      subtitle: ctx.from || ctx.to ? `${ctx.from ? dateKey(ctx.from) : "…"} to ${ctx.to ? dateKey(ctx.to) : "…"}` : undefined,
      columns: [
        { key: "facultyId", label: "Faculty ID", width: 0.8 },
        { key: "name", label: "Name", width: 1.4 },
        { key: "department", label: "Dept", width: 0.5 },
        { key: "type", label: "Type", width: 0.7 },
        { key: "from", label: "From", width: 0.9 },
        { key: "to", label: "To", width: 0.9 },
        { key: "days", label: "Days", width: 0.4 },
        { key: "status", label: "Status", width: 0.7 },
        { key: "reviewer", label: "Reviewed by", width: 1 },
        { key: "reason", label: "Reason", width: 1.6 },
      ],
      rows: rows.map((r) => {
        const f = r.faculty as unknown as { facultyId: string; firstName: string; lastName: string };
        return {
          facultyId: f?.facultyId ?? "",
          name: f ? `${f.firstName} ${f.lastName}` : "",
          department: (r.department as unknown as { code: string })?.code ?? "",
          type: label(r.leaveType),
          from: d(r.startDate),
          to: d(r.endDate),
          days: r.days,
          status: label(r.status),
          reviewer: (r.reviewedBy as unknown as { name: string })?.name ?? "",
          reason: r.reason,
        };
      }),
      summary: [
        { label: "Applications", value: rows.length },
        { label: "Approved", value: rows.filter((r) => r.status === "approved").length },
        { label: "Pending", value: rows.filter((r) => r.status === "pending").length },
        { label: "Rejected", value: rows.filter((r) => r.status === "rejected").length },
        { label: "Approved days", value: rows.filter((r) => r.status === "approved").reduce((a, r) => a + r.days, 0) },
      ],
      chart: { type: "pie", xKey: "type", series: [{ key: "days", label: "Days" }], data: Object.entries(byType).map(([type, days]) => ({ type: label(type), days })) },
    };
  },

  workload: async (ctx) => {
    const data = await facultyWorkloadSummary({ academicYear: ctx.academicYear, term: ctx.term, department: ctx.department });
    let rows = data.rows;
    if (ctx.faculty) rows = rows.filter((r) => String(r.faculty._id) === ctx.faculty);
    if (ctx.status) rows = rows.filter((r) => r.status === ctx.status);
    return {
      title: "Workload Report",
      subtitle: `${ctx.academicYear}${ctx.term && ctx.term !== "all" ? ` · ${label(ctx.term)} semester` : ""} · limits ${data.limits.min}–${data.limits.max} hrs/week`,
      columns: [
        { key: "facultyId", label: "Faculty ID", width: 0.8 },
        { key: "name", label: "Name", width: 1.5 },
        { key: "department", label: "Dept", width: 0.6 },
        { key: "designation", label: "Designation", width: 1.3 },
        { key: "subjects", label: "Subjects", width: 0.6 },
        { key: "lecture", label: "Lecture", width: 0.6 },
        { key: "lab", label: "Lab", width: 0.5 },
        { key: "tutorial", label: "Tutorial", width: 0.6 },
        { key: "hours", label: "Total Hrs", width: 0.6 },
        { key: "status", label: "Status", width: 0.9 },
      ],
      rows: rows.map((r) => ({
        facultyId: r.faculty.facultyId,
        name: r.faculty.fullName,
        department: (r.faculty.department as unknown as { code: string })?.code ?? "",
        designation: r.faculty.designation,
        subjects: r.subjectCount,
        lecture: r.lecture,
        lab: r.lab,
        tutorial: r.tutorial,
        hours: r.hours,
        status: label(r.status),
      })),
      summary: [
        { label: "Faculty", value: rows.length },
        { label: "Total weekly hours", value: rows.reduce((a, r) => a + r.hours, 0) },
        { label: "Overloaded", value: rows.filter((r) => r.status === "overloaded").length },
        { label: "Underutilized", value: rows.filter((r) => r.status === "underutilized").length },
      ],
      chart: { type: "bar", xKey: "name", series: [{ key: "hours", label: "Weekly hours" }], data: rows.slice(0, 30).map((r) => ({ name: r.faculty.firstName + " " + r.faculty.lastName[0] + ".", hours: r.hours })) },
    };
  },

  "subject-allocation": async (ctx) => {
    const m: Record<string, unknown> = { academicYear: ctx.academicYear };
    if (ctx.department) m.department = ctx.department;
    if (ctx.faculty) m.assignedFaculty = ctx.faculty;
    const subjects = await Subject.find(m).populate("department", "code").populate("course", "code").populate("assignedFaculty", "firstName lastName").sort({ code: 1 }).lean();
    const hours = await Workload.aggregate([{ $match: { subject: { $in: subjects.map((s) => s._id) } } }, { $group: { _id: "$subject", h: { $sum: "$weeklyHours" } } }]);
    const rows = subjects.map((s) => {
      const fac = s.assignedFaculty as unknown as { firstName: string; lastName: string }[];
      return {
        code: s.code,
        name: s.name,
        department: (s.department as unknown as { code: string })?.code ?? "",
        course: (s.course as unknown as { code: string })?.code ?? "",
        semester: s.semester,
        credits: s.credits,
        type: label(s.type),
        faculty: fac.map((f) => `${f.firstName} ${f.lastName}`).join(", ") || "Unallocated",
        hours: hours.find((h) => String(h._id) === String(s._id))?.h ?? 0,
      };
    });
    return {
      title: "Subject Allocation Report",
      subtitle: ctx.academicYear,
      columns: [
        { key: "code", label: "Code", width: 0.7 },
        { key: "name", label: "Subject", width: 1.8 },
        { key: "department", label: "Dept", width: 0.5 },
        { key: "course", label: "Course", width: 0.7 },
        { key: "semester", label: "Sem", width: 0.4 },
        { key: "credits", label: "Credits", width: 0.5 },
        { key: "type", label: "Type", width: 0.6 },
        { key: "faculty", label: "Assigned Faculty", width: 2 },
        { key: "hours", label: "Hrs/wk", width: 0.5 },
      ],
      rows,
      summary: [
        { label: "Subjects", value: rows.length },
        { label: "Allocated", value: rows.filter((r) => r.faculty !== "Unallocated").length },
        { label: "Unallocated", value: rows.filter((r) => r.faculty === "Unallocated").length },
        { label: "Total credits", value: rows.reduce((a, r) => a + r.credits, 0) },
      ],
    };
  },

  "employment-status": async (ctx) => {
    const m: Record<string, unknown> = {};
    if (ctx.department) m.department = new Types.ObjectId(ctx.department);
    const agg = await Faculty.aggregate([
      { $match: m },
      { $group: { _id: { dept: "$department", status: { $cond: ["$isArchived", "archived", "$status"] }, type: "$employmentType" }, n: { $sum: 1 } } },
      { $lookup: { from: "departments", localField: "_id.dept", foreignField: "_id", as: "d" } },
      { $unwind: "$d" },
    ]);
    const map = new Map<string, Record<string, number | string>>();
    for (const r of agg) {
      const row: Record<string, number | string> = map.get(r.d.code) ?? { department: r.d.code, name: r.d.name, active: 0, probation: 0, on_sabbatical: 0, inactive: 0, resigned: 0, retired: 0, archived: 0, full_time: 0, part_time: 0, contract: 0, visiting: 0, total: 0 };
      const st = String(r._id.status);
      const ty = String(r._id.type);
      row[st] = (Number(row[st]) || 0) + r.n;
      row[ty] = (Number(row[ty]) || 0) + r.n;
      row.total = Number(row.total) + r.n;
      map.set(r.d.code, row);
    }
    const rows = [...map.values()].sort((a, b) => String(a.department).localeCompare(String(b.department)));
    const sum = (k: string) => rows.reduce((a, r) => a + Number(r[k] ?? 0), 0);
    return {
      title: "Employment Status Report",
      columns: [
        { key: "department", label: "Dept", width: 0.6 },
        { key: "active", label: "Active", width: 0.6 },
        { key: "probation", label: "Probation", width: 0.7 },
        { key: "on_sabbatical", label: "Sabbatical", width: 0.7 },
        { key: "inactive", label: "Inactive", width: 0.6 },
        { key: "resigned", label: "Resigned", width: 0.6 },
        { key: "retired", label: "Retired", width: 0.6 },
        { key: "full_time", label: "Full-time", width: 0.7 },
        { key: "part_time", label: "Part-time", width: 0.7 },
        { key: "contract", label: "Contract", width: 0.6 },
        { key: "visiting", label: "Visiting", width: 0.6 },
        { key: "total", label: "Total", width: 0.5 },
      ],
      rows,
      summary: [
        { label: "Total records", value: sum("total") },
        { label: "Active", value: sum("active") },
        { label: "Full-time", value: sum("full_time") },
        { label: "Contract / visiting", value: sum("contract") + sum("visiting") },
      ],
      chart: {
        type: "pie",
        xKey: "status",
        series: [{ key: "count", label: "Faculty" }],
        data: ["active", "probation", "on_sabbatical", "inactive", "resigned", "retired", "archived"].map((s) => ({ status: label(s), count: sum(s) })).filter((x) => x.count > 0),
      },
    };
  },
};

export const generate = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const type = req.params.type as ReportType;
  if (!REPORT_TYPES.includes(type)) throw ApiError.notFound("Unknown report type");
  const q = req.query as Record<string, string | undefined>;
  const settings = await getSettings();
  const ctx: Ctx = {
    user,
    academicYear: q.academicYear || settings.academicYear,
    term: q.term,
    status: q.status,
    from: q.from ? toDateOnly(q.from) : undefined,
    to: q.to ? toDateOnly(q.to) : undefined,
  };
  if (user.role === "faculty") {
    if (!FACULTY_ALLOWED.includes(type)) throw ApiError.forbidden("This report is not available to your role");
    ctx.faculty = user.facultyId!;
  } else {
    ctx.department = resolveDepartment(user, q.department);
    ctx.faculty = q.faculty || undefined;
  }
  const fmt = (q.format ?? "json").toLowerCase();
  if (!["json", "csv", "xlsx", "pdf"].includes(fmt)) throw ApiError.badRequest("Unsupported format");
  const report = await builders[type](ctx);
  if (fmt !== "json") await audit(req, { action: "EXPORT", module: "reports", description: `Exported ${report.title} as ${fmt.toUpperCase()}` });
  await sendReport(res, report, fmt, settings.institutionName);
});
