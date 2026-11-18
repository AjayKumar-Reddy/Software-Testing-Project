import { Router } from "express";
import * as c from "../controllers/auth.controller";
import { validate } from "../middleware/validate";
import { authenticate } from "../middleware/auth";
import { authLimiter } from "../middleware/rateLimit";
import { loginSchema, forgotSchema, resetSchema, changePasswordSchema } from "../validators/auth.validator";

const r = Router();
r.post("/login", authLimiter, validate(loginSchema), c.login);
r.post("/refresh", c.refresh);
r.post("/logout", c.logout);
r.get("/me", authenticate, c.me);
r.post("/forgot-password", authLimiter, validate(forgotSchema), c.forgotPassword);
r.post("/reset-password", authLimiter, validate(resetSchema), c.resetPassword);
r.post("/change-password", authenticate, authLimiter, validate(changePasswordSchema), c.changePassword);
export default r;
