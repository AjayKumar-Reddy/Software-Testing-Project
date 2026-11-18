import crypto from "crypto";
import jwt, { type SignOptions } from "jsonwebtoken";
import type { Response, Request } from "express";
import { env } from "../config/env";
import { RefreshToken } from "../models";

export const REFRESH_COOKIE = "fh_rt";

export function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function signAccessToken(user: { _id: unknown; role: string }): string {
  return jwt.sign({ sub: String(user._id), role: user.role }, env.jwtAccessSecret, {
    expiresIn: env.jwtAccessExpires as SignOptions["expiresIn"],
  });
}

/** Issues an opaque refresh token; only its hash is persisted. */
export async function issueRefreshToken(userId: unknown, req: Request): Promise<string> {
  const token = crypto.randomBytes(48).toString("hex");
  await RefreshToken.create({
    user: userId,
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + env.refreshTokenDays * 86_400_000),
    userAgent: req.headers["user-agent"]?.slice(0, 200),
    ip: req.ip,
  });
  return token;
}

export function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: env.isProduction ? "none" : "lax",
    path: "/api/auth",
    maxAge: env.refreshTokenDays * 86_400_000,
  });
}

export function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, { path: "/api/auth", httpOnly: true, sameSite: env.isProduction ? "none" : "lax", secure: env.isProduction });
}

export async function revokeAllForUser(userId: unknown) {
  await RefreshToken.updateMany({ user: userId, revokedAt: null }, { revokedAt: new Date() });
}
