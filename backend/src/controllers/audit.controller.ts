import { AuditLog } from "../models";
import { asyncHandler, sendSuccess, parsePagination, buildMeta, escapeRegex } from "../utils/http";
import { toDateOnly } from "../utils/dates";
import { addDays } from "date-fns";

export const list = asyncHandler(async (req, res) => {
  const q = req.query as Record<string, string | undefined>;
  const { page, limit, skip } = parsePagination(q, 20);
  const filter: Record<string, unknown> = {};
  if (q.module) filter.module = q.module;
  if (q.action) filter.action = q.action;
  if (q.user) filter.user = q.user;
  if (q.from || q.to) {
    filter.createdAt = { ...(q.from ? { $gte: toDateOnly(q.from) } : {}), ...(q.to ? { $lt: addDays(toDateOnly(q.to), 1) } : {}) };
  }
  if (q.search) {
    const rx = new RegExp(escapeRegex(q.search), "i");
    filter.$or = [{ description: rx }, { userName: rx }, { recordId: rx }];
  }
  const [items, total] = await Promise.all([AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), AuditLog.countDocuments(filter)]);
  sendSuccess(res, items, { meta: buildMeta(page, limit, total) });
});

export const facets = asyncHandler(async (_req, res) => {
  const [modules, actions] = await Promise.all([AuditLog.distinct("module"), AuditLog.distinct("action")]);
  sendSuccess(res, { modules: modules.sort(), actions: actions.sort() });
});
