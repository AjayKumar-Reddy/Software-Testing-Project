import { Types } from "mongoose";
import { Attendance } from "../models";
import type { AttendanceStatus } from "../models/constants";

export interface AttendanceStats {
  total: number;
  present: number;
  absent: number;
  late: number;
  onLeave: number;
  /** (present + late) / (total − onLeave) × 100, rounded to 1 decimal. null when there are no countable days. */
  percentage: number | null;
}

export function computeStats(records: { status: AttendanceStatus | string }[]): AttendanceStats {
  const s = { total: records.length, present: 0, absent: 0, late: 0, onLeave: 0 };
  for (const r of records) {
    if (r.status === "present") s.present++;
    else if (r.status === "absent") s.absent++;
    else if (r.status === "late") s.late++;
    else if (r.status === "on_leave") s.onLeave++;
  }
  return { ...s, percentage: percentageOf(s.present, s.late, s.total, s.onLeave) };
}

export function percentageOf(present: number, late: number, total: number, onLeave: number): number | null {
  const countable = total - onLeave;
  if (countable <= 0) return null;
  return Math.round(((present + late) / countable) * 1000) / 10;
}

/** Aggregated attendance statistics for a filter (uses the DB, not in-memory). */
export async function aggregateStats(match: Record<string, unknown>): Promise<AttendanceStats> {
  const rows = await Attendance.aggregate<{ _id: string; n: number }>([{ $match: match }, { $group: { _id: "$status", n: { $sum: 1 } } }]);
  const get = (k: string) => rows.find((r) => r._id === k)?.n ?? 0;
  const present = get("present");
  const absent = get("absent");
  const late = get("late");
  const onLeave = get("on_leave");
  const total = present + absent + late + onLeave;
  return { total, present, absent, late, onLeave, percentage: percentageOf(present, late, total, onLeave) };
}

export function toOid(id: string) {
  return new Types.ObjectId(id);
}
