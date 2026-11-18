import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app, setupDB, teardownDB, makeAdmin, makeDepartment, makeFaculty, makeSubject, tokenFor, auth } from "./helpers";
import { SystemSetting } from "../src/models";
import { invalidateSettings } from "../src/services/settings.service";

describe("Timetable conflict detection", () => {
  let adminToken: string;
  let f1: string, f2: string, s1: string, s2: string, sUnassigned: string;

  beforeAll(async () => {
    await setupDB();
    const admin = await makeAdmin();
    const d = await makeDepartment();
    f1 = String((await makeFaculty(d._id)).faculty._id);
    f2 = String((await makeFaculty(d._id)).faculty._id);
    s1 = String((await makeSubject(d._id, [f1]))._id);
    s2 = String((await makeSubject(d._id, [f2]))._id);
    sUnassigned = String((await makeSubject(d._id, []))._id);
    adminToken = await tokenFor(admin.email);
  });
  afterAll(teardownDB);

  const slot = (o: Record<string, unknown>) => ({ section: "CSE-3A", room: "A-101", dayOfWeek: 1, startTime: "09:00", endTime: "09:55", ...o });

  it("creates a timetable entry", async () => {
    const res = await request(app).post("/api/timetable").set(auth(adminToken)).send(slot({ faculty: f1, subject: s1 }));
    expect(res.status).toBe(201);
  });

  it("prevents faculty double-booking (overlapping time)", async () => {
    const res = await request(app).post("/api/timetable").set(auth(adminToken)).send(slot({ faculty: f1, subject: s1, section: "CSE-3B", room: "A-102", startTime: "09:30", endTime: "10:20" }));
    expect(res.status).toBe(409);
    expect(res.body.details[0].types).toContain("faculty");
  });

  it("prevents room double-booking", async () => {
    const res = await request(app).post("/api/timetable").set(auth(adminToken)).send(slot({ faculty: f2, subject: s2, section: "CSE-5A" }));
    expect(res.status).toBe(409);
    expect(res.body.details[0].types).toContain("room");
  });

  it("prevents a section having two classes at once", async () => {
    const res = await request(app).post("/api/timetable").set(auth(adminToken)).send(slot({ faculty: f2, subject: s2, room: "B-201" }));
    expect(res.status).toBe(409);
    expect(res.body.details[0].types).toContain("section");
  });

  it("allows back-to-back slots", async () => {
    const res = await request(app).post("/api/timetable").set(auth(adminToken)).send(slot({ faculty: f1, subject: s1, startTime: "09:55", endTime: "10:50" }));
    expect(res.status).toBe(201);
  });

  it("rejects faculty not allocated to the subject", async () => {
    const res = await request(app).post("/api/timetable").set(auth(adminToken)).send(slot({ faculty: f1, subject: sUnassigned, dayOfWeek: 2 }));
    expect(res.status).toBe(409);
  });

  it("rejects end time before start time", async () => {
    const res = await request(app).post("/api/timetable").set(auth(adminToken)).send(slot({ faculty: f1, subject: s1, dayOfWeek: 3, startTime: "11:00", endTime: "10:00" }));
    expect(res.status).toBe(400);
  });
});

describe("Workload allocation", () => {
  let adminToken: string, facultyToken: string, f1: string, subjects: string[];

  beforeAll(async () => {
    await setupDB();
    await SystemSetting.updateOne({ key: "global" }, { "workload.maxWeeklyHours": 8, "workload.minWeeklyHours": 2 });
    invalidateSettings();
    const admin = await makeAdmin();
    const d = await makeDepartment();
    const fac = await makeFaculty(d._id);
    f1 = String(fac.faculty._id);
    subjects = [String((await makeSubject(d._id))._id), String((await makeSubject(d._id))._id)];
    adminToken = await tokenFor(admin.email);
    facultyToken = await tokenFor(fac.user.email);
  });
  afterAll(teardownDB);

  it("allocates workload and assigns the subject", async () => {
    const res = await request(app).post("/api/workload").set(auth(adminToken)).send({ faculty: f1, subject: subjects[0], weeklyHours: 5 });
    expect(res.status).toBe(201);
    expect(res.body.data.warning).toBeUndefined();
    const subj = await request(app).get(`/api/subjects/${subjects[0]}`).set(auth(adminToken));
    expect(subj.body.data.assignedFaculty.map((f: { _id: string }) => f._id)).toContain(f1);
  });

  it("prevents duplicate allocations", async () => {
    const res = await request(app).post("/api/workload").set(auth(adminToken)).send({ faculty: f1, subject: subjects[0], weeklyHours: 2 });
    expect(res.status).toBe(409);
  });

  it("warns when the configured limit is exceeded and flags the faculty as overloaded", async () => {
    const res = await request(app).post("/api/workload").set(auth(adminToken)).send({ faculty: f1, subject: subjects[1], weeklyHours: 5 });
    expect(res.status).toBe(201);
    expect(res.body.data.warning).toMatch(/above the 8 hr limit/);
    const summary = await request(app).get("/api/workload/summary?term=all").set(auth(adminToken));
    const row = summary.body.data.rows.find((r: { faculty: { _id: string } }) => r.faculty._id === f1);
    expect(row.hours).toBe(10);
    expect(row.status).toBe("overloaded");
  });

  it("faculty cannot allocate workload but can view their own", async () => {
    expect((await request(app).post("/api/workload").set(auth(facultyToken)).send({ faculty: f1, subject: subjects[1], weeklyHours: 1 })).status).toBe(403);
    const mine = await request(app).get("/api/workload").set(auth(facultyToken));
    expect(mine.status).toBe(200);
    expect(mine.body.data).toHaveLength(2);
  });

  it("generates reports in every format", async () => {
    for (const [fmt, type] of [["csv", "text/csv"], ["xlsx", "spreadsheetml"], ["pdf", "application/pdf"]]) {
      const res = await request(app).get(`/api/reports/workload?format=${fmt}&term=all`).set(auth(adminToken)).buffer(true);
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain(type);
    }
    const json = await request(app).get("/api/reports/workload?term=all").set(auth(adminToken));
    expect(json.body.data.rows[0].hours).toBe(10);
    expect((await request(app).get("/api/reports/faculty-directory").set(auth(facultyToken))).status).toBe(403);
  });
});
