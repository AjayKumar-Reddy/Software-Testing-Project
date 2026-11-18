import { Types } from "mongoose";
import { Notification, User, Faculty } from "../models";
import { getSettings } from "./settings.service";
import { sendEmail } from "./email.service";

type NotifType = "announcement" | "leave" | "workload" | "timetable" | "system";
type EmailPref = "emailOnLeaveDecision" | "emailOnAnnouncement" | "emailOnWorkload";

interface NotifyInput {
  type: NotifType;
  title: string;
  message: string;
  link?: string;
  emailPref?: EmailPref;
}

/** Creates in-app notifications for users and optionally emails them (per settings). */
export async function notifyUsers(userIds: (string | Types.ObjectId)[], input: NotifyInput): Promise<void> {
  const ids = [...new Set(userIds.filter(Boolean).map(String))];
  if (!ids.length) return;
  try {
    await Notification.insertMany(
      ids.map((u) => ({ user: u, type: input.type, title: input.title, message: input.message, link: input.link ?? "" })),
    );
    const settings = await getSettings();
    if (settings.notifications?.emailEnabled && input.emailPref && settings.notifications[input.emailPref]) {
      const users = await User.find({ _id: { $in: ids }, isActive: true }).select("email").lean();
      await Promise.all(users.map((u) => sendEmail(u.email, input.title, input.message)));
    }
  } catch (err) {
    console.error("[notify] failed", err);
  }
}

/** Notify the user account linked to a faculty record. */
export async function notifyFaculty(facultyId: string | Types.ObjectId, input: NotifyInput): Promise<void> {
  const fac = await Faculty.findById(facultyId).select("user").lean();
  if (fac?.user) await notifyUsers([fac.user], input);
}

/** Notify all active users, or only those in the given departments (plus admins). */
export async function notifyAudience(departmentIds: string[] | null, input: NotifyInput, excludeUserId?: string) {
  let userIds: string[];
  if (!departmentIds || departmentIds.length === 0) {
    userIds = (await User.find({ isActive: true }).select("_id").lean()).map((u) => String(u._id));
  } else {
    const facs = await Faculty.find({ department: { $in: departmentIds }, user: { $ne: null } }).select("user").lean();
    userIds = facs.map((f) => String(f.user));
  }
  await notifyUsers(userIds.filter((id) => id !== excludeUserId), input);
}
