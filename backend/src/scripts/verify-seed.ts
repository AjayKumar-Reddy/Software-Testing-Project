/** Sanity checks for seeded data: timetable conflicts and workload distribution. `npx tsx src/scripts/verify-seed.ts` */
import { connectDB, disconnectDB } from "../config/db";
import { Timetable } from "../models";
import { facultyWorkloadSummary } from "../services/workload.service";

async function main() {
  await connectDB();
  const entries = await Timetable.find().lean();
  let conflicts = 0;
  for (let i = 0; i < entries.length; i++)
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i], b = entries[j];
      if (a.academicYear !== b.academicYear || a.dayOfWeek !== b.dayOfWeek) continue;
      if (!(a.startTime < b.endTime && a.endTime > b.startTime)) continue;
      if (String(a.faculty) === String(b.faculty) || a.room === b.room || a.section === b.section) conflicts++;
    }
  const summary = await facultyWorkloadSummary({ academicYear: "2026-27", term: "odd" });
  const by = (s: string) => summary.rows.filter((r) => r.status === s).length;
  console.log(`timetable entries=${entries.length} conflicts=${conflicts}`);
  console.log(`workload: overloaded=${by("overloaded")} optimal=${by("optimal")} underutilized=${by("underutilized")}`);
  console.log(summary.rows.map((r) => `${r.faculty.firstName}:${r.hours}`).join(" "));
  await disconnectDB();
}
main();
