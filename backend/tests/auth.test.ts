import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { app, setupDB, teardownDB, makeAdmin, makeDepartment, makeFaculty, PASSWORD, tokenFor, auth } from "./helpers";
import { User } from "../src/models";

describe("Authentication", () => {
  let adminEmail: string;
  beforeAll(async () => {
    await setupDB();
    adminEmail = (await makeAdmin()).email;
  });
  afterAll(teardownDB);

  it("never stores plain-text passwords", async () => {
    const u = await User.findOne({ email: adminEmail }).select("+password").lean();
    expect(u!.password).not.toBe(PASSWORD);
    expect(u!.password.startsWith("$2")).toBe(true);
  });

  it("logs in with valid credentials and sets an httpOnly refresh cookie", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: adminEmail, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTypeOf("string");
    expect(res.body.data.user.role).toBe("admin");
    expect(res.body.data.user.password).toBeUndefined();
    const cookie = String(res.headers["set-cookie"]);
    expect(cookie).toContain("fh_rt=");
    expect(cookie).toContain("HttpOnly");
  });

  it("rejects wrong passwords with 401", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: adminEmail, password: "wrong-password1" });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("validates login input", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "not-an-email", password: "" });
    expect(res.status).toBe(400);
  });

  it("blocks NoSQL operator injection", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: { $gt: "" }, password: { $gt: "" } });
    expect(res.status).toBe(400);
  });

  it("requires a token for protected routes", async () => {
    expect((await request(app).get("/api/auth/me")).status).toBe(401);
    expect((await request(app).get("/api/auth/me").set(auth("garbage"))).status).toBe(401);
  });

  it("rotates refresh tokens and rejects reuse", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email: adminEmail, password: PASSWORD });
    const first = await agent.post("/api/auth/refresh");
    expect(first.status).toBe(200);
    const oldCookie = String(first.request.getHeader?.("Cookie") ?? "");
    const second = await agent.post("/api/auth/refresh");
    expect(second.status).toBe(200);
    if (oldCookie) {
      const reuse = await request(app).post("/api/auth/refresh").set("Cookie", oldCookie);
      expect(reuse.status).toBe(401);
    }
  });

  it("denies login for deactivated accounts", async () => {
    const dept = await makeDepartment();
    const { user } = await makeFaculty(dept._id);
    await User.updateOne({ _id: user._id }, { isActive: false });
    const res = await request(app).post("/api/auth/login").send({ email: user.email, password: PASSWORD });
    expect(res.status).toBe(403);
  });

  it("changes the password after verifying the current one", async () => {
    const dept = await makeDepartment();
    const { user } = await makeFaculty(dept._id);
    const token = await tokenFor(user.email);
    const bad = await request(app).post("/api/auth/change-password").set(auth(token)).send({ currentPassword: "nope", newPassword: "Another@123" });
    expect(bad.status).toBe(400);
    const weak = await request(app).post("/api/auth/change-password").set(auth(token)).send({ currentPassword: PASSWORD, newPassword: "short" });
    expect(weak.status).toBe(400);
    const ok = await request(app).post("/api/auth/change-password").set(auth(token)).send({ currentPassword: PASSWORD, newPassword: "Another@123" });
    expect(ok.status).toBe(200);
    const login = await request(app).post("/api/auth/login").send({ email: user.email, password: "Another@123" });
    expect(login.status).toBe(200);
  });

  it("runs the forgot/reset password flow", async () => {
    const forgot = await request(app).post("/api/auth/forgot-password").send({ email: adminEmail });
    expect(forgot.status).toBe(200);
    const url: string = forgot.body.data.devResetUrl;
    expect(url).toContain("token=");
    const token = url.split("token=")[1];
    const reset = await request(app).post("/api/auth/reset-password").send({ token, password: "Reset@1234" });
    expect(reset.status).toBe(200);
    const reuse = await request(app).post("/api/auth/reset-password").send({ token, password: "Reset@5678" });
    expect(reuse.status).toBe(400);
    expect((await request(app).post("/api/auth/login").send({ email: adminEmail, password: "Reset@1234" })).status).toBe(200);
  });

  it("does not reveal whether an email exists", async () => {
    const res = await request(app).post("/api/auth/forgot-password").send({ email: "nobody@test.edu" });
    expect(res.status).toBe(200);
    expect(res.body.data.devResetUrl).toBeUndefined();
  });
});
