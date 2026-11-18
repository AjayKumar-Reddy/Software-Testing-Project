import { Types } from "mongoose";
import type { AuthUser } from "../types";
import { ApiError } from "../utils/http";

/**
 * Resolves the department filter for a list query.
 *  - admin: optional requested department
 *  - hod:   always their own department (requesting another is forbidden)
 *  - faculty: their own department
 */
export function resolveDepartment(user: AuthUser, requested?: string): string | undefined {
  if (user.role === "admin") return requested || undefined;
  if (!user.departmentId) throw ApiError.forbidden("Your account is not linked to a department");
  if (requested && requested !== user.departmentId) throw ApiError.forbidden("You can only access your own department");
  return user.departmentId;
}

export function canAccessDepartment(user: AuthUser, departmentId: unknown): boolean {
  if (user.role === "admin") return true;
  return Boolean(user.departmentId) && String(departmentId) === user.departmentId;
}

export function assertDepartmentAccess(user: AuthUser, departmentId: unknown) {
  if (!canAccessDepartment(user, departmentId)) throw ApiError.forbidden("You can only manage records in your own department");
}

/** Admin: any faculty. HOD: faculty in their department. Faculty: only themselves. */
export function assertFacultyAccess(user: AuthUser, faculty: { _id: unknown; department: unknown }) {
  if (user.role === "admin") return;
  if (user.role === "hod" && canAccessDepartment(user, (faculty.department as { _id?: unknown })?._id ?? faculty.department)) return;
  if (user.facultyId && String(faculty._id) === user.facultyId) return;
  throw ApiError.forbidden("You do not have access to this faculty record");
}

export function oid(id: string | undefined | null) {
  return id ? new Types.ObjectId(id) : undefined;
}
