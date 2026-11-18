import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import routes from "./routes";
import { errorHandler, notFound } from "./middleware/error";
import { sanitizeInput } from "./middleware/sanitize";
import { apiLimiter } from "./middleware/rateLimit";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin || env.clientUrls.includes(origin)) return cb(null, true);
        cb(new Error(`Origin ${origin} not allowed by CORS`));
      },
      credentials: true,
      exposedHeaders: ["Content-Disposition"],
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));
  app.use(cookieParser());
  app.use(sanitizeInput);
  if (!env.isTest) app.use(morgan(env.isProduction ? "combined" : "dev"));

  // Public, non-sensitive uploads only (avatars & logo). Leave documents are served through an authorised route.
  app.use("/uploads/avatars", express.static(`${env.uploadDir}/avatars`, { maxAge: "7d" }));
  app.use("/uploads/logos", express.static(`${env.uploadDir}/logos`, { maxAge: "7d" }));

  app.use("/api", apiLimiter, routes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
