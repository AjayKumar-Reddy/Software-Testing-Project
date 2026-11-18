import request from "supertest";
import mongoose from "mongoose";
import { createApp } from "../src/app";
import { connectDB } from "../src/config/db";
import { env } from "../src/config/env";
import { User, Faculty, Department, Subject, SystemSetting } from "../src/models";
import { invalidateSettings } from "../src/services/settings.service";

export const app = createApp();
export const PASSWORD = "Test@1234";

export async function setupDB() {
  if (!env.mongoUri.includes("test")) throw new Error("Refusing to run tests against a non-test database");
  if (mongoose.connection.readyState !== 1) await connectDB();
  await mongoose.connection.db!.dropDatabase();
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
  invalidateSettings();
  await SystemSetting.create({ key: "global", academicYear: "2026-27", workingDays: [0, 1, 2, 3, 4, 5, 6] });
}

export async function teardownDB() {
  await mongoose.disconnect();
}

let counter = 0;
export async function makeDepartment(code = `D${++counter}`) {
  return Department.create({ name: `Department ${code}`, code });
}

export async function makeFaculty(department: unknown, role: "faculty" | "hod" = "faculty", overrides: Record<string, unknown> = {}) {
  const n = ++counter;
  const fac = await Faculty.create({
    facultyId: `T${String(n).padStart(4, "0")}`,
    firstName: "Test",
    lastName: `User${n}`,
    email: `user${n}@test.edu`,
    department,
    designation: "Assistant Professor",
    dateOfJoining: new Date("2020-01-01T00:00:00Z"),
    ...overrides,
  });
  const user = await User.create({ name: `Test User${n}`, email: fac.email, password: PASSWORD, role, faculty: fac._id });
  fac.user = user._id;
  await fac.save();
  if (role === "hod") await Department.updateOne({ _id: department }, { head: fac._id });
  return { faculty: fac, user };
}

export async function makeAdmin() {
  const n = ++counter;
  return User.create({ name: `Admin ${n}`, email: `admin${n}@test.edu`, password: PASSWORD, role: "admin" });
}

export async function makeSubject(department: unknown, assignedFaculty: unknown[] = [], overrides: Record<string, unknown> = {}) {
  const n = ++counter;
  return Subject.create({ name: `Subject ${n}`, code: `SUB${n}`, department, semester: 3, academicYear: "2026-27", credits: 3, assignedFaculty, ...overrides });
}

export async function tokenFor(email: string) {
  const res = await request(app).post("/api/auth/login").send({ email, password: PASSWORD });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.body.message}`);
  return res.body.data.accessToken as string;
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
