import { Types } from "mongoose";
import { Workload, Faculty } from "../models";
import { getSettings } from "./settings.service";

export type WorkloadStatus = "overloaded" | "optimal" | "underutilized";

export function termSemesters(term?: string): number[] | undefined {
  if (term === "odd") return [1, 3, 5, 7, 9, 11];
  if (term === "even") return [2, 4, 6, 8, 10, 12];
  return undefined;
}

export function classify(hours: number, min: number, max: number): WorkloadStatus {
  if (hours > max) return "overloaded";
  if (hours < min) return "underutilized";
  return "optimal";
}

/** Total weekly hours per faculty (including faculty with zero allocation) for a year/term. */
export async function facultyWorkloadSummary(opts: { academicYear: string; term?: string; department?: string }) {
  const settings = await getSettings();
  const min = settings.workload?.minWeeklyHours ?? 10;
  const max = settings.workload?.maxWeeklyHours ?? 18;
  const semesters = termSemesters(opts.term);
  const match: Record<string, unknown> = { academicYear: opts.academicYear };
  if (semesters) match.semester = { $in: semesters };

  const facFilter: Record<string, unknown> = { isArchived: false, status: { $in: ["active", "probation"] } };
  if (opts.department) facFilter.department = new Types.ObjectId(opts.department);
  const faculty = await Faculty.find(facFilter).select("facultyId firstName lastName designation department photo").populate("department", "name code").lean();

  const sums = await Workload.aggregate([
    { $match: { ...match, faculty: { $in: faculty.map((f) => f._id) } } },
    {
      $group: {
        _id: "$faculty",
        hours: { $sum: "$weeklyHours" },
        subjects: { $addToSet: "$subject" },
        lecture: { $sum: { $cond: [{ $eq: ["$type", "lecture"] }, "$weeklyHours", 0] } },
        lab: { $sum: { $cond: [{ $eq: ["$type", "lab"] }, "$weeklyHours", 0] } },
        tutorial: { $sum: { $cond: [{ $eq: ["$type", "tutorial"] }, "$weeklyHours", 0] } },
      },
    },
  ]);
  const rows = faculty.map((f) => {
    const s = sums.find((x) => String(x._id) === String(f._id));
    const hours = s?.hours ?? 0;
    return {
      faculty: { ...f, fullName: `${f.firstName} ${f.lastName}` },
      hours,
      subjectCount: s?.subjects.length ?? 0,
      lecture: s?.lecture ?? 0,
      lab: s?.lab ?? 0,
      tutorial: s?.tutorial ?? 0,
      utilization: Math.round((hours / max) * 100),
      status: classify(hours, min, max),
    };
  });
  rows.sort((a, b) => b.hours - a.hours);
  return { limits: { min, max }, rows };
}
