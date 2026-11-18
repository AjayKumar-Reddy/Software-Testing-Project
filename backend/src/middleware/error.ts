import type { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { MulterError } from "multer";
import { ApiError } from "../utils/http";
import { env } from "../config/env";

export function notFound(req: Request, _res: Response, next: NextFunction) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  let status = 500;
  let message = "Internal server error";
  let details: unknown;

  if (err instanceof ApiError) {
    status = err.statusCode;
    message = err.message;
    details = err.details;
  } else if (err instanceof mongoose.Error.ValidationError) {
    status = 400;
    message = Object.values(err.errors)[0]?.message ?? "Validation failed";
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    message = `Invalid value for ${err.path}`;
  } else if (typeof err === "object" && err && (err as { code?: number }).code === 11000) {
    status = 409;
    const keyValue = (err as { keyValue?: Record<string, unknown> }).keyValue ?? {};
    const field = Object.keys(keyValue)[0] ?? "field";
    message = `A record with this ${field} already exists`;
    details = keyValue;
  } else if (err instanceof MulterError) {
    status = 400;
    message = err.code === "LIMIT_FILE_SIZE" ? "File is too large" : err.message;
  } else if (err instanceof SyntaxError && "body" in (err as object)) {
    status = 400;
    message = "Malformed JSON body";
  }

  if (status >= 500 && !env.isTest) console.error("[error]", err);

  res.status(status).json({
    success: false,
    message,
    details,
    ...(status >= 500 && !env.isProduction && err instanceof Error ? { stack: err.stack } : {}),
  });
}
