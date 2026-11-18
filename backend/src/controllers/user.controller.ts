import { z } from "zod";
import { User, Department } from "../models";
import { ApiError, asyncHandler, sendSuccess, parsePagination, buildMeta, escapeRegex } from "../utils/http";
import { requireUser } from "../middleware/auth";
import { audit } from "../services/audit.service";
import { revokeAllForUser } from "../services/token.service";
import { password } from "../validators/common";

export const createAdminSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  password,
});
export const updateUserSchema = z.object({ isActive: z.boolean().optional(), role: z.enum(["admin", "hod", "faculty"]).optional() });
export const resetUserPasswordSchema = z.object({ password });

export const list = asyncHandler(async (req, res) => {
  const q = req.query as Record<string, string | undefined>;
  const { page, limit, skip } = parsePagination(q, 20);
  const filter: Record<string, unknown> = {};
  if (q.role) filter.role = q.role;
  if (q.active) filter.isActive = q.active === "true";
  if (q.search) {
    const rx = new RegExp(escapeRegex(q.search), "i");
    filter.$or = [{ name: rx }, { email: rx }];
  }
  const [items, total] = await Promise.all([
    User.find(filter).populate({ path: "faculty", select: "facultyId department", populate: { path: "department", select: "code" } }).sort({ role: 1, name: 1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  sendSuccess(res, items, { meta: buildMeta(page, limit, total) });
});

export const createAdmin = asyncHandler(async (req, res) => {
  if (await User.exists({ email: req.body.email })) throw ApiError.conflict("A user with this email already exists");
  const user = await User.create({ ...req.body, role: "admin" });
  await audit(req, { action: "CREATE", module: "users", recordId: user._id, description: `Created administrator ${user.email}` });
  sendSuccess(res, user, { status: 201, message: "Administrator created" });
});

export const update = asyncHandler(async (req, res) => {
  const me = requireUser(req);
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound("User not found");
  if (String(user._id) === me.id) throw ApiError.badRequest("You cannot change your own role or status");
  const { isActive, role } = req.body as { isActive?: boolean; role?: "admin" | "hod" | "faculty" };
  if (role && role !== user.role) {
    if (role === "hod") throw ApiError.badRequest("Assign HODs from the Departments page");
    if (user.role === "hod" && (await Department.exists({ head: user.faculty }))) throw ApiError.conflict("This user is a department head. Assign a new head first.");
    if (role !== "admin" && !user.faculty) throw ApiError.badRequest("Only users with a faculty profile can have the faculty role");
    user.role = role;
  }
  if (isActive !== undefined) {
    user.isActive = isActive;
    if (!isActive) await revokeAllForUser(user._id);
  }
  await user.save();
  await audit(req, { action: isActive === false ? "DEACTIVATE" : "UPDATE", module: "users", recordId: user._id, description: `Updated user ${user.email}` });
  sendSuccess(res, user, { message: "User updated" });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound("User not found");
  user.password = req.body.password;
  await user.save();
  await revokeAllForUser(user._id);
  await audit(req, { action: "PASSWORD_RESET", module: "users", recordId: user._id, description: `Administrator reset password for ${user.email}` });
  sendSuccess(res, null, { message: "Password reset" });
});

