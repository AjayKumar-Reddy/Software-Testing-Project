import { AcademicSession, SystemSetting } from "../models";
import { ApiError, asyncHandler, sendSuccess } from "../utils/http";
import { audit } from "../services/audit.service";
import { invalidateSettings } from "../services/settings.service";
import { toDateOnly } from "../utils/dates";

function normalize(body: Record<string, any>) {
  return {
    ...body,
    startDate: toDateOnly(body.startDate),
    endDate: toDateOnly(body.endDate),
    semesters: (body.semesters ?? []).map((s: Record<string, string>) => ({ ...s, startDate: toDateOnly(s.startDate), endDate: toDateOnly(s.endDate) })),
  };
}

async function makeCurrent(id: unknown, name: string) {
  await AcademicSession.updateMany({ _id: { $ne: id } }, { isCurrent: false });
  await SystemSetting.updateOne({ key: "global" }, { academicYear: name }, { upsert: true });
  invalidateSettings();
}

export const list = asyncHandler(async (_req, res) => {
  sendSuccess(res, await AcademicSession.find().sort({ startDate: -1 }).lean());
});

export const create = asyncHandler(async (req, res) => {
  const session = await AcademicSession.create(normalize(req.body));
  if (session.isCurrent) await makeCurrent(session._id, session.name);
  await audit(req, { action: "CREATE", module: "session", recordId: session._id, description: `Created academic session ${session.name}` });
  sendSuccess(res, session, { status: 201, message: "Academic session created" });
});

export const update = asyncHandler(async (req, res) => {
  const session = await AcademicSession.findById(req.params.id);
  if (!session) throw ApiError.notFound("Session not found");
  session.set(normalize(req.body));
  await session.save();
  if (session.isCurrent) await makeCurrent(session._id, session.name);
  await audit(req, { action: "UPDATE", module: "session", recordId: session._id, description: `Updated academic session ${session.name}` });
  sendSuccess(res, session, { message: "Academic session updated" });
});

export const setCurrent = asyncHandler(async (req, res) => {
  const session = await AcademicSession.findById(req.params.id);
  if (!session) throw ApiError.notFound("Session not found");
  session.isCurrent = true;
  await session.save();
  await makeCurrent(session._id, session.name);
  await audit(req, { action: "UPDATE", module: "session", recordId: session._id, description: `Set ${session.name} as the current academic session` });
  sendSuccess(res, session, { message: `${session.name} is now the current session` });
});

export const remove = asyncHandler(async (req, res) => {
  const session = await AcademicSession.findById(req.params.id);
  if (!session) throw ApiError.notFound("Session not found");
  if (session.isCurrent) throw ApiError.conflict("The current academic session cannot be deleted");
  await session.deleteOne();
  await audit(req, { action: "DELETE", module: "session", recordId: session._id, description: `Deleted academic session ${session.name}` });
  sendSuccess(res, null, { message: "Session deleted" });
});
