import type { Request, Response, NextFunction } from "express";
import { ZodError, type ZodTypeAny } from "zod";
import { ApiError } from "../utils/http";

type Part = "body" | "query" | "params";

/** Validates and replaces req[part] with the parsed (coerced + stripped) value. */
export const validate =
  (schema: ZodTypeAny, part: Part = "body") =>
  (req: Request, _res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req[part]);
      if (part === "query") {
        // req.query is a getter in some setups; mutate in place.
        Object.keys(req.query).forEach((k) => delete (req.query as Record<string, unknown>)[k]);
        Object.assign(req.query, parsed);
      } else {
        (req as unknown as Record<Part, unknown>)[part] = parsed;
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const errors = err.issues.map((i) => ({ field: i.path.join("."), message: i.message }));
        return next(ApiError.badRequest(errors[0]?.message ? `Validation failed: ${errors[0].field ? errors[0].field + " – " : ""}${errors[0].message}` : "Validation failed", errors));
      }
      next(err);
    }
  };
