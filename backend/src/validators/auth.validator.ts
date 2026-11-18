import { z } from "zod";
import { password } from "./common";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Password is required").max(128),
});
export const forgotSchema = z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email") });
export const resetSchema = z.object({ token: z.string().min(20).max(200), password });
export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1), newPassword: password })
  .refine((d) => d.currentPassword !== d.newPassword, { message: "New password must differ from the current one", path: ["newPassword"] });
