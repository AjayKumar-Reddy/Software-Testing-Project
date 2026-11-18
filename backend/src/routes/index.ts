import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { uploadAvatar, uploadDocument, uploadLogo } from "../middleware/upload";
import { idParam } from "../validators/common";
import * as v from "../validators/faculty.validator";
import * as av from "../validators/academic.validator";
import * as ov from "../validators/operations.validator";
import authRoutes from "./auth.routes";
import * as faculty from "../controllers/faculty.controller";
import * as dept from "../controllers/department.controller";
import * as course from "../controllers/course.controller";
import * as subject from "../controllers/subject.controller";
import * as session from "../controllers/session.controller";
import * as attendance from "../controllers/attendance.controller";
import * as leave from "../controllers/leave.controller";
import * as workload from "../controllers/workload.controller";
import * as timetable from "../controllers/timetable.controller";
import * as announcement from "../controllers/announcement.controller";
import * as notification from "../controllers/notification.controller";
import * as dashboard from "../controllers/dashboard.controller";
import * as report from "../controllers/report.controller";
import * as auditCtl from "../controllers/audit.controller";
import * as settings from "../controllers/settings.controller";
import * as users from "../controllers/user.controller";

const router = Router();
const ADMIN = authorize("admin");
const STAFF = authorize("admin", "hod");
const id = validate(idParam, "params");

router.get("/health", (_req, res) => res.json({ success: true, data: { status: "ok", time: new Date().toISOString() } }));
router.use("/auth", authRoutes);
router.get("/settings/public", settings.getPublic);

// Everything below requires authentication.
router.use(authenticate);

// Dashboard & search
router.get("/dashboard", dashboard.getDashboard);
router.get("/search", dashboard.search);

// Users (admin)
router.get("/users", ADMIN, users.list);
router.post("/users", ADMIN, validate(users.createAdminSchema), users.createAdmin);
router.patch("/users/:id", ADMIN, id, validate(users.updateUserSchema), users.update);
router.post("/users/:id/reset-password", ADMIN, id, validate(users.resetUserPasswordSchema), users.resetPassword);

// Faculty
router.get("/faculty", STAFF, validate(v.facultyListQuery, "query"), faculty.list);
router.get("/faculty/options", faculty.options);
router.get("/faculty/:id/teaching-history", faculty.teachingHistory);
router.post("/faculty/:id/photo", uploadAvatar.single("photo"), faculty.uploadPhoto);
router.get("/faculty/:id", faculty.getOne);
router.post("/faculty", STAFF, validate(v.createFacultySchema), faculty.create);
router.put("/faculty/:id", id, validate(v.updateFacultySchema), faculty.update);
router.patch("/faculty/:id/status", STAFF, id, validate(v.statusSchema), faculty.setStatus);
router.patch("/faculty/:id/restore", ADMIN, id, faculty.restore);
router.delete("/faculty/:id", ADMIN, id, faculty.remove);

// Departments
router.get("/departments", dept.list);
router.get("/departments/attendance", STAFF, dept.attendanceByDepartment);
router.get("/departments/:id", STAFF, id, dept.getOne);
router.post("/departments", ADMIN, validate(av.departmentSchema), dept.create);
router.put("/departments/:id", STAFF, id, validate(av.departmentSchema.partial()), dept.update);
router.put("/departments/:id/head", ADMIN, id, validate(av.assignHeadSchema), dept.assignHead);
router.delete("/departments/:id", ADMIN, id, dept.remove);

// Courses
router.get("/courses", course.list);
router.post("/courses", STAFF, validate(av.courseSchema), course.create);
router.put("/courses/:id", STAFF, id, validate(av.courseSchema.partial()), course.update);
router.delete("/courses/:id", STAFF, id, course.remove);

// Subjects
router.get("/subjects", subject.list);
router.get("/subjects/allocation", STAFF, subject.allocation);
router.get("/subjects/:id", id, subject.getOne);
router.post("/subjects", STAFF, validate(av.subjectSchema), subject.create);
router.put("/subjects/:id", STAFF, id, validate(av.subjectSchema.partial()), subject.update);
router.put("/subjects/:id/faculty", STAFF, id, validate(av.assignSubjectFacultySchema), subject.assignFaculty);
router.delete("/subjects/:id", STAFF, id, subject.remove);

