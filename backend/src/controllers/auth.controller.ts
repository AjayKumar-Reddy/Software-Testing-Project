import crypto from "crypto";
import { User, RefreshToken, Faculty, type UserDoc } from "../models";
import { ApiError, asyncHandler, sendSuccess } from "../utils/http";
import {
  REFRESH_COOKIE,
  sha256,
  signAccessToken,
  issueRefreshToken,
  setRefreshCookie,
  clearRefreshCookie,
  revokeAllForUser,
} from "../services/token.service";
import { audit } from "../services/audit.service";
import { sendEmail } from "../services/email.service";
import { env } from "../config/env";
import { requireUser } from "../middleware/auth";

/** Public user representation used across the frontend. */
export async function serializeUser(userId: unknown) {
  const user = await User.findById(userId).lean();
  if (!user) return null;
  const faculty = user.faculty
    ? await Faculty.findById(user.faculty)
        .select("facultyId firstName lastName photo designation department status")
        .populate("department", "name code")
        .lean()
    : null;
  return {
    _id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    faculty,
  };
}

async function startSession(user: UserDoc, req: Parameters<typeof issueRefreshToken>[1], res: Parameters<typeof setRefreshCookie>[0]) {
  const refresh = await issueRefreshToken(user._id, req);
  setRefreshCookie(res, refresh);
  return { accessToken: signAccessToken(user), user: await serializeUser(user._id) };
}

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };
  const user = (await User.findOne({ email }).select("+password")) as UserDoc | null;
  if (!user || !(await user.comparePassword(password))) {
    await audit(req, { action: "LOGIN_FAILED", module: "auth", description: `Failed sign-in attempt for ${email}`, user: null });
    throw ApiError.unauthorized("Invalid email or password");
  }
  if (!user.isActive) throw ApiError.forbidden("Your account has been deactivated. Contact the administrator.");
  user.lastLoginAt = new Date();
  await user.save();
  const session = await startSession(user, req, res);
  await audit(req, {
    action: "LOGIN",
    module: "auth",
    recordId: user._id,
    description: `${user.name} signed in`,
    user: { id: String(user._id), name: user.name, role: user.role },
  });
  sendSuccess(res, session, { message: "Signed in successfully" });
});

export const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  // No cookie at all simply means "not signed in" – not an error for the client bootstrap.
  if (!token) return sendSuccess(res, null, { message: "No active session" });
  const stored = await RefreshToken.findOne({ tokenHash: sha256(token) });
  if (!stored) {
    clearRefreshCookie(res);
    throw new ApiError(401, "Session not found", { code: "NO_SESSION" });
  }
  if (stored.revokedAt) {
    // Reuse of a rotated token: assume theft and revoke every session for this user.
    await revokeAllForUser(stored.user);
    clearRefreshCookie(res);
    throw new ApiError(401, "Session expired, please sign in again", { code: "NO_SESSION" });
  }
  if (stored.expiresAt < new Date()) {
    clearRefreshCookie(res);
    throw new ApiError(401, "Session expired, please sign in again", { code: "NO_SESSION" });
  }
  const user = (await User.findById(stored.user)) as UserDoc | null;
  if (!user || !user.isActive) {
    clearRefreshCookie(res);
    throw new ApiError(401, "Account unavailable", { code: "NO_SESSION" });
  }
  stored.revokedAt = new Date();
  await stored.save();
  sendSuccess(res, await startSession(user, req, res));
});

export const logout = asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  if (token) await RefreshToken.updateOne({ tokenHash: sha256(token) }, { revokedAt: new Date() });
  clearRefreshCookie(res);
  sendSuccess(res, null, { message: "Signed out" });
});

export const me = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  sendSuccess(res, await serializeUser(user.id));
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body as { email: string };
  const user = await User.findOne({ email, isActive: true });
  let devResetUrl: string | undefined;
  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    await User.updateOne(
      { _id: user._id },
      { passwordResetToken: sha256(token), passwordResetExpires: new Date(Date.now() + 30 * 60_000) },
    );
    const url = `${env.clientUrls[0]}/reset-password?token=${token}`;
    const sent = await sendEmail(
      user.email,
      "Reset your FacultyHub password",
      `Hello ${user.name},\n\nUse the link below to reset your password. It expires in 30 minutes.\n\n${url}\n\nIf you did not request this, you can ignore this email.`,
    );
    if (!sent && !env.isProduction) devResetUrl = url; // dev fallback when SMTP isn't configured
    await audit(req, { action: "PASSWORD_RESET_REQUEST", module: "auth", recordId: user._id, user: { id: String(user._id), name: user.name, role: user.role } });
  }
  // Same response whether or not the account exists, to avoid user enumeration.
  sendSuccess(res, { devResetUrl }, { message: "If an account exists for that email, a reset link has been sent." });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body as { token: string; password: string };
  const user = await User.findOne({ passwordResetToken: sha256(token), passwordResetExpires: { $gt: new Date() } }).select(
    "+passwordResetToken +passwordResetExpires",
  );
  if (!user) throw ApiError.badRequest("This reset link is invalid or has expired");
  user.password = password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();
  await revokeAllForUser(user._id);
  await audit(req, { action: "PASSWORD_RESET", module: "auth", recordId: user._id, user: { id: String(user._id), name: user.name, role: user.role } });
  sendSuccess(res, null, { message: "Password updated. You can now sign in." });
});

export const changePassword = asyncHandler(async (req, res) => {
  const auth = requireUser(req);
  const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
  const user = (await User.findById(auth.id).select("+password")) as UserDoc | null;
  if (!user) throw ApiError.notFound("User not found");
  if (!(await user.comparePassword(currentPassword))) throw ApiError.badRequest("Current password is incorrect");
  user.password = newPassword;
  await user.save();
  await revokeAllForUser(user._id);
  await audit(req, { action: "PASSWORD_CHANGE", module: "auth", recordId: user._id });
  sendSuccess(res, await startSession(user, req, res), { message: "Password changed successfully" });
});
