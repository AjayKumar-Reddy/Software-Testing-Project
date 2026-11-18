import type { Request, Response, NextFunction } from "express";

/**
 * Strips keys that start with "$" or contain "." from request input to prevent
 * MongoDB operator injection (e.g. { "email": { "$gt": "" } }), and trims strings.
 */
function clean(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k.startsWith("$") || k.includes(".")) continue;
      out[k] = clean(v);
    }
    return out;
  }
  if (typeof value === "string") return value.replace(/\0/g, "");
  return value;
}

export function sanitizeInput(req: Request, _res: Response, next: NextFunction) {
  if (req.body) req.body = clean(req.body);
  if (req.params) req.params = clean(req.params) as Request["params"];
  if (req.query) {
    const cleaned = clean(req.query) as Record<string, unknown>;
    Object.keys(req.query).forEach((k) => delete (req.query as Record<string, unknown>)[k]);
    Object.assign(req.query, cleaned);
  }
  next();
}
