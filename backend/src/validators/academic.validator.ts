import { z } from "zod";
import { academicYear, dateString, objectId, optionalObjectId } from "./common";

export const departmentSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  code: z.string().trim().toUpperCase().min(2).max(12).regex(/^[A-Z0-9&-]+$/, "Code may contain letters and digits only"),
  description: z.string().trim().max(2000).optional(),
  establishedYear: z.coerce.number().int().min(1900).max(2100).optional(),
  email: z.string().trim().toLowerCase().email().optional().or(z.literal("")),
  phone: z.string().trim().max(20).optional(),
  location: z.string().trim().max(120).optional(),
  isActive: z.boolean().optional(),
});
export const assignHeadSchema = z.object({ facultyId: z.union([objectId, z.null()]) });

export const courseSchema = z.object({
  name: z.string().trim().min(2).max(150),
  code: z.string().trim().toUpperCase().min(2).max(20),
  department: objectId,
  level: z.enum(["UG", "PG", "Diploma", "PhD"]).optional(),
  durationYears: z.coerce.number().int().min(1).max(6).optional(),
  totalSemesters: z.coerce.number().int().min(1).max(12).optional(),
  intake: z.coerce.number().int().min(0).max(2000).optional(),
  description: z.string().trim().max(2000).optional(),
  isActive: z.boolean().optional(),
});

export const subjectSchema = z.object({
  name: z.string().trim().min(2, "Subject name is required").max(150),
  code: z.string().trim().toUpperCase().min(2).max(20).regex(/^[A-Z0-9-]+$/, "Code may contain letters, digits and dashes"),
  department: objectId,
  course: optionalObjectId,
  semester: z.coerce.number().int().min(1).max(12),
  academicYear,
  credits: z.coerce.number().min(0).max(10),
  type: z.enum(["theory", "lab", "elective"]).optional(),
  weeklyHours: z.coerce.number().min(0).max(20).optional(),
  description: z.string().trim().max(2000).optional(),
  assignedFaculty: z.array(objectId).optional(),
  isActive: z.boolean().optional(),
});
export const assignSubjectFacultySchema = z.object({ facultyIds: z.array(objectId).max(10) });

export const sessionSchema = z
  .object({
    name: academicYear,
    startDate: dateString,
    endDate: dateString,
    isCurrent: z.boolean().optional(),
    semesters: z
      .array(z.object({ name: z.string().trim().min(1).max(30), startDate: dateString, endDate: dateString }))
      .optional(),
  })
  .refine((d) => d.endDate > d.startDate, { message: "End date must be after start date", path: ["endDate"] });
