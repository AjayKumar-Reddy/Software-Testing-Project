import { Course, Subject, Department, Faculty } from "../models";
import { ApiError, asyncHandler, sendSuccess } from "../utils/http";
import { requireUser } from "../middleware/auth";
import { resolveDepartment, assertDepartmentAccess } from "../services/scope.service";
import { audit } from "../services/audit.service";

export const list = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const filter: Record<string, unknown> = {};
  const dept = user.role === "faculty" ? undefined : resolveDepartment(user, req.query.department as string | undefined);
  if (dept) filter.department = dept;
  const courses = await Course.find(filter).populate("department", "name code").sort({ name: 1 }).lean();
  const counts = await Subject.aggregate([{ $match: { course: { $in: courses.map((c) => c._id) } } }, { $group: { _id: "$course", n: { $sum: 1 } } }]);
  sendSuccess(res, courses.map((c) => ({ ...c, subjectCount: counts.find((x) => String(x._id) === String(c._id))?.n ?? 0 })));
});

export const create = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  assertDepartmentAccess(user, req.body.department);
  if (!(await Department.exists({ _id: req.body.department }))) throw ApiError.badRequest("Department does not exist");
  const course = await Course.create(req.body);
  await audit(req, { action: "CREATE", module: "course", recordId: course._id, description: `Created course ${course.code}` });
  sendSuccess(res, course, { status: 201, message: "Course created" });
});

export const update = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const course = await Course.findById(req.params.id);
  if (!course) throw ApiError.notFound("Course not found");
  assertDepartmentAccess(user, course.department);
  if (req.body.department) assertDepartmentAccess(user, req.body.department);
  course.set(req.body);
  await course.save();
  await audit(req, { action: "UPDATE", module: "course", recordId: course._id, description: `Updated course ${course.code}` });
  sendSuccess(res, course, { message: "Course updated" });
});

export const remove = asyncHandler(async (req, res) => {
  const user = requireUser(req);
  const course = await Course.findById(req.params.id);
  if (!course) throw ApiError.notFound("Course not found");
  assertDepartmentAccess(user, course.department);
  const n = await Subject.countDocuments({ course: course._id });
  if (n) throw ApiError.conflict(`Cannot delete: ${n} subject(s) belong to this course`);
  await Faculty.updateMany({ courses: course._id }, { $pull: { courses: course._id } });
  await course.deleteOne();
  await audit(req, { action: "DELETE", module: "course", recordId: course._id, description: `Deleted course ${course.code}` });
  sendSuccess(res, null, { message: "Course deleted" });
});
