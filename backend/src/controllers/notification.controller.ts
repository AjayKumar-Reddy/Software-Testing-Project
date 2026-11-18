import { Notification } from "../models";
import { ApiError, asyncHandler, sendSuccess, parsePagination, buildMeta } from "../utils/http";
import { requireUser } from "../middleware/auth";

export const list = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const q = req.query as Record<string, string | undefined>;
  const { page, limit, skip } = parsePagination(q, 15);
  const filter: Record<string, unknown> = { user: user.id };
  if (q.unread === "true") filter.isRead = false;
  if (q.type) filter.type = q.type;
  const [items, total, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ user: user.id, isRead: false }),
  ]);
  sendSuccess(res, items, { meta: { ...buildMeta(page, limit, total), unread } });
});

export const unreadCount = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  sendSuccess(res, { count: await Notification.countDocuments({ user: user.id, isRead: false }) });
});

export const markRead = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const n = await Notification.findOneAndUpdate({ _id: req.params.id, user: user.id }, { isRead: true, readAt: new Date() }, { new: true });
  if (!n) throw ApiError.notFound("Notification not found");
  sendSuccess(res, n);
});

export const markAllRead = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const r = await Notification.updateMany({ user: user.id, isRead: false }, { isRead: true, readAt: new Date() });
  sendSuccess(res, { updated: r.modifiedCount }, { message: "All notifications marked as read" });
});

export const remove = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const r = await Notification.deleteOne({ _id: req.params.id, user: user.id });
  if (!r.deletedCount) throw ApiError.notFound("Notification not found");
  sendSuccess(res, null, { message: "Notification removed" });
});
