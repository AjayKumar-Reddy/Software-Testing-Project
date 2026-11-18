import { Timetable, Subject, Faculty } from "../models";
import { ApiError, asyncHandler, sendSuccess } from "../utils/http";
import { requireUser } from "../middleware/auth";
import { resolveDepartment, assertDepartmentAccess } from "../services/scope.service";
import { audit } from "../services/audit.service";
import { notifyFaculty } from "../services/notification.service";
import { getSettings } from "../services/settings.service";
import { WEEKDAYS } from "../utils/dates";

const POP = [
  { path: "faculty", select: "facultyId firstName lastName designation" },
  { path: "subject", select: "name code type semester" },
  { path: "department", select: "name code" },
];

interface SlotInput {
  faculty: string;
  subject: string;
  section: string;
  room: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  academicYear?: string;
}

/**
 * Finds entries overlapping the given slot that share the faculty, room or section.
 * Two intervals overlap when start < otherEnd AND end > otherStart (HH:mm strings compare correctly).
 */
export async function findConflicts(slot: Required<Pick<SlotInput, "academicYear">> & SlotInput, excludeId?: string) {
  const overlapping = await Timetable.find({
    academicYear: slot.academicYear,
    dayOfWeek: slot.dayOfWeek,
    startTime: { $lt: slot.endTime },
    endTime: { $gt: slot.startTime },
    $or: [{ faculty: slot.faculty }, { room: slot.room.toUpperCase() }, { section: slot.section.toUpperCase() }],
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  })
    .populate(POP)
    .lean();
  return overlapping.map((e) => {
    const types: string[] = [];
    if (String((e.faculty as unknown as { _id: unknown })._id) === slot.faculty) types.push("faculty");
    if (e.room === slot.room.toUpperCase()) types.push("room");
    if (e.section === slot.section.toUpperCase()) types.push("section");
    const f = e.faculty as unknown as { firstName: string; lastName: string };
    const s = e.subject as unknown as { code: string };
    return {
      entry: e,
      types,
      message: `${WEEKDAYS[e.dayOfWeek]} ${e.startTime}–${e.endTime}: ${types
        .map((t) => (t === "faculty" ? `${f.firstName} ${f.lastName} is already teaching ${s.code}` : t === "room" ? `room ${e.room} is booked` : `section ${e.section} already has ${s.code}`))
        .join("; ")}`,
    };
  });
}

async function validateSlot(slot: SlotInput, academicYear: string) {
  const settings = await getSettings();
  if (!settings.workingDays.includes(slot.dayOfWeek)) throw ApiError.badRequest(`${WEEKDAYS[slot.dayOfWeek]} is not a working day`);
  const [subject, faculty] = await Promise.all([Subject.findById(slot.subject).lean(), Faculty.findById(slot.faculty).select("isArchived status").lean()]);
  if (!subject) throw ApiError.badRequest("Subject not found");
  if (!faculty || faculty.isArchived) throw ApiError.badRequest("Faculty member not found");
  if (!subject.assignedFaculty.map(String).includes(slot.faculty)) {
    throw ApiError.conflict("This faculty member is not allocated to the selected subject. Allocate the subject first.");
  }
  return { subject, academicYear };
}

export const list = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const q = req.query as Record<string, string | undefined>;
  const settings = await getSettings();
  const filter: Record<string, unknown> = { academicYear: q.academicYear || settings.academicYear };
  if (user.role === "faculty") filter.faculty = user.facultyId;
  else {
    const dept = resolveDepartment(user, q.department);
    if (dept) filter.department = dept;
    if (q.faculty) filter.faculty = q.faculty;
  }
  if (q.section) filter.section = q.section;
  if (q.room) filter.room = q.room;
  const entries = await Timetable.find(filter).populate(POP).sort({ dayOfWeek: 1, startTime: 1 }).lean();
  sendSuccess(res, entries, { meta: { slots: settings.timetableSlots, workingDays: settings.workingDays, academicYear: filter.academicYear } });
});

