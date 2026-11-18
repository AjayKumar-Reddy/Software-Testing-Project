import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { format, addDays } from "date-fns";
import { app, setupDB, teardownDB, makeAdmin, makeDepartment, makeFaculty, tokenFor, auth } from "./helpers";
import { Attendance, LeaveBalance, LeaveApplication } from "../src/models";
import { toDateOnly } from "../src/utils/dates";

const day = (offset: number) => format(addDays(new Date(), offset), "yyyy-MM-dd");

describe("Attendance", () => {
  let adminToken: string, hodToken: string, facultyToken: string;
  let fac: { _id: unknown }, otherFac: { _id: unknown };

  beforeAll(async () => {
    await setupDB();
    const admin = await makeAdmin();
    const d1 = await makeDepartment();
    const d2 = await makeDepartment();
    const hod = await makeFaculty(d1._id, "hod");
    const f = await makeFaculty(d1._id);
    fac = f.faculty;
    otherFac = (await makeFaculty(d2._id)).faculty;
    adminToken = await tokenFor(admin.email);
    hodToken = await tokenFor(hod.user.email);
    facultyToken = await tokenFor(f.user.email);
  });
  afterAll(teardownDB);

  it("marks attendance and auto-flags late arrivals", async () => {
    const res = await request(app)
      .post("/api/attendance/bulk")
      .set(auth(hodToken))
      .send({ date: day(-1), records: [{ faculty: String(fac._id), status: "present", checkIn: "09:40" }] });
    expect(res.status).toBe(200);
    expect(res.body.data.saved).toBe(1);
    const rec = await Attendance.findOne({ faculty: fac._id, date: toDateOnly(day(-1)) });
    expect(rec!.status).toBe("late"); // after the 09:15 threshold
  });

  it("never creates duplicate records for the same faculty and date", async () => {
    await request(app).post("/api/attendance/bulk").set(auth(adminToken)).send({ date: day(-1), records: [{ faculty: String(fac._id), status: "absent" }] });
    const count = await Attendance.countDocuments({ faculty: fac._id, date: toDateOnly(day(-1)) });
    expect(count).toBe(1);
    expect((await Attendance.findOne({ faculty: fac._id, date: toDateOnly(day(-1)) }))!.status).toBe("absent");
  });

  it("rejects future dates", async () => {
    const res = await request(app).post("/api/attendance/bulk").set(auth(adminToken)).send({ date: day(3), records: [{ faculty: String(fac._id), status: "present" }] });
    expect(res.status).toBe(400);
  });

  it("HOD cannot mark attendance for another department", async () => {
    const res = await request(app).post("/api/attendance/bulk").set(auth(hodToken)).send({ date: day(-2), records: [{ faculty: String(otherFac._id), status: "present" }] });
    expect(res.status).toBe(403);
  });

  it("faculty cannot mark attendance for others", async () => {
    const res = await request(app).post("/api/attendance/bulk").set(auth(facultyToken)).send({ date: day(-2), records: [{ faculty: String(fac._id), status: "present" }] });
    expect(res.status).toBe(403);
  });

  it("supports self check-in once per day (self-reported)", async () => {
    const first = await request(app).post("/api/attendance/check-in").set(auth(facultyToken)).send({});
    expect(first.status).toBe(201);
    expect(first.body.data.source).toBe("self");
    const again = await request(app).post("/api/attendance/check-in").set(auth(facultyToken)).send({});
    expect(again.status).toBe(409);
  });

  it("computes the summary percentage", async () => {
    const res = await request(app).get(`/api/attendance/summary?faculty=${fac._id}`).set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(2);
    expect(res.body.data.percentage).toBe(50); // one absent, one present/late today
  });
});

