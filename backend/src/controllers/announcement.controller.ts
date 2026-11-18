import { Types } from "mongoose";
import { Announcement } from "../models";
import { ApiError, asyncHandler, sendSuccess, parsePagination, buildMeta, escapeRegex } from "../utils/http";
import { requireUser } from "../middleware/auth";
import { audit } from "../services/audit.service";
import { notifyAudience } from "../services/notification.service";
import type { AuthUser } from "../types";

/** Announcements a user may read: published, not expired, and addressed to all or their department. */
export function visibleFilter(user: AuthUser, now = new Date()) {
  const audience: Record<string, unknown>[] = [{ audience: "all" }];
  if (user.departmentId) audience.push({ audience: "departments", departments: new Types.ObjectId(user.departmentId) });
  return {
    publishAt: { $lte: now },
    $and: [{ $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] }, { $or: user.role === "admin" ? [{}] : audience }],
  };
}

function normalize(body: Record<string, any>, user: AuthUser) {
  const data: Record<string, unknown> = { ...body };
  for (const k of ["publishAt", "expiresAt", "eventDate"]) {
    if (k in data) data[k] = data[k] ? new Date(data[k] as string) : null;
  }
  if (user.role === "hod") {
    // HODs may only address their own department.
    data.audience = "departments";
    data.departments = [user.departmentId];
  }
  if (data.audience === "all") data.departments = [];
  return data;
}

function canManage(user: AuthUser, a: { createdBy: unknown; departments: unknown[] }) {
  if (user.role === "admin") return true;
  return user.role === "hod" && String(a.createdBy) === user.id;
}

export const list = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const q = req.query as Record<string, string | undefined>;
  const { page, limit, skip } = parsePagination(q, 10);
  let filter: Record<string, unknown>;
  if (q.manage === "true" && user.role !== "faculty") {
    filter = user.role === "admin" ? {} : { $or: [{ createdBy: new Types.ObjectId(user.id) }, { departments: new Types.ObjectId(user.departmentId!) }] };
  } else filter = visibleFilter(user);
  if (q.priority) filter.priority = q.priority;
  if (q.category) filter.category = q.category;
  if (q.search) filter.title = new RegExp(escapeRegex(q.search), "i");
  const [items, total] = await Promise.all([
    Announcement.find(filter).populate("createdBy", "name role").populate("departments", "name code").sort({ isPinned: -1, publishAt: -1 }).skip(skip).limit(limit).lean(),
    Announcement.countDocuments(filter),
  ]);
  const now = new Date();
  sendSuccess(
    res,
    items.map((a) => ({
      ...a,
      canManage: canManage(user, a),
      state: a.publishAt > now ? "scheduled" : a.expiresAt && a.expiresAt <= now ? "expired" : "published",
    })),
    { meta: buildMeta(page, limit, total) },
  );
});

export const upcomingEvents = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const items = await Announcement.find({ ...visibleFilter(user), category: "event", eventDate: { $gte: today } }).sort({ eventDate: 1 }).limit(6).lean();
  sendSuccess(res, items);
});

export const create = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const data = normalize(req.body, user);
  const a = await Announcement.create({ ...data, createdBy: user.id });
  if (a.publishAt <= new Date()) {
    await notifyAudience(
      a.audience === "all" ? null : a.departments.map(String),
      { type: "announcement", title: a.priority === "urgent" ? `Urgent: ${a.title}` : a.title, message: a.content.slice(0, 180), link: "/announcements", emailPref: "emailOnAnnouncement" },
      user.id,
    );
  }
  await audit(req, { action: "CREATE", module: "announcement", recordId: a._id, description: `Published announcement “${a.title}”` });
  sendSuccess(res, a, { status: 201, message: "Announcement published" });
});

export const update = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const a = await Announcement.findById(req.params.id);
  if (!a) throw ApiError.notFound("Announcement not found");
  if (!canManage(user, a)) throw ApiError.forbidden("You can only edit announcements you created");
  a.set(normalize(req.body, user));
  await a.save();
  await audit(req, { action: "UPDATE", module: "announcement", recordId: a._id, description: `Edited announcement “${a.title}”` });
  sendSuccess(res, a, { message: "Announcement updated" });
});

export const remove = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const a = await Announcement.findById(req.params.id);
  if (!a) throw ApiError.notFound("Announcement not found");
  if (!canManage(user, a)) throw ApiError.forbidden("You can only delete announcements you created");
  await a.deleteOne();
  await audit(req, { action: "DELETE", module: "announcement", recordId: a._id, description: `Deleted announcement “${a.title}”` });
  sendSuccess(res, null, { message: "Announcement deleted" });
});
