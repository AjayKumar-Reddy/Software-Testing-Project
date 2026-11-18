import type { Request, Response, NextFunction, RequestHandler } from "express";

/** Error carrying an HTTP status code; thrown anywhere and formatted by the error middleware. */
export class ApiError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }

  static badRequest(msg = "Bad request", details?: unknown) {
    return new ApiError(400, msg, details);
  }
  static unauthorized(msg = "Authentication required") {
    return new ApiError(401, msg);
  }
  static forbidden(msg = "You do not have permission to perform this action") {
    return new ApiError(403, msg);
  }
  static notFound(msg = "Resource not found") {
    return new ApiError(404, msg);
  }
  static conflict(msg = "Conflict", details?: unknown) {
    return new ApiError(409, msg, details);
  }
}

/** Wraps an async route handler so rejected promises reach the error middleware. */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Standard success envelope: { success, message?, data, meta? } */
export function sendSuccess<T>(
  res: Response,
  data: T,
  opts: { status?: number; message?: string; meta?: PageMeta | Record<string, unknown> } = {},
) {
  return res.status(opts.status ?? 200).json({
    success: true,
    message: opts.message,
    data,
    meta: opts.meta,
  });
}

export function parsePagination(query: Record<string, unknown>, defaultLimit = 10) {
  const page = Math.max(1, parseInt(String(query.page ?? "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(query.limit ?? defaultLimit), 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

export function buildMeta(page: number, limit: number, total: number): PageMeta {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export function parseSort(sortParam: unknown, allowed: string[], fallback = "-createdAt"): Record<string, 1 | -1> {
  const raw = typeof sortParam === "string" && sortParam ? sortParam : fallback;
  const field = raw.replace(/^-/, "");
  if (!allowed.includes(field)) return parseSort(fallback, [fallback.replace(/^-/, "")], fallback);
  return { [field]: raw.startsWith("-") ? -1 : 1 };
}

/** Escape user input for safe use inside a RegExp. */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
