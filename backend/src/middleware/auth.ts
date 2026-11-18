import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { User, Faculty, type Role } from "../models";
import { ApiError } from "../utils/http";
import type { AuthUser } from "../types";

interface AccessPayload {
  sub: string;
  role: Role;
  iat: number;
}

/** Verifies the Bearer access token and attaches the user (and department scope) to req.user. */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) throw ApiError.unauthorized();
    let payload: AccessPayload;
    try {
      payload = jwt.verify(header.slice(7), env.jwtAccessSecret) as AccessPayload;
    } catch (e) {
      const expired = e instanceof jwt.TokenExpiredError;
      throw new ApiError(401, expired ? "Session expired" : "Invalid token", { code: expired ? "TOKEN_EXPIRED" : "TOKEN_INVALID" });
    }
    const user = await User.findById(payload.sub).lean();
    if (!user || !user.isActive) throw ApiError.unauthorized("Account is inactive or no longer exists");
    if (user.passwordChangedAt && payload.iat * 1000 < user.passwordChangedAt.getTime() - 1000) {
      throw new ApiError(401, "Password was changed. Please sign in again.", { code: "TOKEN_INVALID" });
    }
    let departmentId: string | null = null;
    if (user.faculty) {
      const fac = await Faculty.findById(user.faculty).select("department").lean();
      departmentId = fac?.department ? String(fac.department) : null;
    }
    const authUser: AuthUser = {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role as Role,
      facultyId: user.faculty ? String(user.faculty) : null,
      departmentId,
    };
    req.user = authUser;
    next();
  } catch (err) {
    next(err);
  }
}

/** Restricts a route to the given roles. Must run after authenticate. */
export const authorize =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
    next();
  };

export function requireUser(req: Request): AuthUser {
  if (!req.user) throw ApiError.unauthorized();
  return req.user;
}