/** Distinct sections & rooms for filters. */
export const meta = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const settings = await getSettings();
  const filter: Record<string, unknown> = { academicYear: settings.academicYear };
  if (user.role !== "admin" && user.departmentId) filter.department = user.departmentId;
  const [sections, rooms] = await Promise.all([Timetable.distinct("section", filter), Timetable.distinct("room", { academicYear: settings.academicYear })]);
  sendSuccess(res, { sections: sections.sort(), rooms: rooms.sort(), slots: settings.timetableSlots, workingDays: settings.workingDays });
});

export const checkConflicts = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  const body = req.body as SlotInput & { excludeId?: string };
  const conflicts = await findConflicts({ ...body, academicYear: body.academicYear || settings.academicYear }, (req.query.excludeId as string) || undefined);
  sendSuccess(res, { conflicts: conflicts.map((c) => ({ types: c.types, message: c.message, id: c.entry._id })) });
});

export const create = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const settings = await getSettings();
  const body = req.body as SlotInput;
  const academicYear = body.academicYear || settings.academicYear;
  const { subject } = await validateSlot(body, academicYear);
  assertDepartmentAccess(user, subject.department);
  const conflicts = await findConflicts({ ...body, academicYear });
  if (conflicts.length) throw ApiError.conflict(`Scheduling conflict: ${conflicts[0].message}`, conflicts.map((c) => ({ types: c.types, message: c.message })));
  const entry = await Timetable.create({ ...body, academicYear, department: subject.department, semester: subject.semester, createdBy: user.id });
  await notifyFaculty(body.faculty, {
    type: "timetable",
    title: "Timetable updated",
    message: `New class: ${subject.code} on ${WEEKDAYS[body.dayOfWeek]} ${body.startTime}–${body.endTime} in ${entry.room} (${entry.section}).`,
    link: "/timetable",
  });
  await audit(req, { action: "CREATE", module: "timetable", recordId: entry._id, description: `Scheduled ${subject.code} ${WEEKDAYS[body.dayOfWeek]} ${body.startTime}` });
  sendSuccess(res, await Timetable.findById(entry._id).populate(POP).lean(), { status: 201, message: "Class scheduled" });
});

export const update = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const entry = await Timetable.findById(req.params.id);
  if (!entry) throw ApiError.notFound("Timetable entry not found");
  assertDepartmentAccess(user, entry.department);
  const body = req.body as SlotInput;
  const academicYear = body.academicYear || entry.academicYear;
  const { subject } = await validateSlot(body, academicYear);
  assertDepartmentAccess(user, subject.department);
  const conflicts = await findConflicts({ ...body, academicYear }, String(entry._id));
  if (conflicts.length) throw ApiError.conflict(`Scheduling conflict: ${conflicts[0].message}`, conflicts.map((c) => ({ types: c.types, message: c.message })));
  const previousFaculty = String(entry.faculty);
  entry.set({ ...body, academicYear, department: subject.department, semester: subject.semester });
  await entry.save();
  const msg = { type: "timetable" as const, title: "Timetable changed", message: `${subject.code} is now on ${WEEKDAYS[body.dayOfWeek]} ${body.startTime}–${body.endTime} in ${entry.room}.`, link: "/timetable" };
  await notifyFaculty(body.faculty, msg);
  if (previousFaculty !== body.faculty) await notifyFaculty(previousFaculty, { ...msg, message: `${subject.code} on ${WEEKDAYS[body.dayOfWeek]} has been reassigned to another faculty member.` });
  await audit(req, { action: "UPDATE", module: "timetable", recordId: entry._id, description: `Updated timetable entry ${subject.code}` });
  sendSuccess(res, await Timetable.findById(entry._id).populate(POP).lean(), { message: "Timetable entry updated" });
});

export const remove = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const entry = await Timetable.findById(req.params.id).populate("subject", "code");
  if (!entry) throw ApiError.notFound("Timetable entry not found");
  assertDepartmentAccess(user, entry.department);
  await entry.deleteOne();
  const code = (entry.subject as unknown as { code: string })?.code ?? "A class";
  await notifyFaculty(entry.faculty, { type: "timetable", title: "Class removed", message: `${code} on ${WEEKDAYS[entry.dayOfWeek]} ${entry.startTime} was removed from your timetable.`, link: "/timetable" });
  await audit(req, { action: "DELETE", module: "timetable", recordId: entry._id, description: `Removed timetable entry ${code}` });
  sendSuccess(res, null, { message: "Timetable entry removed" });
});