describe("Leave workflow", () => {
  let hodToken: string, facultyToken: string, adminToken: string, hodFacultyId: string;
  let fac: { _id: unknown };

  beforeAll(async () => {
    await setupDB();
    const admin = await makeAdmin();
    const d1 = await makeDepartment();
    const hod = await makeFaculty(d1._id, "hod");
    hodFacultyId = String(hod.faculty._id);
    const f = await makeFaculty(d1._id);
    fac = f.faculty;
    adminToken = await tokenFor(admin.email);
    hodToken = await tokenFor(hod.user.email);
    facultyToken = await tokenFor(f.user.email);
  });
  afterAll(teardownDB);

  let leaveId: string;

  it("faculty applies for leave", async () => {
    const res = await request(app).post("/api/leaves").set(auth(facultyToken)).field("leaveType", "casual").field("startDate", day(-1)).field("endDate", day(1)).field("reason", "Family function out of town");
    expect(res.status).toBe(201);
    expect(res.body.data.days).toBe(3);
    expect(res.body.data.status).toBe("pending");
    leaveId = res.body.data._id;
  });

  it("rejects overlapping applications", async () => {
    const res = await request(app).post("/api/leaves").set(auth(facultyToken)).send({ leaveType: "sick", startDate: day(1), endDate: day(2), reason: "Overlapping request" });
    expect(res.status).toBe(409);
  });

  it("rejects end date before start date", async () => {
    const res = await request(app).post("/api/leaves").set(auth(facultyToken)).send({ leaveType: "sick", startDate: day(5), endDate: day(4), reason: "Invalid range" });
    expect(res.status).toBe(400);
  });

  it("enforces leave balances", async () => {
    const res = await request(app).post("/api/leaves").set(auth(facultyToken)).send({ leaveType: "other", startDate: day(10), endDate: day(25), reason: "Too long for balance" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/balance/i);
  });

  it("faculty cannot approve leave", async () => {
    expect((await request(app).patch(`/api/leaves/${leaveId}/approve`).set(auth(facultyToken)).send({})).status).toBe(403);
  });

  it("HOD approves: balance is debited and attendance reflects leave without duplicates", async () => {
    // A pre-existing 'absent' mark on a leave day should be converted, not duplicated.
    await Attendance.create({ faculty: fac._id, department: (await LeaveApplication.findById(leaveId))!.department, date: toDateOnly(day(-1)), status: "absent" });
    const res = await request(app).patch(`/api/leaves/${leaveId}/approve`).set(auth(hodToken)).send({ remarks: "OK" });
    expect(res.status).toBe(200);
    const bal = await LeaveBalance.findOne({ faculty: fac._id, academicYear: "2026-27" }).lean();
    expect(bal!.balances.find((b) => b.type === "casual")!.used).toBe(3);
    const recs = await Attendance.find({ faculty: fac._id }).lean();
    expect(recs).toHaveLength(3);
    expect(recs.every((r) => r.status === "on_leave")).toBe(true);
  });

  it("cannot approve twice", async () => {
    expect((await request(app).patch(`/api/leaves/${leaveId}/approve`).set(auth(hodToken)).send({})).status).toBe(409);
  });

  it("blocks marking a faculty present on an approved leave day", async () => {
    const res = await request(app).post("/api/attendance/bulk").set(auth(adminToken)).send({ date: day(-1), records: [{ faculty: String(fac._id), status: "present" }] });
    expect(res.body.data.saved).toBe(0);
    expect(res.body.data.skipped[0].reason).toMatch(/approved leave/);
  });

  it("HOD cannot approve their own leave; rejection requires a reason", async () => {
    const own = await request(app).post("/api/leaves").set(auth(hodToken)).send({ leaveType: "casual", startDate: day(7), endDate: day(7), reason: "Personal errand" });
    expect(own.status).toBe(201);
    expect((await request(app).patch(`/api/leaves/${own.body.data._id}/approve`).set(auth(hodToken)).send({})).status).toBe(403);
    expect((await request(app).patch(`/api/leaves/${own.body.data._id}/reject`).set(auth(adminToken)).send({})).status).toBe(400);
    const rej = await request(app).patch(`/api/leaves/${own.body.data._id}/reject`).set(auth(adminToken)).send({ remarks: "Exam week" });
    expect(rej.status).toBe(200);
    expect(rej.body.data.status).toBe("rejected");
    expect(hodFacultyId).toBeTruthy();
  });

  it("reports per-status counts scoped to the requester", async () => {
    const res = await request(app).get("/api/leaves").set(auth(facultyToken));
    expect(res.status).toBe(200);
    expect(res.body.meta.statusCounts.approved).toBe(1);
  });

  it("faculty cancels a pending request", async () => {
    const res = await request(app).post("/api/leaves").set(auth(facultyToken)).send({ leaveType: "sick", startDate: day(12), endDate: day(12), reason: "Medical appointment" });
    const cancel = await request(app).patch(`/api/leaves/${res.body.data._id}/cancel`).set(auth(facultyToken));
    expect(cancel.status).toBe(200);
    expect(cancel.body.data.status).toBe("cancelled");
  });
});
