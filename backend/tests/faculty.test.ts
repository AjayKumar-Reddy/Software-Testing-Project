import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app, setupDB, teardownDB, makeAdmin, makeDepartment, makeFaculty, tokenFor, auth } from "./helpers";
import { Faculty, User } from "../src/models";

describe("Faculty management & RBAC", () => {
  let adminToken: string, hodToken: string, facultyToken: string;
  let deptA: { _id: unknown }, deptB: { _id: unknown };
  let otherDeptFaculty: { _id: unknown };

  beforeAll(async () => {
    await setupDB();
    const admin = await makeAdmin();
    deptA = await makeDepartment("CSE");
    deptB = await makeDepartment("ME");
    const hod = await makeFaculty(deptA._id, "hod");
    const fac = await makeFaculty(deptA._id);
    otherDeptFaculty = (await makeFaculty(deptB._id)).faculty;
    adminToken = await tokenFor(admin.email);
    hodToken = await tokenFor(hod.user.email);
    facultyToken = await tokenFor(fac.user.email);
  });
  afterAll(teardownDB);

  const payload = (email: string, department: unknown) => ({
    firstName: "Asha",
    lastName: "Verma",
    email,
    department: String(department),
    designation: "Assistant Professor",
    dateOfJoining: "2024-07-01",
  });

  it("admin creates faculty with an auto-generated ID and login account", async () => {
    const res = await request(app).post("/api/faculty").set(auth(adminToken)).send(payload("asha@test.edu", deptA._id));
    expect(res.status).toBe(201);
    expect(res.body.data.faculty.facultyId).toMatch(/^FAC\d{4}$/);
    expect(res.body.data.temporaryPassword).toBeTypeOf("string");
    expect(await User.exists({ email: "asha@test.edu", role: "faculty" })).toBeTruthy();
  });

  it("rejects duplicate emails", async () => {
    const res = await request(app).post("/api/faculty").set(auth(adminToken)).send(payload("asha@test.edu", deptA._id));
    expect(res.status).toBe(409);
  });

  it("rejects duplicate faculty IDs", async () => {
    const existing = (await Faculty.findOne({ isArchived: false }).lean())!.facultyId;
    const res = await request(app).post("/api/faculty").set(auth(adminToken)).send({ ...payload("x1@test.edu", deptA._id), facultyId: existing });
    expect(res.status).toBe(409);
    expect(await Faculty.exists({ email: "x1@test.edu" })).toBeNull();
  });

  it("validates required fields", async () => {
    const res = await request(app).post("/api/faculty").set(auth(adminToken)).send({ firstName: "", email: "bad" });
    expect(res.status).toBe(400);
    expect(res.body.details.length).toBeGreaterThan(0);
  });

  it("faculty members cannot list or create faculty", async () => {
    expect((await request(app).get("/api/faculty").set(auth(facultyToken))).status).toBe(403);
    expect((await request(app).post("/api/faculty").set(auth(facultyToken)).send(payload("z@test.edu", deptA._id))).status).toBe(403);
  });

  it("HOD only sees their own department", async () => {
    const res = await request(app).get("/api/faculty?limit=100").set(auth(hodToken));
    expect(res.status).toBe(200);
    expect(res.body.data.every((f: { department: { _id: string } }) => f.department._id === String(deptA._id))).toBe(true);
    expect((await request(app).get(`/api/faculty?department=${deptB._id}`).set(auth(hodToken))).status).toBe(403);
    expect((await request(app).get(`/api/faculty/${otherDeptFaculty._id}`).set(auth(hodToken))).status).toBe(403);
  });

  it("HOD cannot create faculty in another department", async () => {
    const res = await request(app).post("/api/faculty").set(auth(hodToken)).send(payload("hb@test.edu", deptB._id));
    expect(res.status).toBe(403);
  });

  it("faculty can only edit self-service fields of their own profile", async () => {
    const me = await request(app).get("/api/faculty/me").set(auth(facultyToken));
    expect(me.status).toBe(200);
    const res = await request(app)
      .put(`/api/faculty/${me.body.data._id}`)
      .set(auth(facultyToken))
      .send({ phone: "+91 9876543210", designation: "Professor" });
    expect(res.status).toBe(200);
    const fresh = await Faculty.findById(me.body.data._id).lean();
    expect(fresh!.phone).toBe("+91 9876543210");
    expect(fresh!.designation).toBe("Assistant Professor"); // admin-controlled field ignored
    expect((await request(app).put(`/api/faculty/${otherDeptFaculty._id}`).set(auth(facultyToken)).send({ phone: "+91 9000000000" })).status).toBe(403);
  });

  it("supports search, filter and pagination", async () => {
    const res = await request(app).get("/api/faculty?search=asha&limit=1&page=1").set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 1 });
    expect(res.body.data[0].email).toBe("asha@test.edu");
  });

  it("archiving disables login", async () => {
    const f = await Faculty.findOne({ email: "asha@test.edu" });
    const res = await request(app).delete(`/api/faculty/${f!._id}`).set(auth(adminToken));
    expect(res.status).toBe(200);
    expect((await Faculty.findById(f!._id))!.isArchived).toBe(true);
    expect((await User.findOne({ email: "asha@test.edu" }))!.isActive).toBe(false);
  });

  it("prevents deleting a department with active faculty", async () => {
    const res = await request(app).delete(`/api/departments/${deptA._id}`).set(auth(adminToken));
    expect(res.status).toBe(409);
  });

  it("only admins can view audit logs", async () => {
    expect((await request(app).get("/api/audit-logs").set(auth(hodToken))).status).toBe(403);
    const res = await request(app).get("/api/audit-logs").set(auth(adminToken));
    expect(res.status).toBe(200);
    expect(res.body.data.some((l: { module: string; action: string }) => l.module === "faculty" && l.action === "CREATE")).toBe(true);
  });
});
