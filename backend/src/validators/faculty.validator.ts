import { z } from "zod";
import { EMPLOYMENT_STATUSES, EMPLOYMENT_TYPES, GENDERS } from "../models/constants";
import { dateString, objectId, listQuery, password } from "./common";

const phone = z.string().trim().max(20).regex(/^[+\d][\d\s-]{5,19}$/, "Enter a valid phone number").or(z.literal(""));

const address = z.object({
  line1: z.string().trim().max(200).optional(),
  city: z.string().trim().max(80).optional(),
  state: z.string().trim().max(80).optional(),
  postalCode: z.string().trim().max(12).optional(),
  country: z.string().trim().max(80).optional(),
});
const emergencyContact = z.object({
  name: z.string().trim().max(100).optional(),
  relation: z.string().trim().max(50).optional(),
  phone: phone.optional(),
});

const base = {
  facultyId: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{3,20}$/, "Faculty ID may contain letters, digits and dashes").optional().or(z.literal("")),
  firstName: z.string().trim().min(1, "First name is required").max(60),
  lastName: z.string().trim().min(1, "Last name is required").max(60),
  gender: z.enum(GENDERS).optional().or(z.literal("")).transform((v) => v || undefined),
  dateOfBirth: dateString.optional().or(z.literal("")).transform((v) => v || undefined),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  phone: phone.optional(),
  address: address.optional(),
  emergencyContact: emergencyContact.optional(),
  department: objectId,
  designation: z.string().trim().min(1, "Designation is required").max(60),
  qualification: z.string().trim().max(200).optional(),
  specialization: z.string().trim().max(200).optional(),
  experienceYears: z.coerce.number().min(0).max(60).optional(),
  dateOfJoining: dateString,
  employmentType: z.enum(EMPLOYMENT_TYPES).optional(),
  status: z.enum(EMPLOYMENT_STATUSES).optional(),
  courses: z.array(objectId).optional(),
};

export const createFacultySchema = z.object({
  ...base,
  createAccount: z.boolean().optional().default(true),
  password: password.optional().or(z.literal("")).transform((v) => v || undefined),
});

export const updateFacultySchema = z.object(base).partial();

/** Fields a faculty member may edit on their own profile. */
export const SELF_EDITABLE_FIELDS = ["phone", "address", "emergencyContact", "gender", "dateOfBirth", "qualification", "specialization"] as const;

export const statusSchema = z.object({ status: z.enum(EMPLOYMENT_STATUSES) });

export const facultyListQuery = listQuery.extend({
  department: objectId.optional(),
  designation: z.string().max(60).optional(),
  status: z.enum(EMPLOYMENT_STATUSES).optional(),
  employmentType: z.enum(EMPLOYMENT_TYPES).optional(),
  archived: z.enum(["true", "false", "all"]).optional(),
});
