import { z } from "zod";
import { Types } from "mongoose";

export const objectId = z.string().refine((v) => Types.ObjectId.isValid(v), { message: "Invalid id" });
export const optionalObjectId = z.union([objectId, z.literal(""), z.null()]).optional().transform((v) => (v ? v : undefined));
export const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");
export const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:mm");
export const academicYear = z.string().regex(/^\d{4}-\d{2}$/, "Academic year must look like 2026-27");
export const idParam = z.object({ id: objectId });
export const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128)
  .regex(/[A-Za-z]/, "Password must contain a letter")
  .regex(/\d/, "Password must contain a number");

export const listQuery = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().trim().max(100).optional(),
  sort: z.string().max(40).optional(),
});
