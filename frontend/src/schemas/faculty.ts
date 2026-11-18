import { z } from "zod";

const phone = z.string().trim().regex(/^$|^[+\d][\d\s-]{5,19}$/, "Enter a valid phone number");

export const facultySchema = z.object({
  facultyId: z.string().trim().toUpperCase().regex(/^$|^[A-Z0-9-]{3,20}$/, "Use 3–20 letters, digits or dashes").optional(),
  firstName: z.string().trim().min(1, "First name is required").max(60),
  lastName: z.string().trim().min(1, "Last name is required").max(60),
  gender: z.string().optional(),
  dateOfBirth: z.string().optional(),
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email"),
  phone: phone.optional(),
  address: z.object({ line1: z.string().optional(), city: z.string().optional(), state: z.string().optional(), postalCode: z.string().optional(), country: z.string().optional() }),
  emergencyContact: z.object({ name: z.string().optional(), relation: z.string().optional(), phone: phone.optional() }),
  department: z.string().min(1, "Select a department"),
  designation: z.string().min(1, "Select a designation"),
  qualification: z.string().max(200).optional(),
  specialization: z.string().max(200).optional(),
  experienceYears: z.coerce.number({ invalid_type_error: "Enter a number" }).min(0, "Cannot be negative").max(60),
  dateOfJoining: z.string().min(1, "Joining date is required"),
  employmentType: z.string().min(1),
  status: z.string().min(1),
  createAccount: z.boolean().optional(),
  password: z.string().regex(/^$|^(?=.*[A-Za-z])(?=.*\d).{8,}$/, "At least 8 characters with a letter and a number").optional(),
});

export type FacultyFormValues = z.infer<typeof facultySchema>;
