import { z } from "zod";

export const passwordRule = z
  .string()
  .min(8, "At least 8 characters")
  .regex(/[A-Za-z]/, "Must contain a letter")
  .regex(/\d/, "Must contain a number");

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});
export type LoginValues = z.infer<typeof loginSchema>;

export const forgotSchema = z.object({ email: z.string().trim().min(1, "Email is required").email("Enter a valid email address") });

export const resetSchema = z
  .object({ password: passwordRule, confirm: z.string() })
  .refine((d) => d.password === d.confirm, { message: "Passwords do not match", path: ["confirm"] });

export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1, "Enter your current password"), newPassword: passwordRule, confirm: z.string() })
  .refine((d) => d.newPassword === d.confirm, { message: "Passwords do not match", path: ["confirm"] })
  .refine((d) => d.newPassword !== d.currentPassword, { message: "New password must be different", path: ["newPassword"] });
