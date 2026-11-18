import { describe, it, expect } from "vitest";
import { computeStats, percentageOf } from "../src/services/attendance.service";
import { classify, termSemesters } from "../src/services/workload.service";
import { workingDaysBetween, toDateOnly } from "../src/utils/dates";
import { toCSV } from "../src/services/export.service";

describe("attendance percentage", () => {
  it("counts present and late as attended and excludes leave days", () => {
    const stats = computeStats([
      { status: "present" },
      { status: "present" },
      { status: "late" },
      { status: "absent" },
      { status: "on_leave" },
    ]);
    expect(stats).toMatchObject({ total: 5, present: 2, late: 1, absent: 1, onLeave: 1 });
    expect(stats.percentage).toBe(75); // 3 of 4 countable days
  });

  it("returns null when there are no countable days", () => {
    expect(percentageOf(0, 0, 0, 0)).toBeNull();
    expect(percentageOf(0, 0, 3, 3)).toBeNull();
  });

  it("rounds to one decimal place", () => {
    expect(percentageOf(2, 0, 3, 0)).toBe(66.7);
  });
});

describe("working days", () => {
  it("skips non-working days", () => {
    // 2026-11-16 is a Monday; Mon–Sat working week
    const days = workingDaysBetween(toDateOnly("2026-11-16"), toDateOnly("2026-11-22"), [1, 2, 3, 4, 5, 6]);
    expect(days).toHaveLength(6);
    expect(days.map((d) => d.getUTCDay())).not.toContain(0);
  });

  it("normalises date strings to UTC midnight", () => {
    expect(toDateOnly("2026-11-18").toISOString()).toBe("2026-11-18T00:00:00.000Z");
  });
});

describe("workload classification", () => {
  it("classifies against configured limits", () => {
    expect(classify(20, 10, 18)).toBe("overloaded");
    expect(classify(8, 10, 18)).toBe("underutilized");
    expect(classify(18, 10, 18)).toBe("optimal");
    expect(classify(10, 10, 18)).toBe("optimal");
  });

  it("maps terms to semesters", () => {
    expect(termSemesters("odd")).toContain(5);
    expect(termSemesters("even")).toContain(4);
    expect(termSemesters("all")).toBeUndefined();
  });
});

describe("CSV export", () => {
  it("escapes quotes/commas and neutralises formula injection", () => {
    const csv = toCSV({ title: "t", columns: [{ key: "a", label: "A" }], rows: [{ a: 'He said "hi", ok' }, { a: "=SUM(A1)" }] });
    expect(csv).toContain('"He said ""hi"", ok"');
    expect(csv).toContain("'=SUM(A1)");
  });
});
