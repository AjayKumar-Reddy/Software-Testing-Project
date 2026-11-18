import { Types } from "mongoose";
import { format, subDays, subMonths, startOfMonth } from "date-fns";
import { Faculty, Department, Attendance, LeaveApplication, Subject, AuditLog, Announcement, Workload, Timetable, Notification } from "../models";
import { asyncHandler, sendSuccess } from "../utils/http";
import { requireUser } from "../middleware/auth";
import { aggregateStats } from "../services/attendance.service";
import { getSettings } from "../services/settings.service";
import { getLeaveBalance } from "../services/leave.service";
import { visibleFilter } from "./announcement.controller";
import { todayDateOnly, toDateOnly } from "../utils/dates";
import type { AuthUser } from "../types";

async function adminDashboard(user: AuthUser) {
  const settings = await getSettings();
  const deptId = user.role === "hod" && user.departmentId ? new Types.ObjectId(user.departmentId) : null;
  const dScope = deptId ? { department: deptId } : {};
  const today = todayDateOnly();
  const facultyBase = { isArchived: false, ...dScope };

  const [totalFaculty, activeFaculty, totalDepartments, todayStats, pendingLeaves, assignedSubjects, avg30] = await Promise.all([
    Faculty.countDocuments(facultyBase),
    Faculty.countDocuments({ ...facultyBase, status: { $in: ["active", "probation"] } }),
    deptId ? Promise.resolve(1) : Department.countDocuments({ isActive: true }),
    aggregateStats({ date: today, ...dScope }),
    LeaveApplication.countDocuments({ status: "pending", ...dScope }),
    Subject.countDocuments({ academicYear: settings.academicYear, "assignedFaculty.0": { $exists: true }, ...dScope }),
    aggregateStats({ date: { $gte: subDays(today, 30) }, ...dScope }),
  ]);

  // ---- charts ----
  const sixMonthsAgo = toDateOnly(format(startOfMonth(subMonths(new Date(), 5)), "yyyy-MM-dd"));
  const [byDept, byDesignation, monthly, leaveByStatus, leaveByType, strength] = await Promise.all([
    Faculty.aggregate([
      { $match: facultyBase },
      { $group: { _id: "$department", count: { $sum: 1 } } },
      { $lookup: { from: "departments", localField: "_id", foreignField: "_id", as: "d" } },
      { $unwind: "$d" },
      { $project: { _id: 0, department: "$d.name", code: "$d.code", count: 1 } },
      { $sort: { count: -1 } },
    ]),
    Faculty.aggregate([{ $match: facultyBase }, { $group: { _id: "$designation", count: { $sum: 1 } } }, { $project: { _id: 0, designation: "$_id", count: 1 } }, { $sort: { count: -1 } }]),
    Attendance.aggregate([
      { $match: { date: { $gte: sixMonthsAgo }, ...dScope } },
      { $group: { _id: { m: { $dateToString: { format: "%Y-%m", date: "$date" } }, s: "$status" }, n: { $sum: 1 } } },
      { $group: { _id: "$_id.m", counts: { $push: { k: "$_id.s", v: "$n" } } } },
      { $sort: { _id: 1 } },
    ]),
    LeaveApplication.aggregate([{ $match: { academicYear: settings.academicYear, ...dScope } }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    LeaveApplication.aggregate([{ $match: { academicYear: settings.academicYear, ...dScope } }, { $group: { _id: "$leaveType", count: { $sum: 1 }, days: { $sum: "$days" } } }]),
    Faculty.aggregate([
      { $match: { isArchived: false, ...dScope } },
      {
        $group: {
          _id: "$department",
          professors: { $sum: { $cond: [{ $eq: ["$designation", "Professor"] }, 1, 0] } },
          associate: { $sum: { $cond: [{ $eq: ["$designation", "Associate Professor"] }, 1, 0] } },
          assistant: { $sum: { $cond: [{ $eq: ["$designation", "Assistant Professor"] }, 1, 0] } },
          total: { $sum: 1 },
        },
      },
      { $lookup: { from: "departments", localField: "_id", foreignField: "_id", as: "d" } },
      { $unwind: "$d" },
      { $project: { _id: 0, code: "$d.code", department: "$d.name", professors: 1, associate: 1, assistant: 1, others: { $subtract: ["$total", { $add: ["$professors", "$associate", "$assistant"] }] }, total: 1 } },
      { $sort: { code: 1 } },
    ]),
  ]);

  const monthlyAttendance = monthly.map((r) => {
    const c = Object.fromEntries(r.counts.map((x: { k: string; v: number }) => [x.k, x.v])) as Record<string, number>;
    const present = c.present ?? 0, late = c.late ?? 0, absent = c.absent ?? 0, onLeave = c.on_leave ?? 0;
    const countable = present + late + absent;
    return { month: format(new Date(`${r._id}-01T00:00:00Z`), "MMM yyyy"), present, late, absent, onLeave, percentage: countable ? Math.round(((present + late) / countable) * 1000) / 10 : 0 };
  });

  // ---- lists ----
  const deptUserIds = deptId ? (await Faculty.find({ department: deptId, user: { $ne: null } }).select("user").lean()).map((f) => f.user) : null;
  const [recentFaculty, pendingLeaveRequests, upcomingEvents, recentActivities, announcements] = await Promise.all([
    Faculty.find(facultyBase).sort({ createdAt: -1 }).limit(5).select("facultyId firstName lastName designation photo createdAt department").populate("department", "code").lean(),
    LeaveApplication.find({ status: "pending", ...dScope }).sort({ createdAt: -1 }).limit(5).populate("faculty", "firstName lastName photo designation facultyId").populate("department", "code").lean(),
    Announcement.find({ ...visibleFilter(user), category: "event", eventDate: { $gte: today } }).sort({ eventDate: 1 }).limit(5).lean(),
    AuditLog.find(deptUserIds ? { user: { $in: deptUserIds } } : { action: { $ne: "LOGIN_FAILED" } }).sort({ createdAt: -1 }).limit(8).lean(),
    Announcement.find(visibleFilter(user)).sort({ isPinned: -1, publishAt: -1 }).limit(4).populate("createdBy", "name").lean(),
  ]);

  return {
    scope: deptId ? "department" : "institution",
    academicYear: settings.academicYear,
    stats: {
      totalFaculty,
      activeFaculty,
      totalDepartments,
      presentToday: todayStats.present + todayStats.late,
      absentToday: todayStats.absent,
      onLeaveToday: todayStats.onLeave,
      notMarkedToday: Math.max(0, activeFaculty - todayStats.total),
      pendingLeaves,
      assignedCourses: assignedSubjects,
      averageAttendance: avg30.percentage,
    },
    charts: {
      facultyByDepartment: byDept,
      designationDistribution: byDesignation,
      monthlyAttendance,
      leaveByStatus: leaveByStatus.map((l) => ({ status: l._id, count: l.count })),
      leaveByType: leaveByType.map((l) => ({ type: l._id, count: l.count, days: l.days })),
      departmentStrength: strength,
    },
    recentFaculty: recentFaculty.map((f) => ({ ...f, fullName: `${f.firstName} ${f.lastName}` })),
    pendingLeaveRequests,
    upcomingEvents,
    recentActivities,
    announcements,
  };
}

async function facultyDashboard(user: AuthUser) {
  const settings = await getSettings();
  const fid = new Types.ObjectId(user.facultyId!);
  const today = todayDateOnly();
  const monthStart = toDateOnly(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [profile, todayRecord, monthStats, overall, balance, pendingLeaves, subjects, workload, classesToday, announcements, notifications, recentLeaves, monthly] = await Promise.all([
    Faculty.findById(fid).select("facultyId firstName lastName designation photo department email dateOfJoining").populate("department", "name code").lean(),
    Attendance.findOne({ faculty: fid, date: today }).lean(),
    aggregateStats({ faculty: fid, date: { $gte: monthStart } }),
    aggregateStats({ faculty: fid, date: { $gte: subDays(today, 90) } }),
    getLeaveBalance(user.facultyId!, settings.academicYear),
    LeaveApplication.countDocuments({ faculty: fid, status: "pending" }),
    Subject.find({ assignedFaculty: fid, academicYear: settings.academicYear }).select("name code semester credits type").lean(),
    Workload.aggregate([{ $match: { faculty: fid, academicYear: settings.academicYear } }, { $group: { _id: null, hours: { $sum: "$weeklyHours" } } }]),
    Timetable.find({ faculty: fid, academicYear: settings.academicYear, dayOfWeek: new Date().getDay() }).populate("subject", "name code").sort({ startTime: 1 }).lean(),
    Announcement.find(visibleFilter(user)).sort({ isPinned: -1, publishAt: -1 }).limit(4).populate("createdBy", "name").lean(),
    Notification.find({ user: user.id }).sort({ createdAt: -1 }).limit(5).lean(),
    LeaveApplication.find({ faculty: fid }).sort({ createdAt: -1 }).limit(4).lean(),
    Attendance.aggregate([
      { $match: { faculty: fid, date: { $gte: toDateOnly(format(startOfMonth(subMonths(new Date(), 5)), "yyyy-MM-dd")) } } },
      { $group: { _id: { m: { $dateToString: { format: "%Y-%m", date: "$date" } }, s: "$status" }, n: { $sum: 1 } } },
      { $group: { _id: "$_id.m", counts: { $push: { k: "$_id.s", v: "$n" } } } },
      { $sort: { _id: 1 } },
    ]),
  ]);
  return {
    scope: "self",
    academicYear: settings.academicYear,
    profile: profile ? { ...profile, fullName: `${profile.firstName} ${profile.lastName}` } : null,
    today: { record: todayRecord, selfCheckInEnabled: settings.attendance?.allowSelfCheckIn },
    attendance: { month: monthStats, last90Days: overall },
    leaveBalance: balance,
    pendingLeaves,
    subjects,
    weeklyHours: workload[0]?.hours ?? 0,
    workloadLimits: settings.workload,
    classesToday,
    announcements,
    notifications,
    recentLeaves,
    monthlyAttendance: monthly.map((r) => {
      const c = Object.fromEntries(r.counts.map((x: { k: string; v: number }) => [x.k, x.v])) as Record<string, number>;
      const countable = (c.present ?? 0) + (c.late ?? 0) + (c.absent ?? 0);
      return { month: format(new Date(`${r._id}-01T00:00:00Z`), "MMM"), present: c.present ?? 0, late: c.late ?? 0, absent: c.absent ?? 0, onLeave: c.on_leave ?? 0, percentage: countable ? Math.round((((c.present ?? 0) + (c.late ?? 0)) / countable) * 1000) / 10 : 0 };
    }),
  };
}

export const getDashboard = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  if (user.role === "faculty") return sendSuccess(res, await facultyDashboard(user));
  sendSuccess(res, await adminDashboard(user));
});

/** Global quick search across faculty, departments and subjects (role scoped). */
export const search = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const term = String(req.query.q ?? "").trim().slice(0, 60);
  if (term.length < 2) return sendSuccess(res, { faculty: [], departments: [], subjects: [] });
  const rx = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const dScope = user.role === "admin" ? {} : { department: user.departmentId };
  const [faculty, departments, subjects] = await Promise.all([
    user.role === "faculty"
      ? Promise.resolve([])
      : Faculty.find({ ...dScope, isArchived: false, $or: [{ firstName: rx }, { lastName: rx }, { email: rx }, { facultyId: rx }] }).select("facultyId firstName lastName designation photo").limit(6).lean(),
    Department.find(user.role === "admin" ? { $or: [{ name: rx }, { code: rx }] } : { _id: user.departmentId, $or: [{ name: rx }, { code: rx }] }).select("name code").limit(4).lean(),
    Subject.find({ ...(user.role === "faculty" ? { assignedFaculty: user.facultyId } : dScope), $or: [{ name: rx }, { code: rx }] }).select("name code semester").limit(5).lean(),
  ]);
  sendSuccess(res, { faculty: faculty.map((f) => ({ ...f, fullName: `${f.firstName} ${f.lastName}` })), departments, subjects });
});

