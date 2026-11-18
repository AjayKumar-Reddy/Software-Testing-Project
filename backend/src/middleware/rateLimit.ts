import rateLimit from "express-rate-limit";
import { env } from "../config/env";

const skip = () => env.isTest;

/** Brute-force protection for login / password reset. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip,
  message: { success: false, message: "Too many attempts. Please try again in a few minutes." },
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 600,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip,
  message: { success: false, message: "Too many requests, please slow down." },
});