// Academic sessions
router.get("/sessions", session.list);
router.post("/sessions", ADMIN, validate(av.sessionSchema), session.create);
router.put("/sessions/:id", ADMIN, id, validate(av.sessionSchema), session.update);
router.patch("/sessions/:id/current", ADMIN, id, session.setCurrent);
router.delete("/sessions/:id", ADMIN, id, session.remove);

// Attendance
router.get("/attendance", validate(ov.attendanceListQuery, "query"), attendance.list);
router.get("/attendance/daily", STAFF, attendance.daily);
router.get("/attendance/today", attendance.today);
router.get("/attendance/summary", attendance.summary);
router.get("/attendance/calendar", attendance.calendar);
router.get("/attendance/trend", attendance.trend);
router.get("/attendance/department-stats", STAFF, attendance.departmentStats);
router.post("/attendance/bulk", STAFF, validate(ov.bulkAttendanceSchema), attendance.bulkMark);
router.post("/attendance/check-in", validate(ov.selfAttendanceSchema), attendance.checkIn);
router.post("/attendance/check-out", validate(ov.selfAttendanceSchema), attendance.checkOut);
router.put("/attendance/:id", STAFF, id, validate(ov.updateAttendanceSchema), attendance.update);
router.delete("/attendance/:id", ADMIN, id, attendance.remove);

// Leave
router.get("/leaves", validate(ov.leaveListQuery, "query"), leave.list);
router.get("/leaves/balance", leave.balance);
router.get("/leaves/balances", STAFF, leave.balances);
router.put("/leaves/balances/:facultyId", ADMIN, validate(ov.leaveBalanceUpdateSchema), leave.updateBalance);
router.get("/leaves/:id", id, leave.getOne);
router.get("/leaves/:id/document", id, leave.downloadDocument);
router.post("/leaves", uploadDocument.single("document"), validate(ov.leaveApplySchema), leave.apply);
router.patch("/leaves/:id/approve", STAFF, id, validate(ov.leaveDecisionSchema), leave.approve);
router.patch("/leaves/:id/reject", STAFF, id, validate(ov.leaveRejectSchema), leave.reject);
router.patch("/leaves/:id/cancel", id, leave.cancel);

// Workload
router.get("/workload", validate(ov.workloadListQuery, "query"), workload.list);
router.get("/workload/summary", workload.summary);
router.post("/workload", STAFF, validate(ov.workloadSchema), workload.create);
router.put("/workload/:id", STAFF, id, validate(ov.workloadSchema.partial()), workload.update);
router.delete("/workload/:id", STAFF, id, workload.remove);

// Timetable
router.get("/timetable", validate(ov.timetableQuery, "query"), timetable.list);
router.get("/timetable/meta", timetable.meta);
router.post("/timetable/check-conflicts", STAFF, timetable.checkConflicts);
router.post("/timetable", STAFF, validate(ov.timetableSchema), timetable.create);
router.put("/timetable/:id", STAFF, id, validate(ov.timetableSchema), timetable.update);
router.delete("/timetable/:id", STAFF, id, timetable.remove);

// Announcements
router.get("/announcements", announcement.list);
router.get("/announcements/events", announcement.upcomingEvents);
router.post("/announcements", STAFF, validate(ov.announcementSchema), announcement.create);
router.put("/announcements/:id", STAFF, id, validate(ov.announcementSchema), announcement.update);
router.delete("/announcements/:id", STAFF, id, announcement.remove);

// Notifications
router.get("/notifications", notification.list);
router.get("/notifications/unread-count", notification.unreadCount);
router.patch("/notifications/read-all", notification.markAllRead);
router.patch("/notifications/:id/read", id, notification.markRead);
router.delete("/notifications/:id", id, notification.remove);

// Reports
router.get("/reports/:type", report.generate);

// Audit logs
router.get("/audit-logs", ADMIN, auditCtl.list);
router.get("/audit-logs/facets", ADMIN, auditCtl.facets);

// Settings
router.get("/settings", settings.get);
router.put("/settings", ADMIN, validate(settings.settingsSchema), settings.update);
router.post("/settings/logo", ADMIN, uploadLogo.single("logo"), settings.uploadLogo);

export default router;
